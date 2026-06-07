/**
 * Script to check paper embeddings status and trigger backfill
 * 
 * Usage:
 *   bun run scripts/check-embeddings.ts        # Check status
 *   bun run scripts/check-embeddings.ts --backfill  # Trigger backfill
 * 
 * RAG PIPELINE EXPLANATION:
 * =========================
 * 
 * 1. EMBEDDING GENERATION (Indexing Phase):
 *    - When papers are fetched from Veritus API, they get stored in `feed_items`
 *    - Inngest function `generate-paper-embedding` is triggered
 *    - Paper content (title + abstract + tldr + authors) is combined
 *    - Google's text-embedding-004 model generates 768-dim vector
 *    - Vector stored in `paper_embeddings` table with pgvector
 * 
 * 2. VECTOR SEARCH (Retrieval Phase):
 *    - User sends a message to the AI chat
 *    - User's query is embedded using same model
 *    - pgvector performs cosine similarity search: 1 - (query <=> doc)
 *    - Top 5 most similar papers (similarity > 0.5) are retrieved
 * 
 * 3. CONTEXT INJECTION (Augmentation Phase):
 *    - Retrieved papers formatted as context string
 *    - Context injected into AI's system prompt
 *    - AI can now reference specific papers in its response
 * 
 * 4. GENERATION (Response Phase):
 *    - Gemini 2.5 Flash generates response with paper context
 *    - AI can cite papers, summarize findings, answer questions
 */

// Load environment variables FIRST before any other imports
import "dotenv/config";

import { db } from "../src/lib/db";
import { feedItems, paperEmbeddings, niches } from "../src/lib/db/schema";
import { eq, count } from "drizzle-orm";

async function checkEmbeddingsStatus() {
  console.log("\n📊 Paper Embeddings Status\n");
  console.log("=".repeat(50));

  // Get total papers count
  const [totalPapers] = await db
    .select({ count: count() })
    .from(feedItems);

  console.log(`\n📄 Total papers in database: ${totalPapers.count}`);

  // Get papers with embeddings
  const [embeddedPapers] = await db
    .select({ count: count() })
    .from(paperEmbeddings);

  console.log(`🔢 Papers with embeddings: ${embeddedPapers.count}`);

  // Get papers without embeddings
  const papersWithoutEmbeddings = Number(totalPapers.count) - Number(embeddedPapers.count);
  console.log(`⚠️ Papers without embeddings: ${papersWithoutEmbeddings}`);

  // Coverage percentage
  const coverage = (Number(embeddedPapers.count) / Number(totalPapers.count) * 100).toFixed(1);
  console.log(`\n📈 Embedding coverage: ${coverage}%`);

  // Per-niche breakdown
  console.log("\n📂 Per-Niche Breakdown:");
  console.log("-".repeat(50));

  const nicheStats = await db
    .select({
      nicheId: feedItems.nicheId,
      nicheName: niches.displayName,
      totalPapers: count(feedItems.id),
    })
    .from(feedItems)
    .innerJoin(niches, eq(feedItems.nicheId, niches.id))
    .groupBy(feedItems.nicheId, niches.displayName);

  for (const niche of nicheStats) {
    const [embeddedInNiche] = await db
      .select({ count: count() })
      .from(paperEmbeddings)
      .where(eq(paperEmbeddings.nicheId, niche.nicheId));

    const nicheEmbedded = Number(embeddedInNiche.count);
    const nicheTotal = Number(niche.totalPapers);
    const nicheCoverage = nicheTotal > 0 ? ((nicheEmbedded / nicheTotal) * 100).toFixed(0) : '0';

    console.log(`  ${niche.nicheName}: ${nicheEmbedded}/${nicheTotal} papers (${nicheCoverage}%)`);
  }

  // Sample some embeddings to verify they exist
  console.log("\n🔍 Sample Embeddings:");
  console.log("-".repeat(50));

  const sampleEmbeddings = await db
    .select({
      id: paperEmbeddings.id,
      feedItemId: paperEmbeddings.feedItemId,
      content: paperEmbeddings.content,
      createdAt: paperEmbeddings.createdAt,
    })
    .from(paperEmbeddings)
    .limit(3);

  if (sampleEmbeddings.length === 0) {
    console.log("  No embeddings found!");
  } else {
    sampleEmbeddings.forEach((emb, i) => {
      console.log(`  ${i + 1}. ${emb.content?.slice(0, 80)}...`);
      console.log(`     Created: ${emb.createdAt?.toISOString()}`);
    });
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n💡 To backfill embeddings, run:");
  console.log("   bun run scripts/check-embeddings.ts --backfill\n");
}

async function triggerBackfill() {
  console.log("\n🚀 Triggering Embedding Backfill...\n");

  // Get all niches
  const allNiches = await db.select().from(niches).where(eq(niches.isActive, true));

  console.log(`Found ${allNiches.length} active niches\n`);

  // Trigger backfill via the API (which will send to Inngest)
  const response = await fetch("http://localhost:3000/api/trigger-feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "backfill-embeddings" }),
  });

  if (!response.ok) {
    console.log("API endpoint not available. Sending directly to Inngest...\n");
    
    // Alternative: Send event directly
    const inngestResponse = await fetch(process.env.INNGEST_EVENT_API_URL || "http://localhost:8288/e/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "embeddings/backfill",
        data: { batchSize: 50 },
      }),
    });

    if (inngestResponse.ok) {
      console.log("✅ Backfill event sent to Inngest");
    } else {
      console.log("❌ Failed to send to Inngest. Make sure Inngest dev server is running:");
      console.log("   npx inngest-cli@latest dev");
    }
  } else {
    console.log("✅ Backfill triggered via API");
  }
}

// Main
const args = process.argv.slice(2);
if (args.includes("--backfill")) {
  triggerBackfill().catch(console.error);
} else {
  checkEmbeddingsStatus().catch(console.error);
}
