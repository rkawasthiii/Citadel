import { db } from "@/lib/db";
import { niches, conversations, messages } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { DMLayoutClient } from "./DMLayoutClient";
import { stackServerApp, isStackAuthConfigured } from "@/stack";

async function getFollowedNiches() {
  // For demo, get all active niches
  // In production, filter by user's followed niches
  const allNiches = await db
    .select({
      id: niches.id,
      slug: niches.slug,
      name: niches.name,
      displayName: niches.displayName,
      avatarInitials: niches.avatarInitials,
      avatarColor: niches.avatarColor,
    })
    .from(niches)
    .where(eq(niches.isActive, true))
    .orderBy(desc(niches.popularityScore))
    .limit(20);

  return allNiches;
}

async function getUserConversations() {
  // Get the authenticated user
  if (!isStackAuthConfigured || !stackServerApp) {
    return [];
  }
  
  const user = await stackServerApp.getUser();
  if (!user) {
    return [];
  }
  
  try {
    // Get conversations only for the authenticated user
    const userConversations = await db
      .select({
        id: conversations.id,
        nicheId: conversations.nicheId,
        title: conversations.title,
        lastMessageAt: conversations.lastMessageAt,
        nicheSlug: niches.slug,
        nicheName: niches.displayName,
        nicheInitials: niches.avatarInitials,
        nicheColor: niches.avatarColor,
      })
      .from(conversations)
      .innerJoin(niches, eq(conversations.nicheId, niches.id))
      .where(and(
        eq(conversations.isActive, true),
        eq(conversations.userId, user.id)
      ))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(20);

    // Get last message for each conversation
    const conversationsWithMessages = await Promise.all(
      userConversations.map(async (conv) => {
        const [lastMsg] = await db
          .select({
            content: messages.content,
            role: messages.role,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          id: conv.id,
          nicheId: conv.nicheId,
          nicheSlug: conv.nicheSlug,
          nicheName: conv.nicheName,
          nicheInitials: conv.nicheInitials,
          nicheColor: conv.nicheColor,
          lastMessage: lastMsg?.content?.slice(0, 50) || undefined,
          lastMessageAt: conv.lastMessageAt?.toISOString(),
        };
      })
    );

    return conversationsWithMessages;
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

export default async function DMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [followedNiches, userConversations] = await Promise.all([
    getFollowedNiches(),
    getUserConversations(),
  ]);

  return (
    <DMLayoutClient
      followedNiches={followedNiches}
      conversations={userConversations}
    >
      {children}
    </DMLayoutClient>
  );
}
