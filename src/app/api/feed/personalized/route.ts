import { NextRequest, NextResponse } from "next/server";
import { getRecommendedFeed } from "@/lib/algorithm";

/**
 * Personalized feed endpoint using the recommendation algorithm
 * 
 * GET /api/feed/personalized?userId=xxx&page=1&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const excludeIds = searchParams.get("excludeIds")?.split(",").filter(Boolean) || [];

    const offset = (page - 1) * limit;

    const result = await getRecommendedFeed({
      userId: userId || undefined,
      limit,
      offset,
      excludeIds,
    });

    return NextResponse.json({
      items: result.items,
      pagination: {
        page,
        limit,
        hasMore: result.hasMore,
        totalCandidates: result.totalCandidates,
      },
    });
  } catch (error) {
    console.error("Failed to fetch personalized feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch personalized feed" },
      { status: 500 }
    );
  }
}
