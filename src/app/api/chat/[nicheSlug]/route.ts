import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { db } from "@/lib/db";
import { niches, conversations, messages, users } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { searchSimilarPapers, formatPapersAsContext } from "@/lib/ai/vector-search";
import { veritusSearchTool, veritusGetPaperTool } from "@/lib/ai/tools/veritus-search";
import { generateSystemPrompt, getNichePersona } from "@/lib/ai/personas";
import { stackServerApp, isStackAuthConfigured } from "@/stack";

export const maxDuration = 60;

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ nicheSlug: string }> }
) {
  const { nicheSlug } = await params;
  const { messages: userMessages, conversationId } = await req.json();

  // Get authenticated user ID
  const userId = await getAuthenticatedUserId();
  
  if (!userId) {
    return new Response("Unauthorized - Please sign in", { status: 401 });
  }

  // Get niche details including AI persona
  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.slug, nicheSlug))
    .limit(1);

  if (!niche) {
    return new Response("Niche not found", { status: 404 });
  }

  // Get persona for greeting and metadata
  const persona = getNichePersona(niche.slug);

  // Get or create conversation
  // First, try to use provided conversationId
  // If not provided, look for an existing active conversation for this user + niche
  let conversation;
  
  if (conversationId) {
    // Use provided conversation ID
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.nicheId, niche.id),
          eq(conversations.isActive, true)
        )
      )
      .limit(1);
    conversation = existing;
  }
  
  if (!conversation) {
    // Look for an existing active conversation for this user + niche
    const [existingConv] = await db
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
    conversation = existingConv;
  }

  if (!conversation) {
    // Create new conversation only if none exists
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId,
        nicheId: niche.id,
        title: userMessages[0]?.content?.slice(0, 100) || "New conversation",
      })
      .returning();
    conversation = newConversation;
    console.log(`📝 Created new conversation: ${conversation.id} for niche: ${niche.displayName}`);
  } else {
    console.log(`💬 Using existing conversation: ${conversation.id} for niche: ${niche.displayName}`);
  }

  // Get the latest user message for context retrieval
  const latestUserMessage = userMessages
    .filter((m: { role: string }) => m.role === "user")
    .pop();

  // Extract content from message (handles both parts array and content string formats)
  const getMessageContent = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.parts)) {
      return message.parts
        .filter((part): part is { type: string; text: string } => part.type === 'text' && typeof part.text === 'string')
        .map(part => part.text)
        .join('');
    }
    return '';
  };

  // Get the content from the latest user message
  const latestUserContent = latestUserMessage ? getMessageContent(latestUserMessage) : '';

  // Search for relevant papers from embeddings (RAG)
  let relevantPapers: Awaited<ReturnType<typeof searchSimilarPapers>> = [];
  if (latestUserContent) {
    try {
      console.log(`\n🔍 RAG Search for: "${latestUserContent.slice(0, 100)}..."`);
      console.log(`   Niche: ${niche.displayName} (${niche.id})`);
      
      relevantPapers = await searchSimilarPapers(
        latestUserContent,
        niche.id,
        5,
        0.5 // Lowered threshold to get more results
      );
      
      if (relevantPapers.length > 0) {
        console.log(`✅ Found ${relevantPapers.length} relevant papers via vector search:`);
        relevantPapers.forEach((paper, i) => {
          console.log(`   ${i + 1}. "${paper.title.slice(0, 60)}..." (similarity: ${paper.similarity.toFixed(3)})`);
        });
      } else {
        console.log(`⚠️ No papers found with similarity > 0.5`);
      }
    } catch (error) {
      console.error("❌ Error searching for similar papers:", error);
      // Continue without context if search fails
    }
  }

  // Build context from relevant papers
  const paperContext =
    relevantPapers.length > 0
      ? `\n\nRelevant papers from ${niche.displayName}:\n${formatPapersAsContext(relevantPapers)}`
      : "";
  
  if (paperContext) {
    console.log(`📚 Added ${relevantPapers.length} papers to context for AI`);
  }

  // Generate system prompt with persona
  const systemPrompt = generateSystemPrompt(
    {
      slug: niche.slug,
      name: niche.name,
      displayName: niche.displayName,
      aiPersona: niche.aiPersona,
    },
    paperContext
  );

  // Save user message to database
  if (latestUserMessage && latestUserContent) {
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: latestUserContent,
    });

    // Update conversation last message time
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conversation.id));
  }

  // Stream the response
  const result = streamText({
    model: google("gemini-flash-latest"),
    system: systemPrompt,
    messages: convertToModelMessages(userMessages as UIMessage[]),
    tools: {
      searchPapers: veritusSearchTool,
      getPaper: veritusGetPaperTool,
    },
    stopWhen: stepCountIs(5), // Allow up to 5 steps (tool roundtrips)
    onFinish: async ({ text, toolCalls, usage }) => {
      // Save assistant message to database
      try {
        await db.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content: text,
          toolCalls: toolCalls?.map((tc) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            args: tc.input as Record<string, unknown>,
          })),
          metadata: {
            model: "gemini-flash-latest",
            promptTokens: usage?.inputTokens,
            completionTokens: usage?.outputTokens,
            totalTokens: usage?.totalTokens,
          },
        });
      } catch (error) {
        console.error("Error saving assistant message:", error);
      }
    },
  });

  // Use toUIMessageStreamResponse for compatibility with useChat and DefaultChatTransport
  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": conversation.id,
      "X-Persona-Name": persona.name,
      "Transfer-Encoding": "chunked",
      "Connection": "keep-alive",
    },
  });
}

// GET endpoint to get persona info for a niche
export async function GET(
  req: Request,
  { params }: { params: Promise<{ nicheSlug: string }> }
) {
  const { nicheSlug } = await params;

  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.slug, nicheSlug))
    .limit(1);

  if (!niche) {
    return new Response("Niche not found", { status: 404 });
  }

  const persona = getNichePersona(niche.slug);

  return Response.json({
    niche: {
      id: niche.id,
      slug: niche.slug,
      name: niche.displayName,
      avatarColor: niche.avatarColor,
      avatarInitials: niche.avatarInitials,
    },
    persona: {
      name: persona.name,
      role: persona.role,
      greeting: persona.greeting,
      expertise: persona.expertise,
      suggestedPrompts: persona.suggestedPrompts,
    },
  });
}
