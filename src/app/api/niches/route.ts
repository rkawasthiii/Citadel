import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { niches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Fetch all niches ordered by popularity score
    const allNiches = await db.query.niches.findMany({
      orderBy: [desc(niches.popularityScore)],
    });

    return NextResponse.json({ niches: allNiches });
  } catch (error) {
    console.error("Failed to fetch niches:", error);
    return NextResponse.json(
      { error: "Failed to fetch niches" },
      { status: 500 }
    );
  }
}
