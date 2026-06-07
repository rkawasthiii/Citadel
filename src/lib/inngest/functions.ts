import { inngest } from "./client";
import { veritusClient, type VeritusPaper } from "@/lib/veritus/client";
import { db } from "@/lib/db";
import { feedItems, feedJobs, userPreferences, niches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Get the callback URL for Veritus webhooks
const getCallbackUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!baseUrl) return undefined;
  // Veritus requires HTTPS callback URLs (no localhost)
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return undefined;
  }
  return `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/webhooks/veritus`;
};

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

// Function to refresh user's feed based on their preferences
export const refreshUserFeed = inngest.createFunction(
  {
    id: "refresh-user-feed",
    name: "Refresh User Feed",
    retries: 3,
  },
  { event: "feed/refresh" },
  async ({ event, step }) => {
    const { userId } = event.data;

    // Step 1: Get user preferences
    const preferences = await step.run("get-user-preferences", async () => {
      const prefs = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });
      return prefs;
    });

    if (!preferences || !preferences.phrases?.length) {
      return { success: false, message: "No preferences found for user" };
    }

    // Step 2: Create a job with Veritus API
    const job = await step.run("create-veritus-job", async () => {
      const callbackUrl = getCallbackUrl();
      
      const response = await veritusClient.createJob(
        "keywordSearch",
        {
          phrases: preferences.phrases as string[],
          enrich: false,
          callbackUrl, // Add webhook callback
        },
        {
          limit: 100,
          fieldsOfStudy: preferences.fieldsOfStudy as string[] | undefined,
          minCitationCount: preferences.minCitationCount || undefined,
          openAccessPdf: preferences.openAccessOnly || undefined,
          quartileRanking: preferences.quartileRankings as string[] | undefined,
          sort: "citationCount:desc",
        }
      );

      // Save job to database
      await db.insert(feedJobs).values({
        userId,
        veritusJobId: response.jobId,
        status: "queued",
        jobType: "keywordSearch",
        params: {
          phrases: preferences.phrases as string[],
          filters: {
            fieldsOfStudy: preferences.fieldsOfStudy,
            minCitationCount: preferences.minCitationCount,
            openAccessOnly: preferences.openAccessOnly,
            quartileRankings: preferences.quartileRankings,
          },
        },
      });

      return { ...response, callbackUrl };
    });

    // Step 3: Wait for webhook or poll as fallback
    let results;
    
    if (job.callbackUrl) {
      // Production: Wait for webhook
      const webhookEvent = await step.waitForEvent("wait-for-veritus-webhook", {
        event: "veritus/job.completed",
        timeout: "10m",
        if: `async.data.jobId == "${job.jobId}"`,
      });

      if (!webhookEvent) {
        throw new Error("Webhook timeout - job took longer than 10 minutes");
      }

      results = webhookEvent.data.results || [];
      
    } else {
      // Localhost: Poll with conservative delays
      results = await step.run("poll-job-status-fallback", async () => {
        let attempts = 0;
        const maxAttempts = 6;
        
        while (attempts < maxAttempts) {
          try {
            const status = await veritusClient.getJobStatus(job.jobId);

            if (status.status === "success") {
              return status.results;
            }

            if (status.status === "error") {
              throw new Error("Veritus job failed");
            }
            
          } catch (error: any) {
            if (error.message?.includes("Too Many Requests")) {
              console.error("⚠️ Rate limit hit - waiting 2 minutes");
              await new Promise((resolve) => setTimeout(resolve, 120000));
              attempts++;
              continue;
            }
            throw error;
          }

          // Wait 60 seconds between attempts
          await new Promise((resolve) => setTimeout(resolve, 60000));
          attempts++;
        }

        throw new Error("⚠️ Polling timeout - use production URL for webhook support");
      });
    }

    // Step 4: Save papers to feed
    const savedCount = await step.run("save-to-feed", async () => {
      if (!results || results.length === 0) {
        return 0;
      }

      // Upsert papers (ignore conflicts on paperId)
      for (const paper of results as VeritusPaper[]) {
        // Find or create niche for this paper
        const nicheId = await findOrCreateNiche(paper.fieldsOfStudy || []);
        
        const item = {
          nicheId,
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          doi: paper.doi,
          journalName: paper.journalName,
          year: paper.year,
          citationCount: paper.impactFactor?.citationCount || 0,
          influentialCitationCount: paper.impactFactor?.influentialCitationCount || 0,
          isOpenAccess: paper.isOpenAccess || false,
          pdfLink: paper.pdfLink,
          link: paper.link,
          tldr: paper.tldr,
          fieldsOfStudy: paper.fieldsOfStudy || [],
          quartileRanking: paper.v_quartile_ranking,
          publicationType: paper.publicationType,
          thumbnailUrl: generateThumbnailUrl(paper),
        };
        
        await db
          .insert(feedItems)
          .values(item)
          .onConflictDoUpdate({
            target: feedItems.paperId,
            set: {
              citationCount: item.citationCount,
              influentialCitationCount: item.influentialCitationCount,
              updatedAt: new Date(),
            },
          });
      }

      // Update job status
      await db
        .update(feedJobs)
        .set({
          status: "completed",
          resultsCount: results.length,
          completedAt: new Date(),
        })
        .where(eq(feedJobs.veritusJobId, job.jobId));

      return results.length;
    });

    return {
      success: true,
      papersAdded: savedCount,
      jobId: job.jobId,
    };
  }
);

