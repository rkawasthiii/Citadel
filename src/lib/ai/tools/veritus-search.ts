import { tool } from "ai";
import { z } from "zod";
import { veritusClient, type VeritusPaper } from "@/lib/veritus/client";

/**
 * Format paper results for AI response
 */
function formatPaperResults(papers: VeritusPaper[]) {
  return papers.map((paper) => ({
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    abstract: paper.abstract?.slice(0, 500) || null,
    tldr: paper.tldr,
    citationCount: paper.impactFactor?.citationCount || 0,
    influentialCitations: paper.impactFactor?.influentialCitationCount || 0,
    journal: paper.journalName,
    doi: paper.doi,
    link: paper.link || paper.semanticLink || paper.titleLink,
    pdfLink: paper.pdfLink,
    isOpenAccess: paper.isOpenAccess,
    fieldsOfStudy: paper.fieldsOfStudy,
    quartileRanking: paper.v_quartile_ranking,
  }));
}

/**
 * Quick paper search tool
 * Use for simple title-based searches
 */
export const veritusSearchTool = tool({
  description: `Search for academic papers using the Veritus API. Use this when:
    - The user asks about recent or specific papers not in the local database
    - The user wants to find papers on a specific topic
    - The user needs more papers than available in the context
    Returns paper metadata including title, abstract, authors, citations, and links.`,
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search query for finding papers (searches by title)"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Number of results to return (max 20 for quick search)"),
  }),
  execute: async (args) => {
    const { query, limit } = args;
    try {
      const papers = await veritusClient.searchPapers(query);

      if (!papers || papers.length === 0) {
        return {
          success: true,
          message: `No papers found for query: "${query}"`,
          papers: [],
        };
      }

      const limitedPapers = papers.slice(0, Math.min(limit || 10, 20));

      return {
        success: true,
        message: `Found ${papers.length} papers, showing top ${limitedPapers.length}`,
        papers: formatPaperResults(limitedPapers),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search papers: ${error instanceof Error ? error.message : "Unknown error"}`,
        papers: [],
      };
    }
  },
});

/**
 * Get a specific paper by ID tool
 */
export const veritusGetPaperTool = tool({
  description: `Get detailed information about a specific paper by its Semantic Scholar corpus ID.
    Use this when the user wants more details about a paper you've already mentioned.`,
  inputSchema: z.object({
    corpusId: z.string().describe("The Semantic Scholar corpus ID of the paper"),
  }),
  execute: async (args) => {
    const { corpusId } = args;
    try {
      const paper = await veritusClient.getPaper(corpusId);

      return {
        success: true,
        paper: {
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          abstract: paper.abstract,
          tldr: paper.tldr,
          citationCount: paper.impactFactor?.citationCount || 0,
          influentialCitations:
            paper.impactFactor?.influentialCitationCount || 0,
          referenceCount: paper.impactFactor?.referenceCount || 0,
          journal: paper.journalName,
          doi: paper.doi,
          link: paper.link || paper.semanticLink || paper.titleLink,
          pdfLink: paper.pdfLink,
          isOpenAccess: paper.isOpenAccess,
          fieldsOfStudy: paper.fieldsOfStudy,
          quartileRanking: paper.v_quartile_ranking,
          publisher: paper.v_publisher,
          country: paper.v_country,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get paper: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
