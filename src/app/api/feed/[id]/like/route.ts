import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { likes, feedItems, userInteractions, userNicheWeights } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { inngest } from "@/lib/inngest";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get the feed item to find nicheId
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
    }

    // Check if already liked
    const existingLike = await db.query.likes.findFirst({
      where: and(eq(likes.userId, userId), eq(likes.feedItemId, id)),
    });

    if (existingLike) {
      // Unlike
      await db
        .delete(likes)
        .where(and(eq(likes.userId, userId), eq(likes.feedItemId, id)));

      // Decrement likes count
      await db
        .update(feedItems)
        .set({ likesCount: sql`${feedItems.likesCount} - 1` })
        .where(eq(feedItems.id, id));

      // Track interaction
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "unlike",
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId, "unlike");

      // Get updated count
      const updatedItem = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, id),
        columns: { likesCount: true },
      });

      const newCount = updatedItem?.likesCount || 0;

      // Broadcast realtime update via Inngest
      await inngest.send({
        name: "feed/like.updated",
        data: {
          feedItemId: id,
          userId,
          action: "unliked" as const,
          newCount,
        },
      });

      return NextResponse.json({ 
        liked: false, 
        count: newCount 
      });
    } else {
      // Like
      await db.insert(likes).values({
        userId,
        feedItemId: id,
      });

      // Increment likes count
      await db
        .update(feedItems)
        .set({ likesCount: sql`${feedItems.likesCount} + 1` })
        .where(eq(feedItems.id, id));

      // Track interaction
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "like",
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId, "like");

      // Get updated count
      const updatedItem = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, id),
        columns: { likesCount: true },
      });

      const newCount = updatedItem?.likesCount || 0;

      // Broadcast realtime update via Inngest
      await inngest.send({
        name: "feed/like.updated",
        data: {
          feedItemId: id,
          userId,
          action: "liked" as const,
          newCount,
        },
      });

      return NextResponse.json({ 
        liked: true, 
        count: newCount 
      });
    }
  } catch (error) {
    console.error("Failed to toggle like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}

// Helper function to update user niche weights
async function updateUserNicheWeight(
  userId: string, 
  nicheId: string, 
  action: "like" | "unlike"
) {
  try {
    const existing = await db.query.userNicheWeights.findFirst({
      where: and(
        eq(userNicheWeights.userId, userId),
        eq(userNicheWeights.nicheId, nicheId)
      ),
    });

    if (existing) {
      // Update existing
      await db
        .update(userNicheWeights)
        .set({
          totalLikes: action === "like" 
            ? sql`${userNicheWeights.totalLikes} + 1`
            : sql`GREATEST(${userNicheWeights.totalLikes} - 1, 0)`,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userNicheWeights.userId, userId),
            eq(userNicheWeights.nicheId, nicheId)
          )
        );
    } else if (action === "like") {
      // Create new weight record
      await db.insert(userNicheWeights).values({
        userId,
        nicheId,
        totalLikes: 1,
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Get like count from feedItems (denormalized)
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
      columns: { likesCount: true },
    });

    const count = feedItem?.likesCount || 0;

    // Check if user liked
    let isLiked = false;
    if (userId) {
      const userLike = await db.query.likes.findFirst({
        where: and(eq(likes.userId, userId), eq(likes.feedItemId, id)),
      });
      isLiked = !!userLike;
    }

    return NextResponse.json({ count, isLiked });
  } catch (error) {
    console.error("Failed to get likes:", error);
    return NextResponse.json(
      { error: "Failed to get likes" },
      { status: 500 }
    );
  }
}
