#!/usr/bin/env tsx
/**
 * Quick test script to verify Veritus API connection
 * 
 * Usage: bun run scripts/test-api.ts
 */

import "dotenv/config";
import { veritusClient } from "../src/lib/veritus/client";

console.log("🔍 Testing Veritus API connection...\n");

async function main() {
  try {
    // Test 1: Check credits
    console.log("1️⃣  Checking API credentials and credits...");
    const credits = await veritusClient.getCredits();
    console.log("✅ API connection successful!");
    console.log(`   Free tier credits: ${credits.freeTierCreditsBalance}/${credits.freeTierCreditsTotal}`);
    console.log(`   Pro tier credits: ${credits.proTierCreditsBalance}/${credits.proTierCreditsTotal}`);
    console.log(`   Plan: ${credits.plan}\n`);

    // Test 2: Search for a paper
    console.log("2️⃣  Testing paper search...");
    const papers = await veritusClient.searchPapers("machine learning");
    console.log(`✅ Found ${papers.length} papers`);
    if (papers.length > 0) {
      const paper = papers[0];
      console.log(`   Example: "${paper.title}"`);
      console.log(`   Authors: ${paper.authors}`);
      console.log(`   Citations: ${paper.impactFactor?.citationCount || 0}\n`);
    }

    console.log("✨ All tests passed! Your Veritus API is working correctly.\n");
    console.log("You can now run: bun run seed");
    
  } catch (error) {
    console.error("\n❌ Test failed!");
    console.error("Error:", error);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check your VERITUS_API_KEY in .env");
    console.error("   2. Make sure VERITUS_API_URL is correct");
    console.error("   3. Verify your API key is active at https://discover.veritus.ai");
    process.exit(1);
  }
}

main();
