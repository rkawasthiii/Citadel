import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems, likes, bookmarks, comments, niches } from "@/lib/db/schema";
import { desc, sql, eq, and, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const userId = searchParams.get("userId"); // Optional: for personalized feed
    const offset = (page - 1) * limit;

    // Fetch feed items with niche info and engagement counts
    const items = await db
      .select({
        id: feedItems.id,
        paperId: feedItems.paperId,
        title: feedItems.title,
        abstract: feedItems.abstract,
        authors: feedItems.authors,
        doi: feedItems.doi,
        journalName: feedItems.journalName,
        year: feedItems.year,
        citationCount: feedItems.citationCount,
        influentialCitationCount: feedItems.influentialCitationCount,
        isOpenAccess: feedItems.isOpenAccess,
        pdfLink: feedItems.pdfLink,
        link: feedItems.link,
        tldr: feedItems.tldr,
        fieldsOfStudy: feedItems.fieldsOfStudy,
        quartileRanking: feedItems.quartileRanking,
        publicationType: feedItems.publicationType,
        thumbnailUrl: feedItems.thumbnailUrl,
        createdAt: feedItems.createdAt,
        // Use denormalized counts for performance
        likesCount: feedItems.likesCount,
        commentsCount: feedItems.commentsCount,
        bookmarksCount: feedItems.bookmarksCount,
        // Niche info
        niche: {
          id: niches.id,
          slug: niches.slug,
          name: niches.name,
          displayName: niches.displayName,
          avatarInitials: niches.avatarInitials,
          avatarColor: niches.avatarColor,
        },
      })
      .from(feedItems)
      .innerJoin(niches, eq(feedItems.nicheId, niches.id))
      .orderBy(desc(feedItems.createdAt), desc(feedItems.id))
      .limit(limit)
      .offset(offset);

    // If user is logged in, check which items they've liked/bookmarked
    let userLikes: Set<string> = new Set();
    let userBookmarks: Set<string> = new Set();

    if (userId && items.length > 0) {
      const itemIds = items.map(item => item.id);

      // Get user's likes for these items
      const likedItems = await db
        .select({ feedItemId: likes.feedItemId })
        .from(likes)
        .where(and(
          eq(likes.userId, userId),
          inArray(likes.feedItemId, itemIds)
        ));
      userLikes = new Set(likedItems.map(l => l.feedItemId));

      // Get user's bookmarks for these items
      const bookmarkedItems = await db
        .select({ feedItemId: bookmarks.feedItemId })
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, userId),
          inArray(bookmarks.feedItemId, itemIds)
        ));
      userBookmarks = new Set(bookmarkedItems.map(b => b.feedItemId));
    }

    // Add isLiked and isBookmarked to items
    const itemsWithUserState = items.map(item => ({
      ...item,
      isLiked: userLikes.has(item.id),
      isBookmarked: userBookmarks.has(item.id),
    }));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(feedItems);
    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      items: itemsWithUserState,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
