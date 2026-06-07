import { inngest } from "./client";
import { veritusClient, type VeritusPaper } from "@/lib/veritus/client";
import { db } from "@/lib/db";
import { feedItems, feedJobs, niches, nicheFollows } from "@/lib/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";

// ============================================================================
// CONFIGURATION
// ============================================================================

// All fields of study from Veritus API
export const ALL_FIELDS_OF_STUDY = [
  "Computer Science",
  "Medicine",
  "Chemistry",
  "Biology",
  "Materials Science",
  "Physics",
  "Geology",
  "Psychology",
  "Art",
  "History",
  "Geography",
  "Sociology",
  "Business",
  "Political Science",
  "Economics",
  "Philosophy",
  "Mathematics",
  "Engineering",
  "Environmental Science",
  "Agricultural and Food Sciences",
  "Education",
  "Law",
  "Linguistics",
] as const;

// Get the callback URL for Veritus webhooks
const getCallbackUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!baseUrl) {
    console.warn('⚠️ No callback URL configured - will use polling instead');
    return undefined;
  }
  // Veritus requires HTTPS callback URLs (no localhost)
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return undefined; // Use polling for local development
  }
  return `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/webhooks/veritus`;
};

// Configuration for each field with dynamic queries and extended phrases
const FIELD_CONFIG: Record<
  string,
  {
    phrases: string[];
    query: string;
    avatarColor: string;
    category: string;
  }
