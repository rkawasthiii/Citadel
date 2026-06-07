import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Demo user for development - using a fixed UUID
const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@veritus.app",
  username: "researcher",
  name: "Demo Researcher",
  profileType: "researcher",
  isActive: true,
  onboardingCompleted: true,
};

/**
 * Ensure demo user exists in the database
 * GET /api/auth/demo - Returns or creates demo user
 */
export async function GET(request: NextRequest) {
  try {
    // Check if demo user exists
    let user = await db.query.users.findFirst({
      where: eq(users.id, DEMO_USER.id),
    });

    if (!user) {
      // Create demo user
      const [newUser] = await db
        .insert(users)
        .values(DEMO_USER)
        .returning();
      user = newUser;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Failed to get/create demo user:", error);
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}
