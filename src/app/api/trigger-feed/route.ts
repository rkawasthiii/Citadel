import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { niches } from "@/lib/db/schema";

/**
 * Manual trigger endpoint for feed population
 * 
 * Examples:
 * - Populate all niches: POST /api/trigger-feed
 * - Populate specific field: POST /api/trigger-feed?field=Computer%20Science
 * - Populate multiple: POST /api/trigger-feed?fields=Computer%20Science,Medicine,Biology
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get("field");
    const fieldsParam = searchParams.get("fields");
    const limit = parseInt(searchParams.get("limit") || "100");

    let fieldsToPopulate: string[] = [];

    if (field) {
      // Single field
      fieldsToPopulate = [field];
    } else if (fieldsParam) {
      // Multiple fields (comma-separated)
      fieldsToPopulate = fieldsParam.split(",").map((f) => f.trim());
    } else {
      // All fields - get from database
      const allNiches = await db.select().from(niches);
      fieldsToPopulate = allNiches.map((n) => n.name);
    }

    // Get niches from database
    const nicheRecords = await db.select().from(niches);
    const nicheMap = new Map(nicheRecords.map((n) => [n.name, n.id]));

    // Trigger events for each field
    const events = fieldsToPopulate
      .filter((f) => nicheMap.has(f))
      .map((fieldOfStudy) => ({
        name: "niche/populate.field",
        data: {
          fieldOfStudy,
          nicheId: nicheMap.get(fieldOfStudy)!,
          limit,
          priority: "manual",
        },
      }));

    if (events.length === 0) {
      return NextResponse.json(
        {
          error: "No valid niches found. Run seed script first.",
          availableFields: Array.from(nicheMap.keys()),
        },
        { status: 400 }
      );
    }

    // Send events to Inngest
    await inngest.send(events);

    return NextResponse.json({
      success: true,
      message: `Triggered feed population for ${events.length} field(s)`,
      fields: fieldsToPopulate,
      limit,
      note: "Check Inngest dashboard (http://localhost:8288) to monitor progress",
    });
  } catch (error) {
    console.error("Failed to trigger feed population:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger feed population",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list available niches
 */
export async function GET() {
  try {
    const allNiches = await db.select().from(niches);

    return NextResponse.json({
      success: true,
      total: allNiches.length,
      niches: allNiches.map((n) => ({
        name: n.name,
        slug: n.slug,
        totalPapers: (n.stats as any)?.totalPapers || 0,
        totalFollowers: (n.stats as any)?.totalFollowers || 0,
      })),
      usage: {
        populateAll: "POST /api/trigger-feed",
        populateOne: "POST /api/trigger-feed?field=Computer%20Science",
        populateMultiple:
          "POST /api/trigger-feed?fields=Computer%20Science,Medicine",
        customLimit: "POST /api/trigger-feed?field=Physics&limit=200",
      },
    });
  } catch (error) {
    console.error("Failed to list niches:", error);
    return NextResponse.json(
      {
        error: "Failed to list niches",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
