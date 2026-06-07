import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const VERITUS_API_URL = process.env.VERITUS_API_URL || "https://discover.veritus.ai/api";
const VERITUS_API_KEY = process.env.VERITUS_API_KEY || "";

interface VeritusPaper {
  id: string;
  title: string;
  impactFactor?: {
    citationCount: number;
    influentialCitationCount: number;
  };
  citationCount?: number;
  influentialCitationCount?: number;
}

async function searchPaperByTitle(title: string): Promise<VeritusPaper | null> {
  try {
    const response = await fetch(
      `${VERITUS_API_URL}/v1/papers/search?title=${encodeURIComponent(title)}`,
      {
        headers: {
          Authorization: `Bearer ${VERITUS_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const papers: VeritusPaper[] = await response.json();
    return papers[0] || null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

// POST /api/admin/refresh-citations
// Body: { paperId?: string, limit?: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paperId, limit = 10 } = body;

    let papersToUpdate;

    if (paperId) {
      // Update specific paper
      papersToUpdate = await db
        .select({
          id: feedItems.id,
          paperId: feedItems.paperId,
          title: feedItems.title,
        })
        .from(feedItems)
        .where(eq(feedItems.id, paperId))
        .limit(1);
    } else {
      // Update papers with 0 citations
      papersToUpdate = await db
        .select({
          id: feedItems.id,
          paperId: feedItems.paperId,
          title: feedItems.title,
        })
        .from(feedItems)
        .where(eq(feedItems.citationCount, 0))
        .limit(Math.min(limit, 20)); // Max 20 to avoid rate limits
    }

    const results = [];

    for (const paper of papersToUpdate) {
      // Rate limit: wait 6 seconds between requests
      if (results.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }

      const veritusData = await searchPaperByTitle(paper.title);

      if (veritusData) {
        const citationCount =
          veritusData.impactFactor?.citationCount ??
          veritusData.citationCount ??
          0;
        const influentialCitationCount =
          veritusData.impactFactor?.influentialCitationCount ??
          veritusData.influentialCitationCount ??
          0;

        await db
          .update(feedItems)
          .set({
            citationCount,
            influentialCitationCount,
            updatedAt: new Date(),
          })
          .where(eq(feedItems.id, paper.id));

        results.push({
          id: paper.id,
          title: paper.title.substring(0, 50),
          citationCount,
          influentialCitationCount,
          status: "updated",
        });
      } else {
        results.push({
          id: paper.id,
          title: paper.title.substring(0, 50),
          status: "not_found",
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.filter((r) => r.status === "updated").length,
      notFound: results.filter((r) => r.status === "not_found").length,
      results,
    });
  } catch (error) {
    console.error("Citation refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh citations" },
      { status: 500 }
    );
  }
}

// GET /api/admin/refresh-citations - Get stats on papers with 0 citations
export async function GET() {
  try {
    const zeroCitationCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(feedItems)
      .where(eq(feedItems.citationCount, 0));

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(feedItems);

    return NextResponse.json({
      totalPapers: totalCount[0]?.count || 0,
      papersWithZeroCitations: zeroCitationCount[0]?.count || 0,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
