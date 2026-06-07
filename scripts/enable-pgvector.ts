// scripts/enable-pgvector.ts
// Run this script first to enable the pgvector extension on Neon

import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Enabling pgvector extension...");

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("✅ pgvector extension enabled successfully!");

    // Verify it's enabled
    const result = await sql`SELECT * FROM pg_extension WHERE extname = 'vector';`;
    console.log("Extension info:", result);
  } catch (error) {
    console.error("Error enabling pgvector:", error);
    throw error;
  }
}

main().catch(console.error);
