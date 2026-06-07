#!/usr/bin/env tsx
/**
 * Seed script to initialize all niches and populate initial data
 * 
 * This script will:
 * 1. Create all 23 niches based on Veritus fields of study
 * 2. Trigger initial feed population for each niche
 * 3. Create sample users with niche follows
 * 
 * Usage:
 *   bun run scripts/seed-niches.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// All fields of study from Veritus API
const ALL_FIELDS_OF_STUDY = [
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

// Configuration for each field
const FIELD_CONFIG: Record<
  string,
  {
    description: string;
    avatarColor: string;
    category: string;
    keywords: string[];
  }
> = {
  "Computer Science": {
    description:
      "Explore cutting-edge research in algorithms, AI, machine learning, and software engineering",
    avatarColor: "#3B82F6",
    category: "Technology",
    keywords: ["machine learning", "AI", "algorithms", "software"],
  },
  Medicine: {
    description:
      "Discover the latest medical research, clinical trials, and healthcare innovations",
    avatarColor: "#EF4444",
    category: "Health Sciences",
    keywords: ["clinical trials", "healthcare", "treatment", "diagnosis"],
  },
  Chemistry: {
    description:
      "Dive into molecular research, chemical reactions, and synthesis breakthroughs",
    avatarColor: "#F59E0B",
    category: "Physical Sciences",
    keywords: ["molecules", "reactions", "synthesis", "compounds"],
  },
  Biology: {
    description:
      "Uncover insights in molecular biology, genetics, and cellular mechanisms",
    avatarColor: "#10B981",
    category: "Life Sciences",
    keywords: ["genetics", "cells", "organisms", "evolution"],
  },
  "Materials Science": {
    description:
      "Investigate advanced materials, nanomaterials, and innovative composites",
    avatarColor: "#6366F1",
    category: "Engineering",
    keywords: ["nanomaterials", "composites", "properties", "structure"],
  },
  Physics: {
    description:
      "Explore fundamental laws of nature, quantum mechanics, and particle physics",
    avatarColor: "#8B5CF6",
    category: "Physical Sciences",
    keywords: ["quantum", "particles", "energy", "forces"],
  },
  Geology: {
    description:
      "Study earth's structure, geological formations, and planetary sciences",
    avatarColor: "#78716C",
    category: "Earth Sciences",
    keywords: ["earth", "rocks", "minerals", "formations"],
  },
  Psychology: {
    description:
      "Understand human behavior, cognition, and mental health research",
    avatarColor: "#EC4899",
    category: "Social Sciences",
    keywords: ["behavior", "cognition", "mental health", "therapy"],
  },
  Art: {
    description:
      "Explore art history, visual culture, and contemporary artistic practices",
    avatarColor: "#F43F5E",
    category: "Arts & Humanities",
    keywords: ["visual arts", "aesthetics", "culture", "history"],
  },
  History: {
    description:
      "Examine historical events, cultural development, and historiography",
    avatarColor: "#92400E",
    category: "Arts & Humanities",
    keywords: ["events", "culture", "civilization", "analysis"],
  },
  Geography: {
    description:
      "Analyze spatial patterns, human geography, and geospatial technologies",
    avatarColor: "#059669",
    category: "Earth Sciences",
    keywords: ["spatial", "maps", "environment", "regions"],
  },
  Sociology: {
    description:
      "Study social structures, behaviors, and societal transformations",
    avatarColor: "#7C3AED",
    category: "Social Sciences",
    keywords: ["society", "culture", "groups", "institutions"],
  },
  Business: {
    description:
      "Research business strategies, management, and entrepreneurship",
    avatarColor: "#0891B2",
    category: "Business & Economics",
    keywords: ["strategy", "management", "innovation", "markets"],
  },
  "Political Science": {
    description:
      "Analyze political systems, governance, and public policy",
    avatarColor: "#DC2626",
    category: "Social Sciences",
    keywords: ["politics", "governance", "policy", "government"],
  },
  Economics: {
    description:
      "Investigate economic theories, markets, and financial systems",
    avatarColor: "#16A34A",
    category: "Business & Economics",
    keywords: ["markets", "finance", "trade", "growth"],
  },
  Philosophy: {
    description:
      "Explore philosophical theories, ethics, and metaphysical questions",
    avatarColor: "#9333EA",
    category: "Arts & Humanities",
    keywords: ["ethics", "logic", "metaphysics", "epistemology"],
  },
  Mathematics: {
    description:
      "Discover mathematical theories, proofs, and applied mathematics",
    avatarColor: "#2563EB",
    category: "Physical Sciences",
    keywords: ["algebra", "calculus", "statistics", "proofs"],
  },
  Engineering: {
    description:
      "Advance engineering solutions, systems design, and technological innovation",
    avatarColor: "#EA580C",
    category: "Engineering",
    keywords: ["design", "systems", "innovation", "technology"],
  },
  "Environmental Science": {
    description:
      "Address climate change, sustainability, and ecological challenges",
    avatarColor: "#15803D",
    category: "Earth Sciences",
    keywords: ["climate", "sustainability", "ecology", "conservation"],
  },
  "Agricultural and Food Sciences": {
    description:
      "Advance food production, agriculture, and nutrition research",
    avatarColor: "#84CC16",
    category: "Life Sciences",
    keywords: ["agriculture", "crops", "food", "nutrition"],
  },
  Education: {
    description:
      "Research learning theories, pedagogy, and educational systems",
    avatarColor: "#0EA5E9",
    category: "Social Sciences",
    keywords: ["learning", "teaching", "pedagogy", "curriculum"],
  },
  Law: {
    description:
      "Examine legal theories, jurisprudence, and legal systems",
    avatarColor: "#475569",
    category: "Law & Politics",
    keywords: ["legal theory", "justice", "rights", "constitution"],
  },
  Linguistics: {
    description:
      "Study language structure, phonetics, and linguistic theory",
    avatarColor: "#DB2777",
    category: "Arts & Humanities",
    keywords: ["language", "syntax", "phonetics", "semantics"],
  },
};

console.log("🌱 Starting niche seeding process...\n");

async function createAllNiches() {
  console.log("📚 Creating all 23 niches...\n");

  const createdNiches = [];

  for (const field of ALL_FIELDS_OF_STUDY) {
    const slug = field.toLowerCase().replace(/\s+/g, "-");
    const config = FIELD_CONFIG[field];

    // Check if niche already exists
    const existing = await db.query.niches.findFirst({
      where: eq(schema.niches.slug, slug),
    });

    if (existing) {
      console.log(`  ⏭️  Niche already exists: ${field}`);
      createdNiches.push(existing);
      continue;
    }

    // Create initials
    const initials = field
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    // Create niche
    try {
      const [niche] = await db
        .insert(schema.niches)
        .values({
          slug,
          name: field,
          displayName: field,
          description: config.description,
          avatarInitials: initials,
          avatarColor: config.avatarColor,
          categoryType: "field",
          metadata: {
            fieldsOfStudy: [field],
            keywords: config.keywords,
          },
          stats: {
            totalPapers: 0,
            totalFollowers: 0,
            weeklyGrowth: 0,
            monthlyGrowth: 0,
          },
        })
        .returning();

      createdNiches.push(niche);
      console.log(`  ✅ Created: ${field} (${slug})`);
    } catch (error) {
      console.error(`  ❌ Failed to create ${field}:`, error);
    }
  }

  console.log(`\n✨ Total niches: ${createdNiches.length}\n`);
  return createdNiches;
}

async function createSampleUsers() {
  console.log("👥 Creating sample users...\n");

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
        console.log(`  ✅ Created user: ${user.name}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to create user ${userData.name}:`, error);
    }
  }

  return createdUsers;
}

async function createNicheFollows(
  users: typeof schema.users.$inferSelect[],
  niches: typeof schema.niches.$inferSelect[]
) {
  console.log("\n💜 Creating niche follows...\n");

  // Skip if no users
  if (!users || users.length === 0) {
    console.log("  ⏭️  No users to create follows for (users may already exist)");
    return 0;
  }

  // User 1 follows Computer Science, Mathematics, Engineering
  const user1Niches = niches.filter((n) =>
    ["computer-science", "mathematics", "engineering"].includes(n.slug)
  );

  // User 2 follows Medicine, Biology, Psychology
  const user2Niches = niches.filter((n) =>
    ["medicine", "biology", "psychology"].includes(n.slug)
  );

  // User 3 follows Physics, Engineering, Materials Science
  const user3Niches = niches.filter((n) =>
    ["physics", "engineering", "materials-science"].includes(n.slug)
  );

  const follows = [
    ...(users[0] ? user1Niches.map((n) => ({ userId: users[0].id, nicheId: n.id })) : []),
    ...(users[1] ? user2Niches.map((n) => ({ userId: users[1].id, nicheId: n.id })) : []),
    ...(users[2] ? user3Niches.map((n) => ({ userId: users[2].id, nicheId: n.id })) : []),
  ];

  let created = 0;
  for (const follow of follows) {
    try {
      await db
        .insert(schema.nicheFollows)
        .values({
          userId: follow.userId,
          nicheId: follow.nicheId,
          notificationsEnabled: true,
          source: "onboarding",
        })
        .onConflictDoNothing();
      created++;
    } catch (error) {
      console.error("  ❌ Failed to create follow:", error);
    }
  }

  console.log(`  ✅ Created ${created} niche follows\n`);
}

async function displaySummary(niches: typeof schema.niches.$inferSelect[]) {
  console.log("\n" + "=".repeat(70));
  console.log("📊 SEEDING SUMMARY");
  console.log("=".repeat(70) + "\n");

  console.log(`Total Niches Created: ${niches.length}\n`);

  console.log("Categories:");
  const categories = new Set(
    niches.map((n) => (n.metadata as any)?.category || "Unknown")
  );
  categories.forEach((cat) => {
    const count = niches.filter(
      (n) => (n.metadata as any)?.category === cat
    ).length;
    console.log(`  • ${cat}: ${count} niches`);
  });

  console.log("\n" + "=".repeat(70));
  console.log("✅ SEEDING COMPLETE!");
  console.log("=".repeat(70) + "\n");

  console.log("Next Steps:");
  console.log("  1. Start your dev server: bun run dev");
  console.log("  2. Access Inngest dashboard to trigger workflows");
  console.log("  3. Or manually trigger: POST /api/inngest");
  console.log("\nScheduled Workflows Will Run:");
  console.log("  • Daily Feed Population: Every day at 3 AM UTC");
  console.log("  • Weekly High-Quality: Every Sunday at 2 AM UTC");
  console.log("  • Hourly Trending: Every hour\n");
}

// Main execution
async function main() {
  try {
    const niches = await createAllNiches();
    const users = await createSampleUsers();
    await createNicheFollows(users, niches);
    await displaySummary(niches);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

main();