> = {
  "Computer Science": {
    phrases: ["machine learning", "artificial intelligence", "algorithms", "deep learning", "neural networks"],
    query: "Latest breakthrough research in computer science including machine learning, artificial intelligence, deep learning neural networks, distributed systems, cybersecurity, and software engineering methodologies",
    avatarColor: "#3B82F6",
    category: "Technology",
  },
  Medicine: {
    phrases: ["clinical trials", "medical research", "healthcare", "therapeutics", "patient outcomes"],
    query: "Recent advances in medical research including clinical trials, drug development, therapeutic interventions, patient care improvements, disease prevention, and healthcare delivery systems",
    avatarColor: "#EF4444",
    category: "Health Sciences",
  },
  Chemistry: {
    phrases: ["chemical reactions", "molecular structure", "synthesis", "catalysis", "organic chemistry"],
    query: "Latest discoveries in chemistry including molecular synthesis, chemical reactions, catalysis mechanisms, organic and inorganic chemistry, materials characterization, and green chemistry approaches",
    avatarColor: "#F59E0B",
    category: "Physical Sciences",
  },
  Biology: {
    phrases: ["molecular biology", "genetics", "cell biology", "genomics", "proteomics"],
    query: "Recent advances in biological sciences including molecular biology, genetics, genomics, proteomics, cell signaling pathways, evolutionary biology, and biotechnology applications",
    avatarColor: "#10B981",
    category: "Life Sciences",
  },
  "Materials Science": {
    phrases: ["nanomaterials", "composites", "material properties", "polymers", "semiconductors"],
    query: "Cutting-edge research in materials science including nanomaterials, advanced composites, polymer engineering, semiconductor materials, biomaterials, and materials characterization techniques",
    avatarColor: "#6366F1",
    category: "Engineering",
  },
  Physics: {
    phrases: ["quantum mechanics", "particle physics", "thermodynamics", "astrophysics", "condensed matter"],
    query: "Latest discoveries in physics including quantum mechanics, particle physics, thermodynamics, astrophysics, condensed matter physics, and theoretical physics breakthroughs",
    avatarColor: "#8B5CF6",
    category: "Physical Sciences",
  },
  Geology: {
    phrases: ["earth science", "geological formations", "mineralogy", "geophysics", "paleontology"],
    query: "Recent advances in geological sciences including earth science, geological formations, mineralogy, geophysics, paleontology, plate tectonics, and natural hazards research",
    avatarColor: "#78716C",
    category: "Earth Sciences",
  },
  Psychology: {
    phrases: ["cognitive psychology", "behavioral science", "neuroscience", "mental health", "developmental psychology"],
    query: "Latest research in psychology including cognitive psychology, behavioral science, neuroscience, mental health interventions, developmental psychology, and clinical psychology applications",
    avatarColor: "#EC4899",
    category: "Social Sciences",
  },
  Art: {
    phrases: ["art history", "visual arts", "contemporary art", "art theory", "cultural studies"],
    query: "Recent scholarship in art and visual culture including art history, contemporary art movements, visual arts theory, cultural studies, museum studies, and aesthetic philosophy",
    avatarColor: "#F43F5E",
    category: "Arts & Humanities",
  },
  History: {
    phrases: ["historical analysis", "historiography", "cultural history", "social history", "world history"],
    query: "Latest historical research including historical analysis methodologies, historiography, cultural and social history, world history perspectives, and historical archaeology findings",
    avatarColor: "#92400E",
    category: "Arts & Humanities",
  },
  Geography: {
    phrases: ["spatial analysis", "human geography", "geospatial", "urban geography", "environmental geography"],
    query: "Recent advances in geographical sciences including spatial analysis, human geography, geospatial technologies, urban geography, environmental geography, and geographic information systems",
    avatarColor: "#059669",
    category: "Earth Sciences",
  },
  Sociology: {
    phrases: ["social theory", "sociological research", "social structure", "social inequality", "community studies"],
    query: "Latest sociological research including social theory, sociological methods, social structure analysis, social inequality studies, community dynamics, and social change mechanisms",
    avatarColor: "#7C3AED",
    category: "Social Sciences",
  },
  Business: {
    phrases: ["business strategy", "management", "entrepreneurship", "organizational behavior", "marketing"],
    query: "Recent advances in business research including strategic management, organizational behavior, entrepreneurship, marketing strategies, innovation management, and corporate sustainability",
    avatarColor: "#0891B2",
    category: "Business & Economics",
  },
  "Political Science": {
    phrases: ["political theory", "governance", "public policy", "international relations", "comparative politics"],
    query: "Latest political science research including political theory, governance systems, public policy analysis, international relations, comparative politics, and political behavior studies",
    avatarColor: "#DC2626",
    category: "Social Sciences",
  },
  Economics: {
    phrases: ["economic theory", "macroeconomics", "market analysis", "behavioral economics", "development economics"],
    query: "Recent advances in economic research including macroeconomic theory, market analysis, behavioral economics, development economics, econometrics, and economic policy evaluation",
    avatarColor: "#16A34A",
    category: "Business & Economics",
  },
  Philosophy: {
    phrases: ["philosophical theory", "ethics", "metaphysics", "epistemology", "logic"],
    query: "Latest philosophical research including philosophical theory, ethics and moral philosophy, metaphysics, epistemology, logic and reasoning, and philosophy of mind and language",
    avatarColor: "#9333EA",
    category: "Arts & Humanities",
  },
  Mathematics: {
    phrases: ["mathematical theory", "applied mathematics", "statistics", "probability theory", "mathematical modeling"],
    query: "Recent advances in mathematics including pure mathematical theory, applied mathematics, statistical methods, probability theory, mathematical modeling, and computational mathematics",
    avatarColor: "#2563EB",
    category: "Physical Sciences",
  },
  Engineering: {
    phrases: ["engineering design", "systems engineering", "innovation", "mechanical engineering", "electrical engineering"],
    query: "Latest engineering research including systems engineering, mechanical engineering, electrical engineering, civil engineering, biomedical engineering, and sustainable engineering solutions",
    avatarColor: "#EA580C",
    category: "Engineering",
  },
  "Environmental Science": {
    phrases: ["climate change", "sustainability", "ecology", "conservation", "environmental policy"],
    query: "Recent advances in environmental science including climate change research, sustainability studies, ecology, biodiversity conservation, environmental policy, and ecosystem management",
    avatarColor: "#15803D",
    category: "Earth Sciences",
  },
  "Agricultural and Food Sciences": {
    phrases: ["food science", "agriculture", "crop science", "food technology", "sustainable agriculture"],
    query: "Latest agricultural research including food science, crop science, sustainable agriculture, food technology, agricultural biotechnology, and food safety and nutrition studies",
    avatarColor: "#84CC16",
    category: "Life Sciences",
  },
  Education: {
    phrases: ["educational research", "pedagogy", "learning theory", "curriculum development", "educational technology"],
    query: "Recent advances in education research including pedagogy, learning theory, curriculum development, educational technology, assessment methods, and inclusive education practices",
    avatarColor: "#0EA5E9",
    category: "Social Sciences",
  },
  Law: {
    phrases: ["legal theory", "jurisprudence", "constitutional law", "international law", "human rights"],
    query: "Latest legal research including legal theory, jurisprudence, constitutional law, international law, human rights law, corporate law, and legal policy analysis",
    avatarColor: "#475569",
    category: "Law & Politics",
  },
  Linguistics: {
    phrases: ["language theory", "phonetics", "syntax", "semantics", "computational linguistics"],
    query: "Recent advances in linguistics including language theory, phonetics and phonology, syntax, semantics, computational linguistics, sociolinguistics, and language acquisition",
    avatarColor: "#DB2777",
    category: "Arts & Humanities",
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find or create a niche for a field of study
 */
async function findOrCreateNiche(fieldOfStudy: string): Promise<string> {
  const slug = fieldOfStudy.toLowerCase().replace(/\s+/g, "-");

  // Check if niche exists
  const existingNiche = await db.query.niches.findFirst({
    where: eq(niches.slug, slug),
  });

  if (existingNiche) return existingNiche.id;

  // Create new niche
  const config = FIELD_CONFIG[fieldOfStudy] || {
    phrases: [],
    avatarColor: "#6366F1",
    category: "General",
  };

  const initials = fieldOfStudy
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const [newNiche] = await db
    .insert(niches)
    .values({
      slug,
      name: fieldOfStudy,
      displayName: fieldOfStudy,
      description: `Latest research papers in ${fieldOfStudy}`,
      avatarInitials: initials,
      avatarColor: config.avatarColor,
      categoryType: "field",
      metadata: {
        fieldsOfStudy: [fieldOfStudy],
      },
    })
    .returning();

  console.log(`✨ Created niche: ${fieldOfStudy} (${newNiche.id})`);
  return newNiche.id;
}

/**
 * Sanitize text for PostgreSQL - remove null bytes and invalid UTF-8 sequences
 */
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove null bytes (\x00) which are invalid in PostgreSQL text fields
  // Also remove other control characters except newlines and tabs
  return text
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Remove other control chars except \t, \n, \r
}

/**
 * Sanitize text, returning null if empty (for optional fields)
 */
function sanitizeTextOptional(text: string | null | undefined): string | null {
  if (!text) return null;
  const sanitized = text
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return sanitized || null;
}

/**
 * Check if a paper already exists in the database
 */
async function paperExists(paperId: string): Promise<boolean> {
  const existing = await db.query.feedItems.findFirst({
    where: eq(feedItems.paperId, paperId),
    columns: { id: true },
  });
  return !!existing;
}

/**
 * Insert a paper into the database (with duplicate prevention)
 * Returns the feedItemId if inserted, null if duplicate
 */
async function insertPaper(
  paper: VeritusPaper,
  nicheId: string
): Promise<{ inserted: boolean; feedItemId?: string }> {
  try {
    // Check for duplicates first
    if (await paperExists(paper.id)) {
      console.log(`  ⏭️  Paper already exists: ${paper.id}`);
      return { inserted: false };
    }

    // Sanitize text fields to remove null bytes and invalid characters
    const sanitizedTitle = sanitizeText(paper.title) || 'Untitled';
    const sanitizedAbstract = sanitizeTextOptional(paper.abstract);
    const sanitizedTldr = sanitizeTextOptional(paper.tldr);
    const sanitizedAuthors = sanitizeText(paper.authors) || 'Unknown';
    const sanitizedJournalName = sanitizeTextOptional(paper.journalName);

    const [inserted] = await db
      .insert(feedItems)
      .values({
        nicheId,
        paperId: paper.id,
        title: sanitizedTitle,
        abstract: sanitizedAbstract,
        authors: sanitizedAuthors,
        doi: paper.doi,
        journalName: sanitizedJournalName,
        year: paper.year,
        // Handle both direct citationCount and impactFactor.citationCount
        citationCount: paper.impactFactor?.citationCount ?? (paper as any).citationCount ?? 0,
        influentialCitationCount: paper.impactFactor?.influentialCitationCount ?? (paper as any).influentialCitationCount ?? 0,
        isOpenAccess: paper.isOpenAccess || false,
        pdfLink: paper.pdfLink,
        link: paper.link,
        tldr: sanitizedTldr,
        fieldsOfStudy: paper.fieldsOfStudy || [],
        quartileRanking: paper.v_quartile_ranking,
        publicationType: paper.publicationType,
      })
      .onConflictDoUpdate({
        target: feedItems.paperId,
        set: {
          // Also update citation counts on conflict
          citationCount: paper.impactFactor?.citationCount ?? (paper as any).citationCount ?? 0,
          influentialCitationCount: paper.impactFactor?.influentialCitationCount ?? (paper as any).influentialCitationCount ?? 0,
          updatedAt: new Date(),
        },
      })
      .returning({ id: feedItems.id });

    if (inserted) {
      return { inserted: true, feedItemId: inserted.id };
    }
    return { inserted: false };
  } catch (error) {
    console.error(`  ❌ Failed to insert paper ${paper.id}:`, error);
    return { inserted: false };
  }
}

// ============================================================================
// SCHEDULED WORKFLOWS
// ============================================================================

/**
 * DAILY: Populate feeds for all niches
 * Runs every day at 3 AM UTC
 * Fetches 100 papers per field of study
 */
export const dailyNicheFeedPopulation = inngest.createFunction(
  {
    id: "daily-niche-feed-population",
    name: "Daily Niche Feed Population",
    retries: 3,
  },
  { cron: "TZ=UTC 0 3 * * *" }, // Every day at 3 AM UTC
  async ({ step }) => {
    console.log("🌅 Starting daily niche feed population...");

    // Step 1: Ensure all niches exist
    const nicheIds = await step.run("create-all-niches", async () => {
      const ids: Record<string, string> = {};
      for (const field of ALL_FIELDS_OF_STUDY) {
        ids[field] = await findOrCreateNiche(field);
      }
      return ids;
    });

    // Step 2: Trigger a job for each field of study (fan-out pattern)
    const jobIds = await step.run("trigger-field-jobs", async () => {
      const events = ALL_FIELDS_OF_STUDY.map((field) => ({
        name: "niche/populate.field",
        data: {
          fieldOfStudy: field,
          nicheId: nicheIds[field],
          limit: 50, // Reduced from 100 to prevent timeouts
          priority: "daily",
        },
      }));

      await inngest.send(events);
      return events.map((e) => e.data.fieldOfStudy);
    });

    return {
      success: true,
      nichesProcessed: ALL_FIELDS_OF_STUDY.length,
      jobsTriggered: jobIds,
    };
  }
);

/**
 * WEEKLY: Deep refresh for high-quality papers
 * Runs every Sunday at 2 AM UTC
 * Fetches 300 papers per field with higher quality filters
 */
export const weeklyHighQualityRefresh = inngest.createFunction(
  {
    id: "weekly-high-quality-refresh",
    name: "Weekly High-Quality Paper Refresh",
    retries: 3,
  },
  { cron: "TZ=UTC 0 2 * * 0" }, // Every Sunday at 2 AM UTC
  async ({ step }) => {
    console.log("📚 Starting weekly high-quality refresh...");

    // Step 1: Get top 10 most followed niches
    const topNiches = await step.run("get-top-niches", async () => {
      const result = await db
        .select({
          nicheId: nicheFollows.nicheId,
          niche: niches,
          followerCount: sql<number>`COUNT(${nicheFollows.userId})`.as(
            "follower_count"
          ),
        })
        .from(nicheFollows)
        .innerJoin(niches, eq(nicheFollows.nicheId, niches.id))
        .groupBy(nicheFollows.nicheId, niches.id)
        .orderBy(desc(sql`COUNT(${nicheFollows.userId})`))
        .limit(10);

      return result;
    });

    // Step 2: Trigger high-quality jobs for popular niches
    await step.run("trigger-hq-jobs", async () => {
      const events = topNiches.map((item) => ({
        name: "niche/populate.field",
        data: {
          fieldOfStudy: item.niche.name,
          nicheId: item.nicheId,
          limit: 100, // Reduced from 300 to prevent timeouts
          priority: "high-quality",
          filters: {
            minCitationCount: 50,
            quartileRanking: ["Q1", "Q2"],
            openAccessPdf: true,
          },
        },
      }));

      await inngest.send(events);
      return events.length;
    });

    return {
      success: true,
      topNichesProcessed: topNiches.length,
    };
  }
);

/**
 * HOURLY: Quick refresh for trending content
 * Runs every hour
 * Fetches recent papers (last 6 months) with high citation counts
 */
export const hourlyTrendingRefresh = inngest.createFunction(
  {
    id: "hourly-trending-refresh",
    name: "Hourly Trending Paper Refresh",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour at :00
  async ({ step }) => {
    console.log("🔥 Starting hourly trending refresh...");

    // Get random 5 fields to refresh each hour
    const fieldsToRefresh = await step.run("select-random-fields", async () => {
      const shuffled = [...ALL_FIELDS_OF_STUDY].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 5);
    });

    // Trigger jobs for selected fields
    await step.run("trigger-trending-jobs", async () => {
      for (const field of fieldsToRefresh) {
        const nicheId = await findOrCreateNiche(field);

        await inngest.send({
          name: "niche/populate.field",
          data: {
            fieldOfStudy: field,
            nicheId,
            limit: 50, // Reduced from 100 to prevent timeouts
            priority: "trending",
            filters: {
              year: `${new Date().getFullYear() - 1}:${new Date().getFullYear()}`,
              sort: "citationCount:desc",
            },
          },
        });
      }
    });

    return {
      success: true,
      fieldsRefreshed: fieldsToRefresh,
    };
  }
);

/**
 * EVENT-DRIVEN: Populate a specific field's feed
 * Triggered by scheduled jobs or manual requests
 */
export const populateFieldFeed = inngest.createFunction(
  {
    id: "populate-field-feed",
    name: "Populate Field Feed",
    retries: 3,
    // Prevent duplicate jobs for same field within 30 minutes
    idempotency: "event.data.fieldOfStudy + event.data.priority",
    // Rate limit to respect Veritus API limits (10 req/min)
    concurrency: {
      limit: 2, // Only 2 concurrent jobs to stay well under 10 req/min
    },
    rateLimit: {
      limit: 8, // Max 8 jobs per minute (leaves room for other API calls)
      period: "1m",
    },
  },
  { event: "niche/populate.field" },
  async ({ event, step }) => {
    const { fieldOfStudy, nicheId, limit = 100, priority, filters = {} } = event.data;

    console.log(`\n📖 Populating feed for: ${fieldOfStudy} (Priority: ${priority})`);

    // Step 1: Create Veritus job with callback URL support
    const jobResponse = await step.run("create-veritus-job", async () => {
      const config = FIELD_CONFIG[fieldOfStudy];
      
      // Get phrases (3-10 required for combinedSearch)
      const phrases = config?.phrases || [
        `${fieldOfStudy} research`,
        `${fieldOfStudy} advances`,
        `${fieldOfStudy} studies`,
      ];
      
      // Use pre-configured query or generate dynamic one (50+ chars required)
      const query = config?.query || 
        `Latest cutting-edge research papers and publications in the field of ${fieldOfStudy}, including recent advances, breakthrough discoveries, and innovative methodologies in academic research`;
      
      // Get callback URL (only for production - Veritus requires HTTPS)
      const callbackUrl = getCallbackUrl();
      
      console.log(`  📝 Query: ${query.substring(0, 50)}...`);
      console.log(`  🏷️  Phrases: ${phrases.join(', ')}`);
      console.log(`  🔗 Callback: ${callbackUrl || 'Using polling (local dev)'}`);

      const response = await veritusClient.createJob(
        "combinedSearch",
        {
          phrases: phrases.length >= 3 ? phrases : [...phrases, `${fieldOfStudy} methodology`, `${fieldOfStudy} analysis`, `${fieldOfStudy} findings`].slice(0, 5),
          query,
          callbackUrl, // Will notify webhook when complete
          enrich: true, // Always enrich for better data quality
        },
        {
          limit,
          fieldsOfStudy: [fieldOfStudy],
          minCitationCount: filters.minCitationCount,
          openAccessPdf: filters.openAccessPdf,
          quartileRanking: filters.quartileRanking?.join(","),
          year: filters.year,
          sort: filters.sort || "citationCount:desc",
        }
      );

      // Save job to database
      await db.insert(feedJobs).values({
        // userId is null for system-generated jobs
        veritusJobId: response.jobId,
        status: "queued",
        jobType: "combinedSearch",
        params: {
          nicheId,
          filters: {
            fieldsOfStudy: [fieldOfStudy],
            ...filters,
          },
        },
      });

      return { ...response, callbackUrl };
    });

    // Step 2: Wait for webhook callback or poll as fallback
    let results;
    
    if (jobResponse.callbackUrl) {
      // Production: Wait for webhook event (no polling!)
      console.log(`  ⏳ Waiting for webhook callback...`);
      
      const webhookEvent = await step.waitForEvent("wait-for-veritus-webhook", {
        event: "veritus/job.completed",
        timeout: "30m", // Wait up to 30 minutes for long-running jobs
        if: `async.data.jobId == "${jobResponse.jobId}"`,
      });

      if (!webhookEvent) {
        // Don't throw error - just log and continue with empty results
        console.log(`  ⚠️ Webhook timeout - job ${jobResponse.jobId} took longer than 30 minutes. Will retry later.`);
        
        // Update job status to pending retry
        await db
          .update(feedJobs)
          .set({
            status: "pending",
            error: "Webhook timeout - will retry",
          })
          .where(eq(feedJobs.veritusJobId, jobResponse.jobId));
          
        return {
          success: false,
          field: fieldOfStudy,
          jobId: jobResponse.jobId,
          message: "Webhook timeout - job still processing",
        };
      }

      console.log(`  ✅ Webhook received! Processing ${webhookEvent.data.results?.length || 0} papers`);
      results = webhookEvent.data.results || [];
      
    } else {
      // Localhost: Poll with very conservative delays to avoid rate limits
      console.log("⚠️ Using polling fallback for localhost - slow to avoid rate limits");
      
      results = await step.run("poll-job-status-fallback", async () => {
        let attempts = 0;
        const maxAttempts = 6; // Only 6 attempts max

        while (attempts < maxAttempts) {
          try {
            const status = await veritusClient.getJobStatus(jobResponse.jobId);

            if (status.status === "success") {
              await db
                .update(feedJobs)
                .set({
                  status: "completed",
                  resultsCount: status.results?.length || 0,
                  completedAt: new Date(),
                })
                .where(eq(feedJobs.veritusJobId, jobResponse.jobId));

              return status.results || [];
            }

            if (status.status === "error") {
              await db
                .update(feedJobs)
                .set({
                  status: "failed",
                  error: "Veritus job failed",
                  completedAt: new Date(),
                })
                .where(eq(feedJobs.veritusJobId, jobResponse.jobId));

              throw new Error("Veritus job failed");
            }

            console.log(`  ⏳ Attempt ${attempts + 1}/${maxAttempts} - Job status: ${status.status}`);
            
          } catch (error: any) {
            if (error.message?.includes("Too Many Requests")) {
              console.error("⚠️ Rate limit hit - waiting longer before next attempt");
              // Wait 2 minutes after rate limit error
              await new Promise((resolve) => setTimeout(resolve, 120000));
              attempts++;
              continue;
            }
            throw error;
          }

          // Very conservative delay: 60 seconds between each attempt
          await new Promise((resolve) => setTimeout(resolve, 60000));
          attempts++;
        }

        throw new Error("⚠️ Polling timeout - please use production URL with webhook support to avoid rate limits");
      });
    }

    // Step 3: Insert papers (with duplicate prevention) and collect IDs for embedding
    const insertedPapers = await step.run("insert-papers", async () => {
      const insertedIds: string[] = [];
      let duplicates = 0;

      for (const paper of results as VeritusPaper[]) {
        const result = await insertPaper(paper, nicheId);
        if (result.inserted && result.feedItemId) {
          insertedIds.push(result.feedItemId);
        } else {
          duplicates++;
        }
      }

      console.log(`  ✅ Inserted: ${insertedIds.length}, Duplicates: ${duplicates}`);
      return { insertedIds, duplicates, total: results.length };
    });

    // Step 4: Trigger embedding generation for all new papers (fan-out)
    await step.run("trigger-embedding-generation", async () => {
      if (insertedPapers.insertedIds.length === 0) {
        console.log("  ⏭️  No new papers to embed");
        return { triggered: 0 };
      }

      // Fan-out: Send embedding events in batches of 25
      const batchSize = 25;
      let triggered = 0;

      for (let i = 0; i < insertedPapers.insertedIds.length; i += batchSize) {
        const batch = insertedPapers.insertedIds.slice(i, i + batchSize);

        await inngest.send(
          batch.map((feedItemId) => ({
            name: "paper/embedding.generate" as const,
            data: {
              feedItemId,
              nicheId,
            },
          }))
        );

        triggered += batch.length;
      }

      console.log(`  📊 Triggered ${triggered} embedding generation jobs`);
      return { triggered };
    });

    // Step 5: Update niche stats
    await step.run("update-niche-stats", async () => {
      const totalPapers = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems)
        .where(eq(feedItems.nicheId, nicheId));

      await db
        .update(niches)
        .set({
          stats: {
            totalPapers: totalPapers[0].count,
            totalFollowers: 0,
            weeklyGrowth: 0,
            monthlyGrowth: 0,
          },
          updatedAt: new Date(),
        })
        .where(eq(niches.id, nicheId));
    });

    return {
      success: true,
      fieldOfStudy,
      nicheId,
      jobId: jobResponse.jobId,
      papersProcessed: insertedPapers.total,
      papersInserted: insertedPapers.insertedIds.length,
      duplicatesSkipped: insertedPapers.duplicates,
    };
  }
);

// Export all functions
export const nicheFeedFunctions = [
  dailyNicheFeedPopulation,
  weeklyHighQualityRefresh,
  hourlyTrendingRefresh,
  populateFieldFeed,
];
