import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems, feedJobs, niches } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { VeritusPaper } from "@/lib/veritus/client";
import { inngest } from "@/lib/inngest/client";

// Helper function to find or create niche for a paper
async function findOrCreateNiche(fieldsOfStudy: string[]): Promise<string> {
  if (!fieldsOfStudy || fieldsOfStudy.length === 0) {
    // Return or create a "General" niche
    const generalNiche = await db.query.niches.findFirst({
      where: eq(niches.slug, "general"),
    });
    
    if (generalNiche) return generalNiche.id;
    
    const [newNiche] = await db.insert(niches).values({
      slug: "general",
      name: "General",
      displayName: "General",
      description: "General research papers",
      avatarInitials: "GN",
      avatarColor: "#6366F1",
    }).returning();
    
    return newNiche.id;
  }
  
  // Use the first field of study to find/create niche
  const primaryField = fieldsOfStudy[0];
  const slug = primaryField.toLowerCase().replace(/\s+/g, "-");
  
  const existingNiche = await db.query.niches.findFirst({
    where: eq(niches.slug, slug),
  });
  
  if (existingNiche) return existingNiche.id;
  
  // Create new niche
  const initials = primaryField
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
  
  const [newNiche] = await db.insert(niches).values({
    slug,
    name: primaryField,
    displayName: primaryField,
    description: `Research papers in ${primaryField}`,
    avatarInitials: initials,
    avatarColor: "#6366F1",
    metadata: { fieldsOfStudy },
  }).returning();
  
  return newNiche.id;
}

// Type for job params stored in database
interface JobParams {
  nicheId?: string;
  filters?: {
    fieldsOfStudy?: string[];
    [key: string]: unknown;
  };
}

/**
 * Webhook endpoint for Veritus API callbacks
 * This endpoint is called when a Veritus search job is completed
 * 
 * Expected payload from Veritus:
 * {
 *   "jobId": "507f1f77bcf86cd799439011",
 *   "status": "success" | "error",
 *   "results": [...papers...]  // Only present when status is "success"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📥 Received Veritus webhook callback");

    const { jobId, status, results } = body;

    if (!jobId) {
      console.error("❌ Webhook received without jobId");
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    console.log(`📝 Processing job ${jobId} with status: ${status}`);

    // Find the job in our database
    const [job] = await db
      .select()
      .from(feedJobs)
      .where(eq(feedJobs.veritusJobId, jobId))
      .limit(1);

    if (!job) {
      console.warn(`⚠️ Job not found in database: ${jobId}`);
      // Still return 200 to acknowledge receipt (idempotent)
      return NextResponse.json({ received: true, message: "Job not found but acknowledged" });
    }

    // Get nicheId from job params (stored when job was created)
    const jobParams = job.params as JobParams | null;
    const nicheIdFromJob = jobParams?.nicheId;

    // Update job status
    await db
      .update(feedJobs)
      .set({
        status: status === "success" ? "completed" : "failed",
        resultsCount: results?.length || 0,
        completedAt: new Date(),
      })
      .where(eq(feedJobs.veritusJobId, jobId));

    // If successful and has results, save papers to feed
    if (status === "success" && results && Array.isArray(results)) {
      console.log(`💾 Saving ${results.length} papers to feed`);
      let savedCount = 0;
      let skippedCount = 0;

      for (const paper of results as VeritusPaper[]) {
        try {
          // Use nicheId from job params if available, otherwise find/create from paper fields
          const nicheId = nicheIdFromJob || await findOrCreateNiche(paper.fieldsOfStudy || []);
          
          // Try to insert, handle duplicates gracefully
          const result = await db
            .insert(feedItems)
            .values({
              nicheId,
              paperId: paper.id,
              title: paper.title,
              abstract: paper.abstract,
              authors: paper.authors,
              doi: paper.doi,
              journalName: paper.journalName,
              year: paper.year,
              citationCount: paper.impactFactor?.citationCount || 0,
              influentialCitationCount:
                paper.impactFactor?.influentialCitationCount || 0,
              isOpenAccess: paper.isOpenAccess || false,
              pdfLink: paper.pdfLink,
              link: paper.link,
              tldr: paper.tldr,
              fieldsOfStudy: paper.fieldsOfStudy || [],
              quartileRanking: paper.v_quartile_ranking,
              publicationType: paper.publicationType,
              thumbnailUrl: generateThumbnailUrl(paper),
            })
            .onConflictDoUpdate({
              target: feedItems.paperId,
              set: {
                citationCount: paper.impactFactor?.citationCount || 0,
                influentialCitationCount:
                  paper.impactFactor?.influentialCitationCount || 0,
                updatedAt: new Date(),
              },
            })
            .returning({ id: feedItems.id });
          
          if (result.length > 0) {
            savedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to save paper ${paper.id}:`, error);
          skippedCount++;
        }
      }

      console.log(`✅ Saved ${savedCount} papers, skipped ${skippedCount} duplicates`);
      
      // Update niche stats if we have a nicheId
      if (nicheIdFromJob) {
        const totalPapers = await db
          .select({ count: sql<number>`count(*)` })
          .from(feedItems)
          .where(eq(feedItems.nicheId, nicheIdFromJob));

        await db
          .update(niches)
          .set({
            stats: {
              totalPapers: totalPapers[0].count,
              totalFollowers: 0,
              weeklyGrowth: 0,
              monthlyGrowth: 0,
            },
            updatedAt: new Date(),
          })
          .where(eq(niches.id, nicheIdFromJob));
      }
    }

    // Send Inngest event to notify waiting functions
    try {
      await inngest.send({
        name: "veritus/job.completed",
        data: {
          jobId,
          status,
          results: results || [],
          nicheId: nicheIdFromJob,
        },
      });
      console.log(`📤 Sent Inngest event for job ${jobId}`);
    } catch (error) {
      console.error("❌ Failed to send Inngest event:", error);
      // Don't fail the webhook - data is already saved
    }

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} processed successfully`,
      papersSaved: results?.length || 0,
    });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    return NextResponse.json(
      {
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function to generate thumbnail URL
function generateThumbnailUrl(paper: VeritusPaper): string {
  const field = paper.fieldsOfStudy?.[0] || "Science";
  const encodedTitle = encodeURIComponent(paper.title.substring(0, 50));
  return `https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=${encodedTitle}`;
}

// Allow GET requests to verify the endpoint is working
export async function GET() {
  return NextResponse.json({
    message: "Veritus webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
