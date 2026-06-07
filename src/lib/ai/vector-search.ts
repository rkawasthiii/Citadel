import { db } from "@/lib/db";
import { paperEmbeddings, feedItems } from "@/lib/db/schema";
import { sql, desc, and, eq, gt } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

export interface SimilarPaper {
  feedItemId: string;
  title: string;
  abstract: string | null;
  tldr: string | null;
  authors: string;
  similarity: number;
  pdfLink: string | null;
  link: string | null;
  year: number | null;
  citationCount: number;
}

/**
 * Search for papers similar to a query using vector similarity
 * Uses pgvector's cosine distance for semantic search
 */
export async function searchSimilarPapers(
  query: string,
  nicheId: string,
  limit: number = 5,
  minSimilarity: number = 0.6
): Promise<SimilarPaper[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Cosine similarity: 1 - cosine_distance
  // pgvector uses <=> for cosine distance
  const similarity = sql<number>`1 - (${paperEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

  const results = await db
    .select({
      feedItemId: paperEmbeddings.feedItemId,
      title: feedItems.title,
      abstract: feedItems.abstract,
      tldr: feedItems.tldr,
      authors: feedItems.authors,
      pdfLink: feedItems.pdfLink,
      link: feedItems.link,
      year: feedItems.year,
      citationCount: feedItems.citationCount,
      similarity,
    })
    .from(paperEmbeddings)
    .innerJoin(feedItems, eq(paperEmbeddings.feedItemId, feedItems.id))
    .where(
      and(
        eq(paperEmbeddings.nicheId, nicheId),
        gt(similarity, minSimilarity)
      )
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return results;
}

/**
 * Search similar papers across all niches (for global search)
 */
export async function searchSimilarPapersGlobal(
  query: string,
  limit: number = 10,
  minSimilarity: number = 0.6
): Promise<SimilarPaper[]> {
  const queryEmbedding = await generateEmbedding(query);

  const similarity = sql<number>`1 - (${paperEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

  const results = await db
    .select({
      feedItemId: paperEmbeddings.feedItemId,
      title: feedItems.title,
      abstract: feedItems.abstract,
      tldr: feedItems.tldr,
      authors: feedItems.authors,
      pdfLink: feedItems.pdfLink,
      link: feedItems.link,
      year: feedItems.year,
      citationCount: feedItems.citationCount,
      similarity,
    })
    .from(paperEmbeddings)
    .innerJoin(feedItems, eq(paperEmbeddings.feedItemId, feedItems.id))
    .where(gt(similarity, minSimilarity))
    .orderBy(desc(similarity))
    .limit(limit);

  return results;
}

/**
 * Get papers by IDs with their embeddings
 * Useful for building context from specific papers
 */
export async function getPapersWithContext(
  feedItemIds: string[]
): Promise<
  Array<{
    id: string;
    title: string;
    abstract: string | null;
    tldr: string | null;
    authors: string;
    year: number | null;
    citationCount: number;
    link: string | null;
    pdfLink: string | null;
  }>
> {
  if (feedItemIds.length === 0) return [];

  const results = await db
    .select({
      id: feedItems.id,
      title: feedItems.title,
      abstract: feedItems.abstract,
      tldr: feedItems.tldr,
      authors: feedItems.authors,
      year: feedItems.year,
      citationCount: feedItems.citationCount,
      link: feedItems.link,
      pdfLink: feedItems.pdfLink,
    })
    .from(feedItems)
    .where(sql`${feedItems.id} = ANY(${feedItemIds})`);

  return results;
}

/**
 * Format papers as context string for AI
 */
export function formatPapersAsContext(
  papers: Array<{
    title: string;
    authors: string;
    year: number | null;
    tldr?: string | null;
    abstract?: string | null;
    citationCount?: number;
    link?: string | null;
  }>
): string {
  if (papers.length === 0) return "";

  return papers
    .map((paper, index) => {
      const parts = [
        `[${index + 1}] "${paper.title}"`,
        `   Authors: ${paper.authors}`,
      ];

      if (paper.year) {
        parts.push(`   Year: ${paper.year}`);
      }

      if (paper.citationCount) {
        parts.push(`   Citations: ${paper.citationCount}`);
      }

      if (paper.tldr) {
        parts.push(`   Summary: ${paper.tldr}`);
      } else if (paper.abstract) {
        // Use first 500 chars of abstract if no tldr
        parts.push(`   Abstract: ${paper.abstract.slice(0, 500)}...`);
      }

      if (paper.link) {
        parts.push(`   Link: ${paper.link}`);
      }

      return parts.join("\n");
    })
    .join("\n\n");
}
