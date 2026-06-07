import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nicheFollows, niches } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Get niche by slug
    const niche = await db.query.niches.findFirst({
      where: eq(niches.slug, slug),
    });

    if (!niche) {
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    }

    // Check if already following
    const existingFollow = await db.query.nicheFollows.findFirst({
      where: and(
        eq(nicheFollows.userId, userId),
        eq(nicheFollows.nicheId, niche.id)
      ),
    });

    if (existingFollow) {
      // Unfollow
      await db
        .delete(nicheFollows)
        .where(
          and(
            eq(nicheFollows.userId, userId),
            eq(nicheFollows.nicheId, niche.id)
          )
        );

      // Update niche stats
      await db
        .update(niches)
        .set({
          stats: sql`jsonb_set(
            COALESCE(${niches.stats}, '{}'),
            '{totalFollowers}',
            to_jsonb(GREATEST(0, COALESCE((${niches.stats}->>'totalFollowers')::int, 1) - 1))
          )`,
        })
        .where(eq(niches.id, niche.id));

      // Get updated follower count
      const updatedNiche = await db.query.niches.findFirst({
        where: eq(niches.id, niche.id),
        columns: { stats: true },
      });

      return NextResponse.json({
        following: false,
        followersCount: updatedNiche?.stats?.totalFollowers || 0,
      });
    } else {
      // Follow
      await db.insert(nicheFollows).values({
        userId,
        nicheId: niche.id,
        source: "niche_page",
      });

      // Update niche stats
      await db
        .update(niches)
        .set({
          stats: sql`jsonb_set(
            COALESCE(${niches.stats}, '{}'),
            '{totalFollowers}',
            to_jsonb(COALESCE((${niches.stats}->>'totalFollowers')::int, 0) + 1)
          )`,
        })
        .where(eq(niches.id, niche.id));

      // Get updated follower count
      const updatedNiche = await db.query.niches.findFirst({
        where: eq(niches.id, niche.id),
        columns: { stats: true },
      });

      return NextResponse.json({
        following: true,
        followersCount: updatedNiche?.stats?.totalFollowers || 0,
      });
    }
  } catch (error) {
    console.error("Failed to follow/unfollow niche:", error);
    return NextResponse.json(
      { error: "Failed to follow/unfollow niche" },
      { status: 500 }
    );
  }
}

// GET to check if user is following a niche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ following: false });
    }

    // Get niche by slug
    const niche = await db.query.niches.findFirst({
      where: eq(niches.slug, slug),
    });

    if (!niche) {
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    }

    // Check if following
    const existingFollow = await db.query.nicheFollows.findFirst({
      where: and(
        eq(nicheFollows.userId, userId),
        eq(nicheFollows.nicheId, niche.id)
      ),
    });

    return NextResponse.json({
      following: !!existingFollow,
      followersCount: niche.stats?.totalFollowers || 0,
    });
  } catch (error) {
    console.error("Failed to check follow status:", error);
    return NextResponse.json(
      { error: "Failed to check follow status" },
      { status: 500 }
    );
  }
}