// Scheduled function to refresh feeds daily
export const scheduledFeedRefresh = inngest.createFunction(
  {
    id: "scheduled-feed-refresh",
    name: "Scheduled Feed Refresh",
  },
  { cron: "0 6 * * *" }, // Run daily at 6 AM
  async ({ step }) => {
    // Get all users with preferences
    const usersWithPrefs = await step.run("get-users-with-preferences", async () => {
      const prefs = await db.query.userPreferences.findMany();
      return prefs;
    });

    // Trigger refresh for each user
    for (const pref of usersWithPrefs) {
      await step.run(`trigger-refresh-${pref.userId}`, async () => {
        await inngest.send({
          name: "feed/refresh",
          data: { userId: pref.userId },
        });
      });
    }

    return { usersTriggered: usersWithPrefs.length };
  }
);

// Function to handle Veritus webhook callbacks
export const handleVeritusCallback = inngest.createFunction(
  {
    id: "handle-veritus-callback",
    name: "Handle Veritus Callback",
  },
  { event: "veritus/callback" },
  async ({ event, step }) => {
    const { jobId, status, results } = event.data;

    // Update job status in database
    await step.run("update-job-status", async () => {
      await db
        .update(feedJobs)
        .set({
          status: status === "success" ? "completed" : "failed",
          resultsCount: results?.length || 0,
          completedAt: new Date(),
        })
        .where(eq(feedJobs.veritusJobId, jobId));
    });

    // If successful, save papers
    if (status === "success" && results?.length > 0) {
      await step.run("save-callback-results", async () => {
        for (const paper of results as VeritusPaper[]) {
          // Find or create niche for this paper
          const nicheId = await findOrCreateNiche(paper.fieldsOfStudy || []);
          
          const item = {
            nicheId,
            paperId: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            authors: paper.authors,
            doi: paper.doi,
            journalName: paper.journalName,
            year: paper.year,
            citationCount: paper.impactFactor?.citationCount || 0,
            influentialCitationCount: paper.impactFactor?.influentialCitationCount || 0,
            isOpenAccess: paper.isOpenAccess || false,
            pdfLink: paper.pdfLink,
            link: paper.link,
            tldr: paper.tldr,
            fieldsOfStudy: paper.fieldsOfStudy || [],
            quartileRanking: paper.v_quartile_ranking,
            publicationType: paper.publicationType,
            thumbnailUrl: generateThumbnailUrl(paper),
          };
          
          await db
            .insert(feedItems)
            .values(item)
            .onConflictDoUpdate({
              target: feedItems.paperId,
              set: {
                citationCount: item.citationCount,
                influentialCitationCount: item.influentialCitationCount,
                updatedAt: new Date(),
              },
            });
        }
      });
    }

    return { success: true, jobId };
  }
);

// Helper function to generate a thumbnail URL based on paper fields
function generateThumbnailUrl(paper: VeritusPaper): string {
  // Use a gradient based on the field of study
  const field = paper.fieldsOfStudy?.[0] || "Science";
  const colors: Record<string, string> = {
    "Computer Science": "from-blue-500 to-purple-600",
    Medicine: "from-red-500 to-pink-600",
    Biology: "from-green-500 to-teal-600",
    Physics: "from-indigo-500 to-blue-600",
    Chemistry: "from-yellow-500 to-orange-600",
    Mathematics: "from-gray-500 to-slate-600",
    Engineering: "from-amber-500 to-red-600",
    Psychology: "from-pink-500 to-rose-600",
  };

  // Return a placeholder image service URL with field-based styling
  const encodedTitle = encodeURIComponent(paper.title.substring(0, 50));
  return `https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=${encodedTitle}`;
}

// Export all functions
export const functions = [
  refreshUserFeed,
  scheduledFeedRefresh,
  handleVeritusCallback,
];
