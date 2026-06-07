import { NextRequest, NextResponse } from "next/server";
import { stackServerApp, isStackAuthConfigured } from "@/stack";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Sync or create user in our database from Neon Auth
export async function GET(request: NextRequest) {
  try {
    if (!isStackAuthConfigured || !stackServerApp) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const stackUser = await stackServerApp.getUser();

    if (!stackUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user already exists in our database
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, stackUser.id))
      .limit(1);

    if (existingUser.length > 0) {
      // Update last active
      await db
        .update(users)
        .set({
          lastActiveAt: new Date(),
          updatedAt: new Date(),
          // Sync basic info from Neon Auth
          name: stackUser.displayName || existingUser[0].name,
          avatar: stackUser.profileImageUrl || existingUser[0].avatar,
        })
        .where(eq(users.id, stackUser.id));

      return NextResponse.json({
        user: {
          ...existingUser[0],
          name: stackUser.displayName || existingUser[0].name,
          avatar: stackUser.profileImageUrl || existingUser[0].avatar,
        },
        isNewUser: false,
      });
    }

    // Create new user in our database
    const email = stackUser.primaryEmail || `user_${stackUser.id}@veritus.app`;
    const username = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
    
    const [newUser] = await db
      .insert(users)
      .values({
        id: stackUser.id, // Use Neon Auth user ID
        email: email,
        username: username,
        name: stackUser.displayName || username,
        avatar: stackUser.profileImageUrl,
        profileType: "researcher",
        isActive: true,
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      user: newUser,
      isNewUser: true,
    });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
