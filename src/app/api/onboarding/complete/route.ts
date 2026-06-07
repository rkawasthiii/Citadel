import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, nicheFollows, userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      name,
      username,
      institution,
      bio,
      careerStage,
      selectedNiches,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!name || !username) {
      return NextResponse.json(
        { error: "Name and username are required" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Check if username is already taken by another user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      );
    }

    // Update user profile with onboarding completed
    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        username,
        institution: institution || null,
        bio: bio || null,
        onboardingCompleted: true,
        onboardingData: {
          selectedNiches: selectedNiches || [],
          careerStage: careerStage || null,
          completedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Also update/create userPreferences for legacy support
    const existingPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    if (existingPrefs) {
      await db
        .update(userPreferences)
        .set({
          fieldsOfStudy: selectedNiches || [],
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({
        userId,
        fieldsOfStudy: selectedNiches || [],
        phrases: [],
        minCitationCount: 0,
        openAccessOnly: false,
        quartileRankings: [],
      });
    }

    // Follow selected niches
    if (selectedNiches && selectedNiches.length > 0) {
      // Insert niche follows (ignore duplicates)
      for (const nicheId of selectedNiches) {
        try {
          await db.insert(nicheFollows).values({
            userId,
            nicheId,
            source: "onboarding",
          });
        } catch (e) {
          // Ignore duplicate key errors
          console.log("Niche follow already exists:", nicheId);
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error("Failed to complete onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
