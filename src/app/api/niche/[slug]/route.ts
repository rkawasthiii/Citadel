import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems, likes, bookmarks, comments, niches } from "@/lib/db/schema";
import { desc, sql, eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("userId");
    const offset = (page - 1) * limit;
    const { slug } = await params;

    // Get niche info
    const niche = await db.query.niches.findFirst({
      where: eq(niches.slug, slug),
    });

    if (!niche) {
      return NextResponse.json(
        { error: "Niche not found" },
        { status: 404 }
      );
    }

    // Fetch feed items for this niche
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
        likesCount: sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.feed_item_id = ${feedItems.id})`,
        commentsCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.feed_item_id = ${feedItems.id})`,
        bookmarksCount: sql<number>`(SELECT COUNT(*) FROM bookmarks WHERE bookmarks.feed_item_id = ${feedItems.id})`,
      })
      .from(feedItems)
      .where(eq(feedItems.nicheId, niche.id))
      .orderBy(desc(feedItems.createdAt))
      .limit(limit)
      .offset(offset);

    // Get user's likes and bookmarks if userId provided
    let userLikes = new Set<string>();
    let userBookmarks = new Set<string>();

    if (userId && items.length > 0) {
      const itemIds = items.map(item => item.id);
      
      const [likedItems, bookmarkedItems] = await Promise.all([
        db.select({ feedItemId: likes.feedItemId })
          .from(likes)
          .where(and(
            eq(likes.userId, userId),
            sql`${likes.feedItemId} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`
          )),
        db.select({ feedItemId: bookmarks.feedItemId })
          .from(bookmarks)
          .where(and(
            eq(bookmarks.userId, userId),
            sql`${bookmarks.feedItemId} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)})`
          )),
      ]);

      userLikes = new Set(likedItems.map(l => l.feedItemId));
      userBookmarks = new Set(bookmarkedItems.map(b => b.feedItemId));
    }

    // Add isLiked and isBookmarked to items
    const itemsWithUserStatus = items.map(item => ({
      ...item,
      isLiked: userLikes.has(item.id),
      isBookmarked: userBookmarks.has(item.id),
    }));

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(feedItems)
      .where(eq(feedItems.nicheId, niche.id));
    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      niche: {
        id: niche.id,
        slug: niche.slug,
        name: niche.name,
        displayName: niche.displayName,
        description: niche.description,
        avatarInitials: niche.avatarInitials,
        avatarColor: niche.avatarColor,
        stats: niche.stats,
      },
      items: itemsWithUserStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + items.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch niche timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche timeline" },
      { status: 500 }
    );
  }
}
