#!/usr/bin/env tsx
/**
 * Seed script to populate the database with sample data and trigger real Veritus API jobs
 * 
 * Usage:
 *   bun run scripts/seed.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { veritusClient } from "../src/lib/veritus/client";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

console.log("🌱 Starting seed process...\n");

async function createSampleUsers() {
  console.log("👥 Creating sample users...");

  const users = [
    {
      email: "researcher1@example.com",
      username: "alice_johnson",
      name: "Dr. Alice Johnson",
      bio: "Computer Science researcher focused on Machine Learning and AI",
      institution: "MIT",
    },
    {
      email: "researcher2@example.com",
      username: "bob_smith",
      name: "Dr. Bob Smith",
      bio: "Neuroscience and Biology researcher",
      institution: "Stanford University",
    },
    {
      email: "researcher3@example.com",
      username: "carol_williams",
      name: "Dr. Carol Williams",
      bio: "Physics and Engineering specialist",
      institution: "Caltech",
    },
  ];

  const createdUsers = [];
  for (const userData of users) {
    try {
      const [user] = await db
        .insert(schema.users)
        .values(userData)
        .onConflictDoNothing()
        .returning();
      
      if (user) {
        createdUsers.push(user);
        console.log(`  ✓ Created user: ${user.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create user ${userData.name}:`, error);
    }
  }

  return createdUsers;
}

async function createUserPreferences(users: typeof schema.users.$inferSelect[]) {
  console.log("\n⚙️  Creating user preferences...");

  const preferences = [
    {
      userId: users[0].id,
      phrases: [
        "machine learning",
        "deep learning",
        "neural networks",
        "artificial intelligence",
      ],
      fieldsOfStudy: ["Computer Science"],
      minCitationCount: 10,
      openAccessOnly: false,
      quartileRankings: ["Q1", "Q2"],
    },
    {
      userId: users[1].id,
      phrases: [
        "neuroscience",
        "brain imaging",
        "cognitive science",
        "neural plasticity",
      ],
      fieldsOfStudy: ["Biology", "Medicine"],
      minCitationCount: 5,
      openAccessOnly: true,
      quartileRankings: ["Q1"],
    },
    {
      userId: users[2].id,
      phrases: [
        "quantum mechanics",
        "particle physics",
        "engineering design",
      ],
      fieldsOfStudy: ["Physics", "Engineering"],
      minCitationCount: 15,
      openAccessOnly: false,
      quartileRankings: ["Q1", "Q2", "Q3"],
    },
  ];

  for (let i = 0; i < Math.min(users.length, preferences.length); i++) {
    try {
      const [pref] = await db
        .insert(schema.userPreferences)
        .values(preferences[i])
        .onConflictDoNothing()
        .returning();
      
      if (pref) {
        console.log(`  ✓ Created preferences for ${users[i].name}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create preferences for ${users[i].name}:`, error);
    }
  }
}

async function fetchRealPapers() {
  console.log("\n📚 Fetching real papers from Veritus API...");

  try {
    // Check credits first
    const credits = await veritusClient.getCredits();
    console.log(`  💳 Available credits: ${credits.freeTierCreditsBalance} free, ${credits.proTierCreditsBalance} pro`);

    if (credits.freeTierCreditsBalance < 1) {
      console.warn("  ⚠️  Insufficient credits. Please add credits to your Veritus account.");
      return [];
    }

    // Create a job to search for papers
    console.log("  📡 Creating search job...");
    
    // Get the callback URL (use ngrok or your deployed URL)
    const callbackUrl = process.env.VERITUS_CALLBACK_URL || undefined;
    if (callbackUrl) {
      console.log(`  🔔 Callback URL: ${callbackUrl}`);
    }

    const jobResponse = await veritusClient.createJob(
      "keywordSearch",
      {
        phrases: [
          "machine learning",
          "deep learning",
          "neural networks",
        ],
        enrich: false,
        callbackUrl,
      },
      {
        limit: 100,
        fieldsOfStudy: ["Computer Science"],
        minCitationCount: 10,
        sort: "citationCount:desc",
      }
    );

    console.log(`  ✓ Job created: ${jobResponse.jobId}`);

    // Save job to database
    const [savedJob] = await db
      .insert(schema.feedJobs)
      .values({
        userId: (await db.query.users.findFirst())!.id, // Use first user
        veritusJobId: jobResponse.jobId,
        status: "queued",
        jobType: "keywordSearch",
        params: {
          phrases: ["machine learning", "deep learning", "neural networks"],
          filters: {
            fieldsOfStudy: ["Computer Science"],
            minCitationCount: 10,
          },
        },
      })
      .returning();

    console.log(`  💾 Job saved to database`);

    // Poll for results
    console.log("  ⏳ Waiting for job to complete...");
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const status = await veritusClient.getJobStatus(jobResponse.jobId);
      
      if (status.status === "success") {
        console.log(`  ✓ Job completed with ${status.results?.length || 0} results`);
        
        // Update job in database
        await db
          .update(schema.feedJobs)
          .set({
            status: "completed",
            resultsCount: status.results?.length || 0,
            completedAt: new Date(),
          })
          .where(eq(schema.feedJobs.veritusJobId, jobResponse.jobId));

        return status.results || [];
      }

      if (status.status === "error") {
        console.error("  ✗ Job failed");
        await db
          .update(schema.feedJobs)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(schema.feedJobs.veritusJobId, jobResponse.jobId));
        return [];
      }

      attempts++;
      console.log(`  ⏳ Still waiting... (${attempts}/${maxAttempts})`);
    }

    console.warn("  ⚠️  Job polling timeout");
    return [];
  } catch (error) {
    console.error("  ✗ Error fetching papers:", error);
    return [];
  }
}

// Helper function to find or create niche
async function findOrCreateNiche(fieldsOfStudy: string[]): Promise<string> {
  if (!fieldsOfStudy || fieldsOfStudy.length === 0) {
    const generalNiche = await db.query.niches.findFirst({
      where: eq(schema.niches.slug, "general"),
    });
    
    if (generalNiche) return generalNiche.id;
    
    const [newNiche] = await db.insert(schema.niches).values({
      slug: "general",
      name: "General",
      displayName: "General",
      description: "General research papers",
      avatarInitials: "GN",
      avatarColor: "#6366F1",
    }).returning();
    
    return newNiche.id;
  }
  
  const primaryField = fieldsOfStudy[0];
  const slug = primaryField.toLowerCase().replace(/\s+/g, "-");
  
  const existingNiche = await db.query.niches.findFirst({
    where: eq(schema.niches.slug, slug),
  });
  
  if (existingNiche) return existingNiche.id;
  
  const initials = primaryField
    .split(" ")
    .map((word: string) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
  
  const [newNiche] = await db.insert(schema.niches).values({
    slug,
    name: primaryField,
    displayName: primaryField,
    description: `Research papers in ${primaryField}`,
    avatarInitials: initials,
    avatarColor: "#6366F1",
    metadata: { fieldsOfStudy },
  }).returning();
  
  return newNiche.id;
}

async function savePapersToFeed(papers: any[]) {
  console.log(`\n💾 Saving ${papers.length} papers to feed...`);

  let savedCount = 0;
  for (const paper of papers) {
    try {
      // Find or create niche for this paper
      const nicheId = await findOrCreateNiche(paper.fieldsOfStudy || []);
      
      await db
        .insert(schema.feedItems)
        .values({
          nicheId,
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          doi: paper.doi,
          journalName: paper.journalName,
          year: paper.year,
          citationCount: paper.impactFactor?.citationCount || 0,
          influentialCitationCount:
            paper.impactFactor?.influentialCitationCount || 0,
          isOpenAccess: paper.isOpenAccess || false,
          pdfLink: paper.pdfLink,
          link: paper.link,
          tldr: paper.tldr,
          fieldsOfStudy: paper.fieldsOfStudy || [],
          quartileRanking: paper.v_quartile_ranking,
          publicationType: paper.publicationType,
          thumbnailUrl: `https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=${encodeURIComponent(
            paper.title.substring(0, 50)
          )}`,
        })
        .onConflictDoNothing();
      
      savedCount++;
      if (savedCount % 10 === 0) {
        console.log(`  ✓ Saved ${savedCount}/${papers.length} papers...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to save paper ${paper.id}:`, error);
    }
  }

  console.log(`  ✓ Saved ${savedCount} papers successfully`);
}

async function createSampleInteractions(users: typeof schema.users.$inferSelect[]) {
  console.log("\n❤️  Creating sample likes and bookmarks...");

  // Get some feed items
  const feedItemsList = await db.query.feedItems.findMany({ limit: 20 });

  if (feedItemsList.length === 0) {
    console.log("  ⚠️  No feed items to interact with");
    return;
  }

  let likesCount = 0;
  let bookmarksCount = 0;

  // Create random likes and bookmarks
  for (const user of users) {
    const itemsToLike = feedItemsList.slice(0, Math.floor(Math.random() * 10) + 5);
    const itemsToBookmark = feedItemsList.slice(0, Math.floor(Math.random() * 5) + 2);

    for (const item of itemsToLike) {
      try {
        await db
          .insert(schema.likes)
          .values({
            userId: user.id,
            feedItemId: item.id,
          })
          .onConflictDoNothing();
        likesCount++;
      } catch (error) {
        // Ignore conflicts
      }
    }

    for (const item of itemsToBookmark) {
      try {
        await db
          .insert(schema.bookmarks)
          .values({
            userId: user.id,
            feedItemId: item.id,
          })
          .onConflictDoNothing();
        bookmarksCount++;
      } catch (error) {
        // Ignore conflicts
      }
    }
  }

  console.log(`  ✓ Created ${likesCount} likes and ${bookmarksCount} bookmarks`);
}

async function main() {
  try {
    // Step 1: Create users
    const users = await createSampleUsers();

    if (users.length === 0) {
      console.error("\n❌ No users created. Exiting...");
      process.exit(1);
    }

    // Step 2: Create user preferences
    await createUserPreferences(users);

    // Step 3: Fetch real papers from Veritus
    const papers = await fetchRealPapers();

    // Step 4: Save papers to feed
    if (papers.length > 0) {
      await savePapersToFeed(papers);

      // Step 5: Create sample interactions
      await createSampleInteractions(users);
    } else {
      console.log("\n⚠️  No papers fetched. You can still use the app, but the feed will be empty.");
      console.log("    To populate the feed:");
      console.log("    1. Make sure you have credits in your Veritus account");
      console.log("    2. Run the seed script again");
      console.log("    3. Or use the refresh button in the app");
    }

    console.log("\n✅ Seed completed successfully!");
    console.log("\n📝 Summary:");
    console.log(`   - Users created: ${users.length}`);
    console.log(`   - Papers fetched: ${papers.length}`);
    console.log("\n🚀 You can now run your app with: bun run dev");
    
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
