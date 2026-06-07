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
    const { userId, shareType } = body; // shareType: 'copy' | 'native' | 'twitter' | 'linkedin' etc.

    // Get the feed item to find nicheId
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
    }

    // Increment shares count
    await db
      .update(feedItems)
      .set({ sharesCount: sql`${feedItems.sharesCount} + 1` })
      .where(eq(feedItems.id, id));

    // Track interaction if user is logged in
    if (userId) {
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "share",
        metadata: { shareType },
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId);
    }

    // Get updated count
    const updatedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
      columns: { sharesCount: true },
    });

    return NextResponse.json({ 
      success: true, 
      count: updatedItem?.sharesCount || 0 
    });
  } catch (error) {
    console.error("Failed to track share:", error);
    return NextResponse.json(
      { error: "Failed to track share" },
      { status: 500 }
    );
  }
}

// Helper function to update user niche weights for shares
async function updateUserNicheWeight(userId: string, nicheId: string) {
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
          totalShares: sql`${userNicheWeights.totalShares} + 1`,
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
        totalShares: 1,
        lastInteractionAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Failed to update user niche weight:", error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get share count from feedItems (denormalized)
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
      columns: { sharesCount: true },
    });

    return NextResponse.json({ count: feedItem?.sharesCount || 0 });
  } catch (error) {
    console.error("Failed to get shares:", error);
    return NextResponse.json(
      { error: "Failed to get shares" },
      { status: 500 }
    );
  }
}
