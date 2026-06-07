/**
 * Script to update citation counts for existing papers
 * 
 * This script fetches the latest citation data from Veritus API
 * and updates the database for papers that have 0 citations.
 * 
 * Run with: npx tsx scripts/update-citations.ts
 */

import { db } from "../src/lib/db";
import { feedItems } from "../src/lib/db/schema";
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
      console.error(`API error: ${response.status}`);
      return null;
    }

    const papers: VeritusPaper[] = await response.json();
    return papers[0] || null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

async function updateCitations() {
  console.log("🔄 Fetching papers with 0 citations...\n");

  // Get papers with 0 citations
  const papersToUpdate = await db
    .select({
      id: feedItems.id,
      paperId: feedItems.paperId,
      title: feedItems.title,
      citationCount: feedItems.citationCount,
    })
    .from(feedItems)
    .where(eq(feedItems.citationCount, 0))
    .limit(50); // Process in batches

  console.log(`Found ${papersToUpdate.length} papers with 0 citations\n`);

  let updated = 0;
  let failed = 0;

  for (const paper of papersToUpdate) {
    console.log(`Processing: ${paper.title.substring(0, 50)}...`);

    // Rate limit: wait 6 seconds between requests (10 requests per minute)
    await new Promise((resolve) => setTimeout(resolve, 6000));

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

      if (citationCount > 0 || influentialCitationCount > 0) {
        await db
          .update(feedItems)
          .set({
            citationCount,
            influentialCitationCount,
            updatedAt: new Date(),
          })
          .where(eq(feedItems.id, paper.id));

        console.log(`  ✅ Updated: ${citationCount} citations, ${influentialCitationCount} influential`);
        updated++;
      } else {
        console.log(`  ⏭️  Still 0 citations from API`);
      }
    } else {
      console.log(`  ❌ Not found in Veritus`);
      failed++;
    }
  }

  console.log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}`);
}

// Run the script
updateCitations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });
