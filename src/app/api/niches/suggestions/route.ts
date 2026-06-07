import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { niches } from "@/lib/db/schema";
import { desc, sql, ne } from "drizzle-orm";

// Get suggested niches (popular niches the user doesn't follow)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");
    const excludeSlug = searchParams.get("exclude"); // Current niche to exclude

    // Get popular niches ordered by follower count
    // In production, you'd filter out niches the user already follows
    const suggestedNiches = await db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        displayName: niches.displayName,
        description: niches.description,
        avatarColor: niches.avatarColor,
        avatarInitials: niches.avatarInitials,
        stats: niches.stats,
        metadata: niches.metadata,
      })
      .from(niches)
      .where(excludeSlug ? ne(niches.slug, excludeSlug) : undefined)
      .orderBy(desc(sql`(${niches.stats}->>'totalFollowers')::int`))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: suggestedNiches,
    });
  } catch (error) {
    console.error("Error fetching niche suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
