import { inngest } from "./client";
import { db } from "@/lib/db";
import { feedItems, paperEmbeddings } from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { generateEmbedding, preparePaperContent } from "@/lib/ai/embeddings";

// ============================================================================
// INNGEST FUNCTIONS FOR EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a single paper
 * Triggered when a new paper is inserted via niche feed population
 */
export const generatePaperEmbedding = inngest.createFunction(
  {
    id: "generate-paper-embedding",
    name: "Generate Paper Embedding",
    retries: 3,
    concurrency: {
      limit: 5, // Process 5 embeddings concurrently (free plan limit)
    },
    // Rate limit: max 100 per minute (Google's limit is ~1500/min)
    rateLimit: {
      limit: 100,
      period: "1m",
    },
  },
  { event: "paper/embedding.generate" },
  async ({ event, step }) => {
    const { feedItemId, nicheId } = event.data;

    // Step 1: Get the paper from database
    const paper = await step.run("fetch-paper", async () => {
      const [result] = await db
        .select({
          id: feedItems.id,
          title: feedItems.title,
          abstract: feedItems.abstract,
          tldr: feedItems.tldr,
          authors: feedItems.authors,
          nicheId: feedItems.nicheId,
        })
        .from(feedItems)
        .where(eq(feedItems.id, feedItemId))
        .limit(1);
      return result;
    });

    if (!paper) {
      console.log(`  ⚠️ Paper not found: ${feedItemId}`);
      return { status: "not_found", feedItemId };
    }

    // Step 2: Check if embedding already exists
    const existingEmbedding = await step.run("check-existing", async () => {
      const [existing] = await db
        .select({ id: paperEmbeddings.id })
        .from(paperEmbeddings)
        .where(eq(paperEmbeddings.feedItemId, feedItemId))
        .limit(1);
      return existing;
    });

    if (existingEmbedding) {
      console.log(`  ⏭️ Embedding already exists for: ${feedItemId}`);
      return { status: "already_exists", feedItemId };
    }

    // Step 3: Prepare content and generate embedding
    const content = preparePaperContent({
      title: paper.title,
      abstract: paper.abstract,
      tldr: paper.tldr,
      authors: paper.authors,
    });

    const embedding = await step.run("generate-embedding", async () => {
      return generateEmbedding(content);
    });

    // Step 4: Store embedding in database
    await step.run("store-embedding", async () => {
      await db.insert(paperEmbeddings).values({
        feedItemId: feedItemId,
        nicheId: nicheId || paper.nicheId,
        content: content,
        embedding: embedding,
      });
    });

    console.log(
      `  ✅ Embedding generated for paper: ${paper.title.slice(0, 50)}...`
    );
    return {
      status: "success",
      feedItemId,
      title: paper.title,
      contentLength: content.length,
      embeddingDimensions: embedding.length,
    };
  }
);

/**
 * Batch backfill embeddings for existing papers without embeddings
 * Triggered manually or on schedule
 */
