import { NextRequest, NextResponse } from "next/server";
import { updateUserNicheCombinedWeights } from "@/lib/algorithm";
import { db } from "@/lib/db";
import { userNicheWeights } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

/**
 * Admin endpoint to update user weights
 * 
 * POST /api/admin/update-weights
 * - userId: specific user ID to update
 * - all: true to update all users (background job)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, all } = body;

    if (userId) {
      // Update specific user
      await updateUserNicheCombinedWeights(userId);
      return NextResponse.json({ success: true, userId });
    }

    if (all) {
      // Get all unique user IDs with weights
      const users = await db
        .selectDistinct({ userId: userNicheWeights.userId })
        .from(userNicheWeights);

      // Update each user (in production, this should be queued)
      let updated = 0;
      for (const user of users) {
        await updateUserNicheCombinedWeights(user.userId);
        updated++;
      }

      return NextResponse.json({ success: true, usersUpdated: updated });
    }

    return NextResponse.json(
      { error: "userId or all parameter required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to update weights:", error);
    return NextResponse.json(
      { error: "Failed to update weights" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check weight update status
 */
export async function GET(request: NextRequest) {
  try {
    // Get stats about user weights
    const stats = await db
      .select({
        totalRecords: sql<number>`count(*)`,
        avgCombinedWeight: sql<number>`avg(combined_weight)`,
        usersWithWeights: sql<number>`count(distinct user_id)`,
      })
      .from(userNicheWeights);

    return NextResponse.json({
      stats: stats[0],
    });
  } catch (error) {
    console.error("Failed to get weight stats:", error);
    return NextResponse.json(
      { error: "Failed to get weight stats" },
      { status: 500 }
    );
  }
}
