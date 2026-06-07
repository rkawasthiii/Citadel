import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, likes, bookmarks, nicheFollows, feedItems, niches } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get user stats
    const [likesCount, bookmarksCount, nichesCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(likes).where(eq(likes.userId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(bookmarks).where(eq(bookmarks.userId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(nicheFollows).where(eq(nicheFollows.userId, userId)),
    ]);

    // Get liked papers with niche info
    const likedPapers = await db
      .select({
        id: feedItems.id,
        title: feedItems.title,
        authors: feedItems.authors,
        year: feedItems.year,
        likedAt: likes.createdAt,
        nicheSlug: niches.slug,
        nicheDisplayName: niches.displayName,
      })
      .from(likes)
      .innerJoin(feedItems, eq(likes.feedItemId, feedItems.id))
      .leftJoin(niches, eq(feedItems.nicheId, niches.id))
      .where(eq(likes.userId, userId))
      .orderBy(desc(likes.createdAt))
      .limit(20);

    // Get saved/bookmarked papers with niche info
    const savedPapers = await db
      .select({
        id: feedItems.id,
        title: feedItems.title,
        authors: feedItems.authors,
        year: feedItems.year,
        savedAt: bookmarks.createdAt,
        nicheSlug: niches.slug,
        nicheDisplayName: niches.displayName,
      })
      .from(bookmarks)
      .innerJoin(feedItems, eq(bookmarks.feedItemId, feedItems.id))
      .leftJoin(niches, eq(feedItems.nicheId, niches.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(20);

    // Get followed niches
    const followedNiches = await db
      .select({
        id: niches.id,
        slug: niches.slug,
        displayName: niches.displayName,
        avatarColor: niches.avatarColor,
        avatarInitials: niches.avatarInitials,
      })
      .from(nicheFollows)
      .innerJoin(niches, eq(nicheFollows.nicheId, niches.id))
      .where(eq(nicheFollows.userId, userId))
      .orderBy(desc(nicheFollows.followedAt))
      .limit(20);

    return NextResponse.json({
      stats: {
        papersLiked: likesCount[0]?.count || 0,
        papersBookmarked: bookmarksCount[0]?.count || 0,
        comments: 0,
        nichesFollowing: nichesCount[0]?.count || 0,
      },
      likedPapers: likedPapers.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        likedAt: p.likedAt,
        niche: p.nicheSlug ? {
          slug: p.nicheSlug,
          displayName: p.nicheDisplayName,
        } : null,
      })),
      savedPapers: savedPapers.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        likedAt: p.savedAt,
        niche: p.nicheSlug ? {
          slug: p.nicheSlug,
          displayName: p.nicheDisplayName,
        } : null,
      })),
      followedNiches: followedNiches.map((n) => ({
        id: n.id,
        slug: n.slug,
        displayName: n.displayName,
        avatarColor: n.avatarColor,
        avatarInitials: n.avatarInitials,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch profile data:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, username, bio, institution } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Check if username is already taken by another user
    if (username) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
    }

    // Build update object - only include fields that are provided
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (institution !== undefined) updateData.institution = institution;

    // Update user profile
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