export const backfillPaperEmbeddings = inngest.createFunction(
  {
    id: "backfill-paper-embeddings",
    name: "Backfill Paper Embeddings",
    retries: 2,
    concurrency: {
      limit: 1, // Only one backfill job at a time
    },
  },
  { event: "embeddings/backfill" },
  async ({ event, step }) => {
    const { nicheId, batchSize = 50 } = event.data;

    console.log(
      `\n🔄 Starting embedding backfill (nicheId: ${nicheId || "all"}, batchSize: ${batchSize})`
    );

    // Step 1: Get papers without embeddings
    const papers = await step.run(
      "fetch-papers-without-embeddings",
      async () => {
        // Left join to find papers without embeddings
        const query = db
          .select({
            id: feedItems.id,
            title: feedItems.title,
            abstract: feedItems.abstract,
            tldr: feedItems.tldr,
            authors: feedItems.authors,
            nicheId: feedItems.nicheId,
          })
          .from(feedItems)
          .leftJoin(
            paperEmbeddings,
            eq(feedItems.id, paperEmbeddings.feedItemId)
          )
          .where(isNull(paperEmbeddings.id))
          .limit(batchSize);

        return query;
      }
    );

    if (papers.length === 0) {
      console.log("  ✅ All papers have embeddings!");
      return { status: "complete", processed: 0, remaining: 0 };
    }

    console.log(`  📦 Found ${papers.length} papers to embed`);

    // Step 2: Process each paper with rate limiting
    let processed = 0;
    let failed = 0;

    for (const paper of papers) {
      try {
        // Check if niche filter applies
        if (nicheId && paper.nicheId !== nicheId) {
          continue;
        }

        const content = preparePaperContent({
          title: paper.title,
          abstract: paper.abstract,
          tldr: paper.tldr,
          authors: paper.authors,
        });

        const embedding = await step.run(
          `generate-embedding-${paper.id}`,
          async () => {
            return generateEmbedding(content);
          }
        );

        await step.run(`store-embedding-${paper.id}`, async () => {
          await db.insert(paperEmbeddings).values({
            feedItemId: paper.id,
            nicheId: paper.nicheId,
            content: content,
            embedding: embedding,
          });
        });

        processed++;
        console.log(`  ✅ [${processed}/${papers.length}] ${paper.title.slice(0, 40)}...`);

        // Rate limit: wait 100ms between embeddings
        await step.sleep("rate-limit", "100ms");
      } catch (error) {
        failed++;
        console.error(`  ❌ Failed to embed paper ${paper.id}:`, error);
      }
    }

    // Step 3: Check if there are more papers to process
    const remaining = await step.run("count-remaining", async () => {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems)
        .leftJoin(paperEmbeddings, eq(feedItems.id, paperEmbeddings.feedItemId))
        .where(isNull(paperEmbeddings.id));
      return Number(result.count);
    });

    // Step 4: Continue backfill if more papers exist
    if (remaining > 0) {
      await step.sendEvent("continue-backfill", {
        name: "embeddings/backfill",
        data: { nicheId, batchSize },
      });
      console.log(`  🔄 Continuing backfill... ${remaining} papers remaining`);
    }

    return {
      status: remaining > 0 ? "batch_complete" : "complete",
      processed,
      failed,
      remaining,
    };
  }
);

/**
 * Scheduled: Daily embedding maintenance
 * Ensures all papers have embeddings, cleans up orphaned embeddings
 */
export const dailyEmbeddingMaintenance = inngest.createFunction(
  {
    id: "daily-embedding-maintenance",
    name: "Daily Embedding Maintenance",
    retries: 1,
  },
  { cron: "TZ=UTC 0 4 * * *" }, // Every day at 4 AM UTC (after feed population)
  async ({ step }) => {
    console.log("🧹 Starting daily embedding maintenance...");

    // Step 1: Count papers without embeddings
    const stats = await step.run("get-embedding-stats", async () => {
      const [withoutEmbeddings] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems)
        .leftJoin(paperEmbeddings, eq(feedItems.id, paperEmbeddings.feedItemId))
        .where(isNull(paperEmbeddings.id));

      const [totalPapers] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems);

      const [totalEmbeddings] = await db
        .select({ count: sql<number>`count(*)` })
        .from(paperEmbeddings);

      return {
        papersWithoutEmbeddings: Number(withoutEmbeddings.count),
        totalPapers: Number(totalPapers.count),
        totalEmbeddings: Number(totalEmbeddings.count),
      };
    });

    console.log(`  📊 Stats:
    - Total papers: ${stats.totalPapers}
    - Total embeddings: ${stats.totalEmbeddings}
    - Papers without embeddings: ${stats.papersWithoutEmbeddings}`);

    // Step 2: Trigger backfill if needed
    if (stats.papersWithoutEmbeddings > 0) {
      await step.sendEvent("trigger-backfill", {
        name: "embeddings/backfill",
        data: { batchSize: 100 },
      });
      console.log(
        `  🔄 Triggered backfill for ${stats.papersWithoutEmbeddings} papers`
      );
    }

    return {
      status: "complete",
      stats,
      backfillTriggered: stats.papersWithoutEmbeddings > 0,
    };
  }
);

// Export all embedding functions
export const embeddingFunctions = [
  generatePaperEmbedding,
  backfillPaperEmbeddings,
  dailyEmbeddingMaintenance,
];
