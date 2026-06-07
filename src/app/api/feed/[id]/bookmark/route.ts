import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookmarks, feedItems, userInteractions, userNicheWeights } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

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

    // Check if already bookmarked
    const existingBookmark = await db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.userId, userId), eq(bookmarks.feedItemId, id)),
    });

    if (existingBookmark) {
      // Remove bookmark
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.feedItemId, id)));

      // Decrement bookmarks count
      await db
        .update(feedItems)
        .set({ bookmarksCount: sql`${feedItems.bookmarksCount} - 1` })
        .where(eq(feedItems.id, id));

      // Track interaction
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "unbookmark",
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId, "unbookmark");

      // Get updated count
      const updatedItem = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, id),
        columns: { bookmarksCount: true },
      });

      return NextResponse.json({ 
        bookmarked: false, 
        count: updatedItem?.bookmarksCount || 0 
      });
    } else {
      // Add bookmark
      await db.insert(bookmarks).values({
        userId,
        feedItemId: id,
      });

      // Increment bookmarks count
      await db
        .update(feedItems)
        .set({ bookmarksCount: sql`${feedItems.bookmarksCount} + 1` })
        .where(eq(feedItems.id, id));

      // Track interaction
      await db.insert(userInteractions).values({
        userId,
        feedItemId: id,
        nicheId: feedItem.nicheId,
        interactionType: "bookmark",
      });

      // Update user niche weights
      await updateUserNicheWeight(userId, feedItem.nicheId, "bookmark");

      // Get updated count
      const updatedItem = await db.query.feedItems.findFirst({
        where: eq(feedItems.id, id),
        columns: { bookmarksCount: true },
      });

      return NextResponse.json({ 
        bookmarked: true, 
        count: updatedItem?.bookmarksCount || 0 
      });
    }
  } catch (error) {
    console.error("Failed to toggle bookmark:", error);
    return NextResponse.json(
      { error: "Failed to toggle bookmark" },
      { status: 500 }
    );
  }
}

// Helper function to update user niche weights
async function updateUserNicheWeight(
  userId: string, 
  nicheId: string, 
  action: "bookmark" | "unbookmark"
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
          totalBookmarks: action === "bookmark" 
            ? sql`${userNicheWeights.totalBookmarks} + 1`
            : sql`GREATEST(${userNicheWeights.totalBookmarks} - 1, 0)`,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userNicheWeights.userId, userId),
            eq(userNicheWeights.nicheId, nicheId)
          )
        );
    } else if (action === "bookmark") {
      // Create new weight record
      await db.insert(userNicheWeights).values({
        userId,
        nicheId,
        totalBookmarks: 1,
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

    // Get bookmark count from feedItems (denormalized)
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
      columns: { bookmarksCount: true },
    });

    const count = feedItem?.bookmarksCount || 0;

    // Check if user bookmarked
    let isBookmarked = false;
    if (userId) {
      const userBookmark = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.userId, userId), eq(bookmarks.feedItemId, id)),
      });
      isBookmarked = !!userBookmark;
    }

    return NextResponse.json({ count, isBookmarked });
  } catch (error) {
    console.error("Failed to get bookmarks:", error);
    return NextResponse.json(
      { error: "Failed to get bookmarks" },
      { status: 500 }
    );
  }
}
