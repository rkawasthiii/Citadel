import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { niches, feedItems } from "@/lib/db/schema";
import { desc, sql, gt } from "drizzle-orm";

// Get niches with recent activity (for stories)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get niches with recent papers (last 7 days activity = "unseen story")
    const activeNiches = await db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        displayName: niches.displayName,
        avatarColor: niches.avatarColor,
        avatarInitials: niches.avatarInitials,
        recentPaperCount: sql<number>`COUNT(${feedItems.id})`.as('recent_paper_count'),
        latestPaperDate: sql<string>`MAX(${feedItems.createdAt})`.as('latest_paper_date'),
      })
      .from(niches)
      .leftJoin(feedItems, sql`${feedItems.nicheId} = ${niches.id}`)
      .groupBy(niches.id)
      .orderBy(desc(sql`MAX(${feedItems.createdAt})`))
      .limit(limit);

    // Mark niches with papers in last 7 days as having "unseen story"
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const storiesData = activeNiches.map((niche) => ({
      id: niche.id,
      slug: niche.slug,
      username: niche.slug,
      displayName: niche.displayName,
      avatarColor: niche.avatarColor,
      avatarInitials: niche.avatarInitials,
      hasUnseenStory: niche.latestPaperDate 
        ? new Date(niche.latestPaperDate) > sevenDaysAgo 
        : false,
      recentPaperCount: niche.recentPaperCount || 0,
    }));

    return NextResponse.json({
      success: true,
      data: storiesData,
    });
  } catch (error) {
    console.error("Error fetching niche stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}
