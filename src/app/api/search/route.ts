import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedItems, niches } from "@/lib/db/schema";
import { ilike, or, eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ papers: [], query: "" });
  }

  try {
    const searchTerm = `%${query.trim()}%`;
    
    // Search feed items by title, abstract, or authors
    const results = await db
      .select({
        id: feedItems.id,
        paperId: feedItems.paperId,
        title: feedItems.title,
        abstract: feedItems.abstract,
        tldr: feedItems.tldr,
        authors: feedItems.authors,
        year: feedItems.year,
        journalName: feedItems.journalName,
        citationCount: feedItems.citationCount,
        influentialCitationCount: feedItems.influentialCitationCount,
        link: feedItems.link,
        pdfLink: feedItems.pdfLink,
        isOpenAccess: feedItems.isOpenAccess,
        fieldsOfStudy: feedItems.fieldsOfStudy,
        quartileRanking: feedItems.quartileRanking,
        nicheId: feedItems.nicheId,
        nicheSlug: niches.slug,
        nicheName: niches.name,
        likesCount: feedItems.likesCount,
        commentsCount: feedItems.commentsCount,
        bookmarksCount: feedItems.bookmarksCount,
      })
      .from(feedItems)
      .leftJoin(niches, eq(feedItems.nicheId, niches.id))
      .where(
        or(
          ilike(feedItems.title, searchTerm),
          ilike(feedItems.abstract, searchTerm),
          ilike(feedItems.authors, searchTerm)
        )
      )
      .orderBy(desc(feedItems.citationCount))
      .limit(30);

    // Transform results to match expected format
    const papers = results.map((item) => ({
      id: item.id,
      paperId: item.paperId,
      title: item.title,
      abstract: item.abstract,
      tldr: item.tldr,
      authors: item.authors,
      year: item.year,
      journalName: item.journalName,
      citationCount: item.citationCount,
      influentialCitationCount: item.influentialCitationCount,
      link: item.link,
      pdfLink: item.pdfLink,
      isOpenAccess: item.isOpenAccess,
      fieldsOfStudy: item.fieldsOfStudy || [],
      quartileRanking: item.quartileRanking,
      nicheSlug: item.nicheSlug,
      nicheName: item.nicheName,
      likesCount: item.likesCount,
      commentsCount: item.commentsCount,
      bookmarksCount: item.bookmarksCount,
    }));

    return NextResponse.json({
      papers,
      query: query.trim(),
      total: papers.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search papers", papers: [], query },
      { status: 500 }
    );
  }
}
