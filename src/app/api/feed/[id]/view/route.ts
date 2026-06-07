import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems, userInteractions, userNicheWeights } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, duration, scrollDepth, sourceScreen } = body;

    // Get the feed item to find nicheId
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
    }

    // Increment views count
    await db
      .update(feedItems)
      .set({ viewsCount: sql`${feedItems.viewsCount} + 1` })
      .where(eq(feedItems.id, id));

    // Track interaction if user is logged in
    if (userId) {
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "view",
        duration: duration || null,
        scrollDepth: scrollDepth || null,
        context: { sourceScreen },
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId, duration);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to track view:", error);
    return NextResponse.json(
      { error: "Failed to track view" },
      { status: 500 }
    );
  }
}

// Helper function to update user niche weights for views
async function updateUserNicheWeight(
  userId: string, 
  nicheId: string,
  duration?: number
) {
  try {
    const existing = await db.query.userNicheWeights.findFirst({
      where: and(
        eq(userNicheWeights.userId, userId),
        eq(userNicheWeights.nicheId, nicheId)
      ),
    });

    if (existing) {
      await db
        .update(userNicheWeights)
        .set({
          totalViews: sql`${userNicheWeights.totalViews} + 1`,
          totalTimeSpent: duration 
            ? sql`${userNicheWeights.totalTimeSpent} + ${duration}`
            : userNicheWeights.totalTimeSpent,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userNicheWeights.userId, userId),
            eq(userNicheWeights.nicheId, nicheId)
          )
        );
    } else {
      await db.insert(userNicheWeights).values({
        userId,
        nicheId,
        totalViews: 1,
        totalTimeSpent: duration || 0,
        lastInteractionAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Failed to update user niche weight:", error);
  }
}
