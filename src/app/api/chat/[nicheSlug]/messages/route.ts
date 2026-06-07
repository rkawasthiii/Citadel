import { db } from "@/lib/db";
import { niches, conversations, messages } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { stackServerApp, isStackAuthConfigured } from "@/stack";

// Get authenticated user ID from Stack Auth
async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isStackAuthConfigured || !stackServerApp) {
    return null;
  }
  
  try {
    const user = await stackServerApp.getUser();
    return user?.id || null;
  } catch (error) {
    console.error("Error getting authenticated user:", error);
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nicheSlug: string }> }
) {
  const { nicheSlug } = await params;

  // Get authenticated user ID
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    return new Response("Unauthorized - Please sign in", { status: 401 });
  }

  // Get niche
  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.slug, nicheSlug))
    .limit(1);

  if (!niche) {
    return new Response("Niche not found", { status: 404 });
  }

  // Find existing active conversation for this user + niche
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.nicheId, niche.id),
        eq(conversations.isActive, true)
      )
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  if (!conversation) {
    // No conversation exists yet
    return Response.json({ messages: [], conversationId: null });
  }

  // Fetch all messages for this conversation
  const conversationMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(asc(messages.createdAt));

  // Format messages for the useChat hook (UIMessage format)
  const formattedMessages = conversationMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content || "",
    createdAt: msg.createdAt,
    // UIMessage format uses parts array
    parts: [
      {
        type: "text" as const,
        text: msg.content || "",
      },
    ],
  }));

  return Response.json({
    messages: formattedMessages,
    conversationId: conversation.id,
  });
}
