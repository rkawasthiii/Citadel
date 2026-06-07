# DM/Chat Feature Implementation Plan

## Overview
Build a direct messaging feature where users can chat with AI assistants specific to each niche. The AI will have:
1. **Context from niche papers** via vector embeddings stored in PostgreSQL (pgvector)
2. **Access to Veritus Search API** as a tool for real-time paper searches
3. **Gemini 2.5 Flash** as the LLM via Vercel AI SDK

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Chat UI  │────▶│   Chat API Route │────▶│  Gemini 2.5     │
│  (useChat hook) │◀────│   (/api/chat)    │◀────│  Flash LLM      │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                        ┌────────▼─────────┐     ┌────────▼────────┐
                        │  Vector Search   │     │  Veritus API    │
                        │  (pgvector)      │     │  Tool           │
                        └──────────────────┘     └─────────────────┘
```

---

## Database Schema Changes

### 1. Enable pgvector Extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. New Tables Required

#### a) `paper_embeddings` - Store embeddings for feed items
```typescript
export const paperEmbeddings = pgTable(
  "paper_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),
    
    // Combined text for embedding (title + abstract + tldr)
    content: text("content").notNull(),
    
    // Vector embedding (768 dimensions for text-embedding-004)
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    
    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    feedItemIdx: index("paper_embeddings_feed_item_idx").on(table.feedItemId),
    nicheIdx: index("paper_embeddings_niche_idx").on(table.nicheId),
    // HNSW index for fast similarity search
    embeddingIdx: index("paper_embeddings_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  })
);
```

#### b) `conversations` - Store chat conversations
```typescript
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),
    
    // Conversation metadata
    title: text("title"), // Auto-generated from first message
    
    // Status
    isActive: boolean("is_active").notNull().default(true),
    
    // Timestamps
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("conversations_user_idx").on(table.userId),
    nicheIdx: index("conversations_niche_idx").on(table.nicheId),
    userNicheIdx: index("conversations_user_niche_idx").on(
      table.userId,
      table.nicheId
    ),
    lastMessageIdx: index("conversations_last_message_idx").on(
      table.lastMessageAt
    ),
  })
);
```

#### d) Update `niches` table - Add AI persona configuration

Add a new field to the existing `niches` table for storing AI persona configuration:

```typescript
// Add to niches table schema
aiPersona: jsonb("ai_persona").$type<{
  name: string;           // e.g., "Dr. Neural" for Computer Science
  role: string;           // e.g., "AI Research Specialist"
  personality: string;    // Personality traits description
  expertise: string[];    // Areas of expertise
  speakingStyle: string;  // How the AI communicates
  greeting: string;       // Initial greeting message
  systemPrompt: string;   // Full system prompt override (optional)
}>(),
```

---

## Niche-Specific AI Personas

Each niche will have a unique AI persona that reflects the field's culture and communication style.

### Persona Configuration (`src/lib/ai/personas.ts`)

```typescript
export interface NichePersona {
  name: string;
  role: string;
  personality: string;
  expertise: string[];
  speakingStyle: string;
  greeting: string;
  systemPromptTemplate: string;
}

// Default personas for each field of study
export const NICHE_PERSONAS: Record<string, NichePersona> = {
  "computer-science": {
    name: "Dr. Neural",
    role: "AI & Computer Science Research Specialist",
    personality: "Analytical, innovative, and passionate about cutting-edge technology. Enjoys explaining complex algorithms in simple terms and gets excited about breakthrough research.",
    expertise: ["Machine Learning", "Algorithms", "Systems Design", "AI Safety", "Software Engineering"],
    speakingStyle: "Clear and technical but accessible. Uses analogies from everyday life to explain complex concepts. Occasionally uses programming humor.",
    greeting: "Hey! 👋 I'm Dr. Neural, your AI research companion for Computer Science. Whether you're diving into the latest transformer architectures or debugging a tricky algorithm paper, I'm here to help. What's on your mind?",
    systemPromptTemplate: `You are Dr. Neural, an enthusiastic AI research assistant specializing in Computer Science.

PERSONALITY:
- Analytical and precise, but approachable and friendly
- Passionate about innovation and cutting-edge research
- Patient when explaining complex concepts
- Uses clear analogies and examples
- Occasionally drops programming jokes or references

EXPERTISE AREAS:
- Machine Learning & Deep Learning
- Algorithms & Data Structures
- Distributed Systems
- Cybersecurity
- Software Engineering
- AI Ethics & Safety

COMMUNICATION STYLE:
- Start responses with a brief, direct answer
- Use code snippets or pseudocode when helpful
- Reference specific papers with proper citations
- Break down complex topics into digestible parts
- Use bullet points and structured formatting
- Admit limitations and suggest searching for more info when uncertain

GUIDELINES:
- Always cite papers when discussing specific research (Author et al., Year)
- Mention citation counts and venues for credibility context
- Compare and contrast different approaches when relevant
- Highlight practical applications and implications
- Be honest about the limitations of current research`,
  },

  "medicine": {
    name: "Dr. Healix",
    role: "Medical Research Specialist",
    personality: "Compassionate, thorough, and evidence-based. Prioritizes patient safety and emphasizes the importance of peer-reviewed research. Careful to distinguish between preliminary findings and established science.",
    expertise: ["Clinical Research", "Drug Development", "Epidemiology", "Medical Diagnostics", "Public Health"],
    speakingStyle: "Professional and caring. Always includes appropriate medical disclaimers. Emphasizes evidence quality and study limitations.",
    greeting: "Hello! I'm Dr. Healix, your medical research guide. 🏥 I'm here to help you navigate clinical studies, understand treatment research, and explore the latest medical discoveries. Please note: I provide research information only, not medical advice. How can I assist your research today?",
    systemPromptTemplate: `You are Dr. Healix, a knowledgeable medical research assistant.

PERSONALITY:
- Compassionate and patient-centered in approach
- Rigorous about evidence quality
- Careful to distinguish correlation from causation
- Emphasizes peer review and replication
- Respectful of the complexity of human health

EXPERTISE AREAS:
- Clinical Trials & Drug Development
- Epidemiology & Public Health
- Medical Diagnostics
- Therapeutic Interventions
- Healthcare Systems

COMMUNICATION STYLE:
- Use precise medical terminology with explanations
- Always mention study design (RCT, cohort, case-control, etc.)
- Discuss sample sizes and statistical significance
- Highlight limitations and potential biases
- Include relevant clinical context

IMPORTANT DISCLAIMERS:
- Always remind users that you provide research information, NOT medical advice
- Encourage consulting healthcare professionals for personal health decisions
- Be cautious about preliminary or pre-print findings
- Distinguish between FDA-approved treatments and experimental approaches

GUIDELINES:
- Cite papers with full context (journal, impact factor if notable)
- Discuss both benefits and risks of interventions
- Mention if findings are from animal studies vs human trials
- Be especially careful with drug interactions and contraindications`,
  },

  "physics": {
    name: "Professor Quark",
    role: "Theoretical & Experimental Physics Guide",
    personality: "Intellectually curious, loves thought experiments, and finds beauty in mathematical elegance. Excited about both theoretical frameworks and experimental breakthroughs.",
    expertise: ["Quantum Mechanics", "Particle Physics", "Astrophysics", "Condensed Matter", "Theoretical Physics"],
    speakingStyle: "Enthusiastic about the mysteries of the universe. Uses thought experiments and visual analogies. Comfortable with mathematical notation but explains concepts intuitively first.",
    greeting: "Greetings, fellow explorer of the cosmos! ⚛️ I'm Professor Quark, your guide through the fascinating world of physics research. From the quantum realm to the cosmic web, I'm here to help you understand the fundamental nature of reality. What phenomenon shall we investigate?",
    systemPromptTemplate: `You are Professor Quark, an enthusiastic physics research guide.

PERSONALITY:
- Deeply curious about the fundamental nature of reality
- Appreciates mathematical beauty and elegance
- Enjoys thought experiments and "what if" scenarios
- Humble about the mysteries we haven't solved
- Celebrates both theoretical insights and experimental confirmations

EXPERTISE AREAS:
- Quantum Mechanics & Quantum Information
- Particle Physics & Standard Model
- Astrophysics & Cosmology
- Condensed Matter Physics
- Theoretical Physics & Mathematical Physics

COMMUNICATION STYLE:
- Start with intuitive explanations before mathematics
- Use thought experiments to illustrate concepts
- Include relevant equations when helpful (using LaTeX: $E=mc^2$)
- Connect abstract concepts to observable phenomena
- Acknowledge when something is still an open question

GUIDELINES:
- Distinguish between well-established physics and speculative theories
- Mention experimental evidence and key experiments
- Credit the physicists behind major discoveries
- Be honest about the limits of current understanding
- Explain the significance of precision and uncertainty`,
  },

  "biology": {
    name: "Dr. Helix",
    role: "Life Sciences Research Specialist",
    personality: "Fascinated by the complexity of living systems, from molecular interactions to ecosystems. Values both reductionist and systems-level approaches.",
    expertise: ["Molecular Biology", "Genetics", "Cell Biology", "Evolutionary Biology", "Biotechnology"],
    speakingStyle: "Clear and systematic. Often traces mechanisms from molecular to organismal level. Appreciates the interconnectedness of biological systems.",
    greeting: "Hello! 🧬 I'm Dr. Helix, your guide to the living world's research frontiers. From the dance of molecules in your cells to the grand tapestry of evolution, I'm here to help you explore life science discoveries. What biological mystery can I help you unravel?",
    systemPromptTemplate: `You are Dr. Helix, a passionate life sciences research assistant.

PERSONALITY:
- Fascinated by the elegance of biological systems
- Appreciates both molecular details and big-picture ecology
- Values evolutionary context for understanding biology
- Excited about biotechnology applications
- Respectful of biological complexity and emergence

EXPERTISE AREAS:
- Molecular Biology & Biochemistry
- Genetics & Genomics
- Cell Biology & Signaling
- Evolutionary Biology
- Biotechnology & Synthetic Biology

COMMUNICATION STYLE:
- Explain mechanisms step by step
- Use pathway diagrams conceptually
- Connect molecular findings to physiological outcomes
- Mention model organisms and their relevance
- Discuss both fundamental research and applications

GUIDELINES:
- Cite key papers and landmark discoveries
- Mention the model systems used (mice, flies, yeast, etc.)
- Discuss the evolutionary conservation of findings
- Be clear about what's demonstrated vs hypothesized
- Highlight potential therapeutic implications when relevant`,
  },

  "psychology": {
    name: "Dr. Mindful",
    role: "Psychology & Behavioral Science Specialist",
    personality: "Empathetic, thoughtful, and committed to rigorous methodology. Aware of the replication crisis and careful about overgeneralizing findings.",
    expertise: ["Cognitive Psychology", "Behavioral Science", "Neuroscience", "Clinical Psychology", "Social Psychology"],
    speakingStyle: "Warm and engaging. Discusses both the science and its human implications. Careful about cultural context and individual differences.",
    greeting: "Welcome! 🧠 I'm Dr. Mindful, your guide to psychology and behavioral science research. Understanding the mind is a fascinating journey, and I'm here to help you navigate the latest findings in cognition, behavior, and mental health. What aspect of human psychology interests you?",
    systemPromptTemplate: `You are Dr. Mindful, an insightful psychology research assistant.

PERSONALITY:
- Empathetic and humanistic in approach
- Committed to methodological rigor
- Aware of cultural and individual differences
- Balanced about nature vs nurture discussions
- Thoughtful about ethical implications

EXPERTISE AREAS:
- Cognitive Psychology & Neuroscience
- Clinical & Counseling Psychology
- Social & Developmental Psychology
- Behavioral Economics
- Mental Health Research

COMMUNICATION STYLE:
- Explain psychological concepts accessibly
- Discuss effect sizes and practical significance
- Mention sample characteristics and generalizability
- Address the replication status of findings
- Be sensitive about mental health topics

IMPORTANT CONSIDERATIONS:
- Distinguish between clinical findings and pop psychology
- Be aware of the WEIRD (Western, Educated, etc.) sample bias
- Discuss ethical considerations in psychological research
- Mention when findings are correlational vs causal

GUIDELINES:
- Cite meta-analyses when available
- Discuss both classic and recent studies
- Be honest about psychology's replication challenges
- Highlight practical applications and interventions`,
  },

  "economics": {
    name: "Dr. Equitas",
    role: "Economics & Policy Research Specialist",
    personality: "Data-driven and practical, interested in both theoretical models and real-world policy implications. Acknowledges the limitations of economic models.",
    expertise: ["Macroeconomics", "Behavioral Economics", "Development Economics", "Econometrics", "Policy Analysis"],
    speakingStyle: "Clear and analytical. Balances theoretical frameworks with empirical evidence. Discusses trade-offs and unintended consequences.",
    greeting: "Hello! 📊 I'm Dr. Equitas, your economics research companion. From market dynamics to policy impacts, I'm here to help you understand economic research and its implications for society. What economic question can I help you explore?",
    systemPromptTemplate: `You are Dr. Equitas, a thoughtful economics research assistant.

PERSONALITY:
- Data-driven and analytically rigorous
- Interested in both theory and empirical evidence
- Aware that economic models are simplifications
- Considers distributional effects and equity
- Practical about policy trade-offs

EXPERTISE AREAS:
- Macroeconomics & Monetary Policy
- Microeconomics & Market Design
- Behavioral Economics
- Development Economics
- Econometrics & Causal Inference

COMMUNICATION STYLE:
- Explain economic concepts with real-world examples
- Discuss identification strategies in empirical work
- Mention assumptions behind theoretical models
- Consider multiple schools of economic thought
- Discuss policy implications and trade-offs

GUIDELINES:
- Cite seminal papers and recent empirical work
- Discuss statistical methods and their limitations
- Be honest about economic uncertainty
- Consider heterogeneous effects across groups
- Acknowledge when economists disagree`,
  },

  "mathematics": {
    name: "Professor Theorem",
    role: "Mathematics Research Guide",
    personality: "Loves elegant proofs and deep connections between mathematical areas. Patient with foundational questions and excited by abstract beauty.",
    expertise: ["Pure Mathematics", "Applied Mathematics", "Statistics", "Mathematical Logic", "Computational Mathematics"],
    speakingStyle: "Precise and structured. Builds understanding from definitions to theorems. Appreciates both rigor and intuition.",
    greeting: "Greetings! 📐 I'm Professor Theorem, your guide to the world of mathematical research. From pure abstraction to applied problem-solving, I'm here to help you explore the elegant structures underlying mathematics. What mathematical concept or problem can I help you with?",
    systemPromptTemplate: `You are Professor Theorem, a passionate mathematics research assistant.

PERSONALITY:
- Loves mathematical elegance and deep connections
- Patient with foundational questions
- Appreciates both pure and applied mathematics
- Values rigor but also intuition
- Excited by unexpected connections between fields

EXPERTISE AREAS:
- Pure Mathematics (Algebra, Analysis, Topology, etc.)
- Applied Mathematics & Modeling
- Probability & Statistics
- Mathematical Logic & Foundations
- Computational Mathematics

COMMUNICATION STYLE:
- Build understanding from definitions
- Use LaTeX for mathematical expressions ($\\int_a^b f(x)dx$)
- Provide both formal statements and intuitive explanations
- Mention important theorems and their implications
- Connect abstract concepts to concrete examples

GUIDELINES:
- State theorems precisely with their conditions
- Discuss proof techniques and strategies
- Mention historical development when relevant
- Be clear about what's proven vs conjectured
- Highlight connections between mathematical areas`,
  },

  // Default persona for niches without specific configuration
  "default": {
    name: "Research Assistant",
    role: "Academic Research Specialist",
    personality: "Knowledgeable, helpful, and committed to academic rigor. Adapts communication style to the field being discussed.",
    expertise: ["Academic Research", "Literature Review", "Research Methodology", "Scientific Writing"],
    speakingStyle: "Professional and clear. Focuses on evidence-based information and proper citations.",
    greeting: "Hello! I'm your research assistant for this field. I'm here to help you explore academic papers, understand research findings, and navigate the literature. What would you like to know?",
    systemPromptTemplate: `You are a knowledgeable academic research assistant.

PERSONALITY:
- Professional and helpful
- Committed to accuracy and evidence
- Adaptable to different fields
- Patient with complex topics

COMMUNICATION STYLE:
- Clear and well-structured responses
- Proper academic citations
- Balanced and objective perspective
- Honest about limitations

GUIDELINES:
- Always cite sources
- Distinguish between established and preliminary findings
- Suggest relevant papers and resources
- Admit when information is uncertain`,
  },
};

/**
 * Get the persona for a specific niche
 */
export function getNichePersona(nicheSlug: string): NichePersona {
  return NICHE_PERSONAS[nicheSlug] || NICHE_PERSONAS["default"];
}

/**
 * Generate the full system prompt for a niche
 */
export function generateSystemPrompt(
  niche: { slug: string; name: string; displayName: string; aiPersona?: any },
  paperContext: string
): string {
  // Use custom persona from database if available
  if (niche.aiPersona?.systemPrompt) {
    return `${niche.aiPersona.systemPrompt}\n\n${paperContext}`;
  }

  const persona = getNichePersona(niche.slug);
  
  return `${persona.systemPromptTemplate}

---
CONTEXT: You are helping with research in ${niche.displayName}.

You have access to:
1. A database of papers in ${niche.displayName} (provided below as context)
2. Veritus Search API for finding additional papers (use the searchPapers or advancedSearch tools)

When using tools:
- Use searchPapers for quick title-based searches
- Use advancedSearch for complex queries with multiple keywords and filters
- Always cite papers you find with title, authors, year, and link

${paperContext}`;
}
```

### Updated Chat API Route with Persona Support

```typescript
// In src/app/api/chat/[nicheSlug]/route.ts

import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai";
import { db } from "@/lib/db";
import { niches, conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchSimilarPapers } from "@/lib/ai/vector-search";
import { veritusSearchTool, veritusAdvancedSearchTool } from "@/lib/ai/tools/veritus-search";
import { generateSystemPrompt, getNichePersona } from "@/lib/ai/personas";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { nicheSlug: string } }
) {
  const { nicheSlug } = params;
  const { messages: userMessages, conversationId } = await req.json();
  
  // TODO: Get userId from auth session
  const userId = "demo-user-id";
  
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
  
  // ... rest of conversation handling ...
  
  // Get the latest user message for context retrieval
  const latestUserMessage = userMessages
    .filter((m: any) => m.role === "user")
    .pop();
  
  // Search for relevant papers from embeddings
  let relevantPapers: any[] = [];
  if (latestUserMessage?.content) {
    relevantPapers = await searchSimilarPapers(
      latestUserMessage.content,
      niche.id,
      5,
      0.6
    );
  }
  
  // Build context from relevant papers
  const paperContext = relevantPapers.length > 0
    ? `\n\nRelevant papers from ${niche.displayName}:\n${relevantPapers
        .map((p, i) => 
          `${i + 1}. "${p.title}" (${p.year || 'N/A'}, ${p.citationCount} citations)
           ${p.tldr || p.abstract?.slice(0, 200) || 'No summary available'}...
           Link: ${p.link || p.pdfLink || 'N/A'}`
        )
        .join('\n\n')}`
    : '';
  
  // Generate system prompt with persona
  const systemPrompt = generateSystemPrompt(niche, paperContext);

  // Stream the response
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: convertToCoreMessages(userMessages),
    tools: {
      searchPapers: veritusSearchTool,
      advancedSearch: veritusAdvancedSearchTool,
    },
    maxSteps: 5,
    onFinish: async ({ text, toolCalls, toolResults, usage }) => {
      // Save assistant message to database
      await db.insert(messages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: text,
        toolCalls: toolCalls?.map(tc => ({
          id: tc.toolCallId,
          name: tc.toolName,
          args: tc.args,
        })),
        toolResults: toolResults?.map(tr => ({
          toolCallId: tr.toolCallId,
          result: tr.result,
        })),
        referencedPaperIds: relevantPapers.map(p => p.feedItemId),
        metadata: {
          model: "gemini-2.5-flash",
          tokensUsed: usage?.totalTokens,
          persona: persona.name, // Track which persona was used
          sources: relevantPapers.map(p => ({
            feedItemId: p.feedItemId,
            title: p.title,
            similarity: p.similarity,
          })),
        },
      });
      
      // Update conversation last message time
      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));
    },
  });

  return result.toDataStreamResponse();
}

// New endpoint to get persona info for a niche
export async function GET(
  req: Request,
  { params }: { params: { nicheSlug: string } }
) {
  const { nicheSlug } = params;
  
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
      slug: niche.slug,
      name: niche.displayName,
    },
    persona: {
      name: persona.name,
      role: persona.role,
      greeting: persona.greeting,
      expertise: persona.expertise,
    },
  });
}
```

### Updated Chat Interface with Persona

```typescript
// In src/components/chat/ChatInterface.tsx - Add persona support

"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, BookOpen, Sparkles } from "lucide-react";

interface NichePersona {
  name: string;
  role: string;
  greeting: string;
  expertise: string[];
}

interface ChatInterfaceProps {
  nicheSlug: string;
  nicheName: string;
  nicheInitials: string;
  nicheColor: string;
  persona?: NichePersona;
}

export function ChatInterface({
  nicheSlug,
  nicheName,
  nicheInitials,
  nicheColor,
  persona,
}: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: `/api/chat/${nicheSlug}`,
      body: { conversationId },
      onFinish: () => {
        setShowGreeting(false);
      },
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Suggested prompts based on expertise
  const suggestedPrompts = persona?.expertise?.slice(0, 3).map(exp => 
    `What are the latest advances in ${exp}?`
  ) || [
    "What are the latest trends?",
    "Find papers about...",
    "Explain the concept of...",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header with Persona */}
      <div className="border-b p-4 flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback 
            style={{ backgroundColor: nicheColor }}
            className="text-white font-semibold"
          >
            {nicheInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{persona?.name || nicheName}</h2>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            {persona?.role || "AI Research Assistant"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Initial Greeting */}
        {messages.length === 0 && showGreeting && (
          <div className="space-y-4">
            {/* Persona Greeting */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                <p className="whitespace-pre-wrap">
                  {persona?.greeting || `Hello! I'm your research assistant for ${nicheName}. How can I help you today?`}
                </p>
              </div>
            </div>
            
            {/* Suggested Prompts */}
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Try asking about:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedPrompts.map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const event = {
                        target: { value: suggestion }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleInputChange(event);
                    }}
                  >
                    {suggestion.length > 40 
                      ? suggestion.slice(0, 40) + "..." 
                      : suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {/* Tool invocations */}
              {message.toolInvocations?.map((tool) => (
                <div
                  key={tool.toolCallId}
                  className="text-xs bg-background/50 rounded p-2 mb-2 flex items-center gap-2"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>
                    {tool.toolName === "searchPapers" 
                      ? "Searching papers..." 
                      : "Running advanced search..."}
                  </span>
                </div>
              ))}
              
              {/* Message content */}
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{persona?.name || "Assistant"} is thinking...</span>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask ${persona?.name || nicheName}...`}
            className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---
```typescript
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    
    // Message content
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    
    // Tool calls and results (for AI responses)
    toolCalls: jsonb("tool_calls").$type<Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>>(),
    toolResults: jsonb("tool_results").$type<Array<{
      toolCallId: string;
      result: unknown;
    }>>(),
    
    // Referenced papers (papers cited in this message)
    referencedPaperIds: jsonb("referenced_paper_ids").$type<string[]>().default([]),
    
    // Metadata
    metadata: jsonb("metadata").$type<{
      model?: string;
      tokensUsed?: number;
      latencyMs?: number;
      sources?: Array<{
        feedItemId: string;
        title: string;
        similarity: number;
      }>;
    }>(),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
    roleIdx: index("messages_role_idx").on(table.role),
    createdIdx: index("messages_created_idx").on(table.createdAt),
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  })
);
```

---

## Package Dependencies

```bash
# AI SDK and Google Provider
npm install ai @ai-sdk/google

# For embeddings generation
npm install @google/generative-ai

# pgvector support for Drizzle
npm install drizzle-orm/pg-core
# Note: pgvector is already supported in drizzle-orm, just need to enable extension
```

---

## Implementation Files

### 1. Embedding Generation (`src/lib/ai/embeddings.ts`)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  const embeddings = await Promise.all(
    texts.map(async (text) => {
      const result = await model.embedContent(text);
      return result.embedding.values;
    })
  );
  
  return embeddings;
}

// Prepare paper content for embedding
export function preparePaperContent(paper: {
  title: string;
  abstract?: string | null;
  tldr?: string | null;
  authors?: string;
}): string {
  const parts = [paper.title];
  if (paper.abstract) parts.push(paper.abstract);
  if (paper.tldr) parts.push(paper.tldr);
  if (paper.authors) parts.push(`Authors: ${paper.authors}`);
  return parts.join("\n\n");
}
```

### 2. Vector Search (`src/lib/ai/vector-search.ts`)

```typescript
import { db } from "@/lib/db";
import { paperEmbeddings, feedItems } from "@/lib/db/schema";
import { sql, desc, and, eq } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

export interface SimilarPaper {
  feedItemId: string;
  title: string;
  abstract: string | null;
  tldr: string | null;
  authors: string;
  similarity: number;
  pdfLink: string | null;
  link: string | null;
  year: number | null;
  citationCount: number;
}

export async function searchSimilarPapers(
  query: string,
  nicheId: string,
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<SimilarPaper[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  // Perform cosine similarity search
  const similarity = sql<number>`1 - (${paperEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;
  
  const results = await db
    .select({
      feedItemId: paperEmbeddings.feedItemId,
      title: feedItems.title,
      abstract: feedItems.abstract,
      tldr: feedItems.tldr,
      authors: feedItems.authors,
      pdfLink: feedItems.pdfLink,
      link: feedItems.link,
      year: feedItems.year,
      citationCount: feedItems.citationCount,
      similarity,
    })
    .from(paperEmbeddings)
    .innerJoin(feedItems, eq(paperEmbeddings.feedItemId, feedItems.id))
    .where(
      and(
        eq(paperEmbeddings.nicheId, nicheId),
        sql`${similarity} >= ${minSimilarity}`
      )
    )
    .orderBy(desc(similarity))
    .limit(limit);
  
  return results;
}
```

### 3. Veritus Search Tool (`src/lib/ai/tools/veritus-search.ts`)

```typescript
import { tool } from "ai";
import { z } from "zod";
import { veritusClient } from "@/lib/veritus/client";

export const veritusSearchTool = tool({
  description: `Search for academic papers using the Veritus API. Use this when:
    - The user asks about recent or specific papers not in the local database
    - The user wants to find papers on a specific topic
    - The user needs more papers than available in the context
    Returns paper metadata including title, abstract, authors, citations, and links.`,
  parameters: z.object({
    query: z.string().describe("Search query for finding papers"),
    limit: z.number().optional().default(10).describe("Number of results to return (max 100)"),
    minCitations: z.number().optional().describe("Minimum citation count filter"),
    year: z.string().optional().describe("Year filter (e.g., '2023' or '2020:2023')"),
    openAccess: z.boolean().optional().describe("Filter for open access papers only"),
  }),
  execute: async ({ query, limit, minCitations, year, openAccess }) => {
    try {
      // Use the title search endpoint for quick searches
      const papers = await veritusClient.searchPapers(query);
      
      // Apply filters
      let filtered = papers;
      
      if (minCitations) {
        filtered = filtered.filter(
          (p) => p.impactFactor.citationCount >= minCitations
        );
      }
      
      if (year) {
        if (year.includes(":")) {
          const [start, end] = year.split(":").map(Number);
          filtered = filtered.filter(
            (p) => p.year && p.year >= start && p.year <= end
          );
        } else {
          filtered = filtered.filter((p) => p.year === parseInt(year));
        }
      }
      
      if (openAccess) {
        filtered = filtered.filter((p) => p.isOpenAccess);
      }
      
      // Return limited results
      return filtered.slice(0, limit).map((paper) => ({
        id: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        tldr: paper.tldr,
        authors: paper.authors,
        year: paper.year,
        citations: paper.impactFactor.citationCount,
        journal: paper.journalName,
        doi: paper.doi,
        link: paper.link || paper.pdfLink,
        isOpenAccess: paper.isOpenAccess,
        quartile: paper.v_quartile_ranking,
      }));
    } catch (error) {
      return { error: `Failed to search papers: ${error}` };
    }
  },
});

export const veritusAdvancedSearchTool = tool({
  description: `Perform an advanced search using Veritus job API. Use this for:
    - Complex queries requiring multiple keywords/phrases
    - When you need more comprehensive search results
    - When the user specifies detailed search criteria
    Note: This is more thorough but slower than basic search.`,
  parameters: z.object({
    phrases: z.array(z.string()).min(3).max(10)
      .describe("3-10 search phrases for keyword search"),
    query: z.string().min(50).max(5000).optional()
      .describe("Detailed query description (50-5000 chars)"),
    fieldsOfStudy: z.array(z.string()).optional()
      .describe("Fields like 'Computer Science', 'Medicine', etc."),
    minCitationCount: z.number().optional(),
    openAccessOnly: z.boolean().optional(),
    quartileRanking: z.array(z.enum(["Q1", "Q2", "Q3", "Q4"])).optional(),
    yearRange: z.string().optional().describe("Format: 'YYYY' or 'YYYY:YYYY'"),
    limit: z.enum(["100", "200", "300"]).optional().default("100"),
  }),
  execute: async ({ 
    phrases, 
    query, 
    fieldsOfStudy, 
    minCitationCount,
    openAccessOnly,
    quartileRanking,
    yearRange,
    limit 
  }) => {
    try {
      const jobType = query ? "combinedSearch" : "keywordSearch";
      
      const jobResponse = await veritusClient.createJob(
        jobType,
        {
          phrases,
          query,
        },
        {
          limit: parseInt(limit) as 100 | 200 | 300,
          fieldsOfStudy,
          minCitationCount,
          openAccessPdf: openAccessOnly,
          quartileRanking,
          year: yearRange,
        }
      );
      
      // Poll for results (with timeout)
      const maxAttempts = 30;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const status = await veritusClient.getJobStatus(jobResponse.jobId);
        
        if (status.status === "success" && status.results) {
          return status.results.slice(0, 20).map((paper) => ({
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            tldr: paper.tldr,
            authors: paper.authors,
            year: paper.year,
            citations: paper.impactFactor.citationCount,
            journal: paper.journalName,
            doi: paper.doi,
            link: paper.link || paper.pdfLink,
            isOpenAccess: paper.isOpenAccess,
            quartile: paper.v_quartile_ranking,
          }));
        }
        
        if (status.status === "error") {
          return { error: "Search job failed" };
        }
        
        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }
      
      return { error: "Search timed out" };
    } catch (error) {
      return { error: `Failed to execute search: ${error}` };
    }
  },
});
```

### 4. Chat API Route (`src/app/api/chat/[nicheSlug]/route.ts`)

```typescript
import { google } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai";
import { db } from "@/lib/db";
import { niches, conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchSimilarPapers } from "@/lib/ai/vector-search";
import { veritusSearchTool, veritusAdvancedSearchTool } from "@/lib/ai/tools/veritus-search";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: { nicheSlug: string } }
) {
  const { nicheSlug } = params;
  const { messages: userMessages, conversationId } = await req.json();
  
  // TODO: Get userId from auth session
  const userId = "demo-user-id";
  
  // Get niche details
  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.slug, nicheSlug))
    .limit(1);
  
  if (!niche) {
    return new Response("Niche not found", { status: 404 });
  }
  
  // Get or create conversation
  let conversation;
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId)
        )
      )
      .limit(1);
    conversation = existing;
  }
  
  if (!conversation) {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId,
        nicheId: niche.id,
        title: userMessages[0]?.content?.slice(0, 100) || "New Conversation",
      })
      .returning();
    conversation = newConversation;
  }
  
  // Get the latest user message for context retrieval
  const latestUserMessage = userMessages
    .filter((m: any) => m.role === "user")
    .pop();
  
  // Search for relevant papers from embeddings
  let relevantPapers: any[] = [];
  if (latestUserMessage?.content) {
    relevantPapers = await searchSimilarPapers(
      latestUserMessage.content,
      niche.id,
      5,
      0.6
    );
  }
  
  // Build context from relevant papers
  const paperContext = relevantPapers.length > 0
    ? `\n\nRelevant papers from ${niche.displayName}:\n${relevantPapers
        .map((p, i) => 
          `${i + 1}. "${p.title}" (${p.year || 'N/A'}, ${p.citationCount} citations)
           ${p.tldr || p.abstract?.slice(0, 200) || 'No summary available'}...
           Link: ${p.link || p.pdfLink || 'N/A'}`
        )
        .join('\n\n')}`
    : '';
  
  // System prompt with niche context
  const systemPrompt = `You are an AI research assistant specializing in ${niche.displayName}. 
Your role is to help researchers and students understand academic papers, find relevant research, and answer questions about ${niche.name}.

Guidelines:
- Always cite papers when discussing specific research
- Use the Veritus search tools to find papers when the user asks for recent or specific research
- Provide balanced, evidence-based responses
- If you're unsure about something, say so and suggest searching for more information
- Format responses with clear structure (headers, bullet points) when appropriate
- When discussing papers, mention key details: authors, year, journal, and citation count

You have access to:
1. A database of papers in ${niche.displayName} (via context)
2. Veritus Search API for finding additional papers

${paperContext}`;

  // Stream the response
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: convertToCoreMessages(userMessages),
    tools: {
      searchPapers: veritusSearchTool,
      advancedSearch: veritusAdvancedSearchTool,
    },
    maxSteps: 5, // Allow tool calls
    onFinish: async ({ text, toolCalls, toolResults, usage }) => {
      // Save assistant message to database
      await db.insert(messages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: text,
        toolCalls: toolCalls?.map(tc => ({
          id: tc.toolCallId,
          name: tc.toolName,
          args: tc.args,
        })),
        toolResults: toolResults?.map(tr => ({
          toolCallId: tr.toolCallId,
          result: tr.result,
        })),
        referencedPaperIds: relevantPapers.map(p => p.feedItemId),
        metadata: {
          model: "gemini-2.5-flash",
          tokensUsed: usage?.totalTokens,
          sources: relevantPapers.map(p => ({
            feedItemId: p.feedItemId,
            title: p.title,
            similarity: p.similarity,
          })),
        },
      });
      
      // Update conversation last message time
      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));
    },
  });

  return result.toDataStreamResponse();
}
```

### 5. Embedding Generation - Integration with Existing Inngest Workflow

The key insight is to **integrate embedding generation into the existing `niche-feeds.ts` workflow**. When papers are inserted after a Veritus job completes, we trigger embedding generation for those new papers.

#### How it Works (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXISTING WORKFLOW (niche-feeds.ts)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  dailyNicheFeedPopulation ──► populateFieldFeed ──► insertPaper()       │
│            │                        │                     │              │
│            │                        │                     ▼              │
│            │                        │              Paper saved to DB     │
│            │                        │                     │              │
│            │                        ▼                     │              │
│            │              "insert-papers" step            │              │
│            │                        │                     │              │
│            │                        ▼                     │              │
│            │     ┌─────────────────────────────────┐     │              │
│            │     │ NEW: Trigger embedding events   │◄────┘              │
│            │     │ for each inserted paper         │                     │
│            │     └─────────────────────────────────┘                     │
│            │                        │                                    │
└────────────┼────────────────────────┼────────────────────────────────────┘
             │                        │
             │                        ▼
             │     ┌─────────────────────────────────────────────┐
             │     │        NEW: "paper/embedding.generate"      │
             │     │                                             │
             │     │  ┌─────────────────────────────────────┐   │
             │     │  │ generatePaperEmbedding function     │   │
             │     │  │                                     │   │
             │     │  │ 1. Get paper from feedItems         │   │
             │     │  │ 2. Prepare content (title+abstract) │   │
             │     │  │ 3. Call Google text-embedding-004   │   │
             │     │  │ 4. Store in paper_embeddings table  │   │
             │     │  └─────────────────────────────────────┘   │
             │     └─────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │     Backfill Job (for existing papers without embeddings)   │
    │                                                             │
    │  "embeddings/backfill" ──► Batch process 50 papers at a time│
    │                           Rate limited: 100ms between calls │
    │                           Auto-continues until all done     │
    └─────────────────────────────────────────────────────────────┘
```

#### Modified `insertPaper` Function (in `niche-feeds.ts`)

```typescript
/**
 * Insert a paper into the database and trigger embedding generation
 * Returns the paper ID if inserted (for embedding), or null if duplicate
 */
async function insertPaper(
  paper: VeritusPaper,
  nicheId: string
): Promise<{ inserted: boolean; feedItemId?: string }> {
  try {
    // Check for duplicates first
    if (await paperExists(paper.id)) {
      console.log(`  ⏭️  Paper already exists: ${paper.id}`);
      return { inserted: false };
    }

    const [inserted] = await db
      .insert(feedItems)
      .values({
        nicheId,
        paperId: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        doi: paper.doi,
        journalName: paper.journalName,
        year: paper.year,
        citationCount: paper.impactFactor?.citationCount || 0,
        influentialCitationCount:
          paper.impactFactor?.influentialCitationCount || 0,
        isOpenAccess: paper.isOpenAccess || false,
        pdfLink: paper.pdfLink,
        link: paper.link,
        tldr: paper.tldr,
        fieldsOfStudy: paper.fieldsOfStudy || [],
        quartileRanking: paper.v_quartile_ranking,
        publicationType: paper.publicationType,
      })
      .onConflictDoNothing() // Skip if already exists
      .returning({ id: feedItems.id });

    if (inserted) {
      return { inserted: true, feedItemId: inserted.id };
    }
    return { inserted: false };
  } catch (error) {
    console.error(`  ❌ Failed to insert paper ${paper.id}:`, error);
    return { inserted: false };
  }
}
```

#### Modified `populateFieldFeed` - Step 3 with Embedding Trigger

```typescript
// Step 3: Insert papers AND trigger embedding generation
const insertedPapers = await step.run("insert-papers", async () => {
  const insertedIds: string[] = [];
  let duplicates = 0;

  for (const paper of results as VeritusPaper[]) {
    const result = await insertPaper(paper, nicheId);
    if (result.inserted && result.feedItemId) {
      insertedIds.push(result.feedItemId);
    } else {
      duplicates++;
    }
  }

  console.log(`  ✅ Inserted: ${insertedIds.length}, Duplicates: ${duplicates}`);
  return { insertedIds, duplicates, total: results.length };
});

// Step 4: Trigger embedding generation for all new papers (fan-out)
await step.run("trigger-embedding-generation", async () => {
  if (insertedPapers.insertedIds.length === 0) {
    console.log("  ⏭️  No new papers to embed");
    return;
  }

  // Send events in batches of 25 to avoid overwhelming the system
  const batchSize = 25;
  for (let i = 0; i < insertedPapers.insertedIds.length; i += batchSize) {
    const batch = insertedPapers.insertedIds.slice(i, i + batchSize);
    
    await inngest.send(
      batch.map((feedItemId) => ({
        name: "paper/embedding.generate",
        data: {
          feedItemId,
          nicheId,
        },
      }))
    );
  }

  console.log(`  📊 Triggered ${insertedPapers.insertedIds.length} embedding jobs`);
});
```

#### New Embedding Functions (`src/lib/inngest/embedding-functions.ts`)

```typescript
import { inngest } from "./client";
import { db } from "@/lib/db";
import { feedItems, paperEmbeddings } from "@/lib/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// ============================================================================
// EMBEDDING UTILITIES
// ============================================================================

/**
 * Generate embedding using Google's text-embedding-004 model
 * Returns 768-dimensional vector
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  
  // Truncate text if too long (max ~8000 tokens ≈ 32000 chars)
  const truncatedText = text.slice(0, 30000);
  
  const result = await model.embedContent(truncatedText);
  return result.embedding.values;
}

/**
 * Prepare paper content for embedding
 * Combines title, abstract, tldr for rich semantic representation
 */
function preparePaperContent(paper: {
  title: string;
  abstract?: string | null;
  tldr?: string | null;
  authors?: string;
}): string {
  const parts = [`Title: ${paper.title}`];
  
  if (paper.tldr) {
    parts.push(`Summary: ${paper.tldr}`);
  }
  
  if (paper.abstract) {
    parts.push(`Abstract: ${paper.abstract}`);
  }
  
  if (paper.authors) {
    parts.push(`Authors: ${paper.authors}`);
  }
  
  return parts.join("\n\n");
}

// ============================================================================
// INNGEST FUNCTIONS
// ============================================================================

/**
 * Generate embedding for a single paper
 * Triggered when a new paper is inserted via niche feed population
 */
export const generatePaperEmbedding = inngest.createFunction(
  {
    id: "generate-paper-embedding",
    name: "Generate Paper Embedding",
    retries: 3,
    concurrency: {
      limit: 10, // Process 10 embeddings concurrently
    },
    // Rate limit: max 100 per minute (Google's limit is ~1500/min)
    rateLimit: {
      limit: 100,
      period: "1m",
    },
  },
  { event: "paper/embedding.generate" },
  async ({ event, step }) => {
    const { feedItemId, nicheId } = event.data;

    // Step 1: Get the paper from database
    const paper = await step.run("fetch-paper", async () => {
      const [result] = await db
        .select({
          id: feedItems.id,
          nicheId: feedItems.nicheId,
          title: feedItems.title,
          abstract: feedItems.abstract,
          tldr: feedItems.tldr,
          authors: feedItems.authors,
        })
        .from(feedItems)
        .where(eq(feedItems.id, feedItemId))
        .limit(1);

      return result;
    });

    if (!paper) {
      console.log(`  ⚠️ Paper not found: ${feedItemId}`);
      return { status: "not_found", feedItemId };
    }

    // Step 2: Check if embedding already exists
    const existingEmbedding = await step.run("check-existing", async () => {
      const [existing] = await db
        .select({ id: paperEmbeddings.id })
        .from(paperEmbeddings)
        .where(eq(paperEmbeddings.feedItemId, feedItemId))
        .limit(1);

      return existing;
    });

    if (existingEmbedding) {
      console.log(`  ⏭️ Embedding already exists for: ${feedItemId}`);
      return { status: "already_exists", feedItemId };
    }

    // Step 3: Prepare content and generate embedding
    const content = preparePaperContent({
      title: paper.title,
      abstract: paper.abstract,
      tldr: paper.tldr,
      authors: paper.authors,
    });

    const embedding = await step.run("generate-embedding", async () => {
      return generateEmbedding(content);
    });

    // Step 4: Store embedding in database
    await step.run("store-embedding", async () => {
      await db.insert(paperEmbeddings).values({
        feedItemId: paper.id,
        nicheId: paper.nicheId,
        content,
        embedding: embedding, // Drizzle handles vector type conversion
      });
    });

    console.log(`  ✅ Embedding generated for paper: ${paper.title.slice(0, 50)}...`);
    return {
      status: "success",
      feedItemId,
      nicheId: paper.nicheId,
      contentLength: content.length,
      embeddingDimensions: embedding.length,
    };
  }
);

/**
 * Batch backfill embeddings for existing papers without embeddings
 * Triggered manually or on schedule
 */
export const backfillPaperEmbeddings = inngest.createFunction(
  {
    id: "backfill-paper-embeddings",
    name: "Backfill Paper Embeddings",
    retries: 2,
    concurrency: {
      limit: 1, // Only one backfill job at a time
    },
  },
  { event: "embeddings/backfill" },
  async ({ event, step }) => {
    const { nicheId, batchSize = 50 } = event.data;

    console.log(`\n🔄 Starting embedding backfill (nicheId: ${nicheId || 'all'}, batchSize: ${batchSize})`);

    // Step 1: Get papers without embeddings
    const papers = await step.run("fetch-papers-without-embeddings", async () => {
      const baseQuery = db
        .select({
          id: feedItems.id,
          nicheId: feedItems.nicheId,
          title: feedItems.title,
          abstract: feedItems.abstract,
          tldr: feedItems.tldr,
          authors: feedItems.authors,
        })
        .from(feedItems)
        .leftJoin(paperEmbeddings, eq(feedItems.id, paperEmbeddings.feedItemId))
        .where(
          and(
            isNull(paperEmbeddings.id),
            nicheId ? eq(feedItems.nicheId, nicheId) : undefined
          )
        )
        .limit(batchSize);

      return baseQuery;
    });

    if (papers.length === 0) {
      console.log("  ✅ All papers have embeddings!");
      return { status: "complete", processed: 0, remaining: 0 };
    }

    console.log(`  📦 Found ${papers.length} papers to embed`);

    // Step 2: Process each paper with rate limiting
    let processed = 0;
    let failed = 0;

    for (const paper of papers) {
      try {
        await step.run(`embed-${paper.id.slice(0, 8)}`, async () => {
          const content = preparePaperContent({
            title: paper.title,
            abstract: paper.abstract,
            tldr: paper.tldr,
            authors: paper.authors,
          });

          const embedding = await generateEmbedding(content);

          await db.insert(paperEmbeddings).values({
            feedItemId: paper.id,
            nicheId: paper.nicheId,
            content,
            embedding,
          });

          processed++;
        });

        // Rate limiting: 100ms delay between embeddings
        await step.sleep("rate-limit", "100ms");
      } catch (error) {
        console.error(`  ❌ Failed to embed paper ${paper.id}:`, error);
        failed++;
      }
    }

    // Step 3: Check if there are more papers to process
    const remaining = await step.run("count-remaining", async () => {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems)
        .leftJoin(paperEmbeddings, eq(feedItems.id, paperEmbeddings.feedItemId))
        .where(
          and(
            isNull(paperEmbeddings.id),
            nicheId ? eq(feedItems.nicheId, nicheId) : undefined
          )
        );

      return result.count;
    });

    // Step 4: Continue backfill if more papers exist
    if (remaining > 0) {
      await step.sendEvent("continue-backfill", {
        name: "embeddings/backfill",
        data: { nicheId, batchSize },
      });
      console.log(`  🔄 Continuing backfill... ${remaining} papers remaining`);
    }

    return {
      status: remaining > 0 ? "batch_complete" : "complete",
      processed,
      failed,
      remaining,
    };
  }
);

/**
 * Scheduled: Daily embedding maintenance
 * Ensures all papers have embeddings, cleans up orphaned embeddings
 */
export const dailyEmbeddingMaintenance = inngest.createFunction(
  {
    id: "daily-embedding-maintenance",
    name: "Daily Embedding Maintenance",
    retries: 1,
  },
  { cron: "TZ=UTC 0 4 * * *" }, // Every day at 4 AM UTC (after feed population)
  async ({ step }) => {
    console.log("🧹 Starting daily embedding maintenance...");

    // Step 1: Count papers without embeddings
    const stats = await step.run("get-embedding-stats", async () => {
      const [withoutEmbeddings] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems)
        .leftJoin(paperEmbeddings, eq(feedItems.id, paperEmbeddings.feedItemId))
        .where(isNull(paperEmbeddings.id));

      const [totalPapers] = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems);

      const [totalEmbeddings] = await db
        .select({ count: sql<number>`count(*)` })
        .from(paperEmbeddings);

      return {
        papersWithoutEmbeddings: withoutEmbeddings.count,
        totalPapers: totalPapers.count,
        totalEmbeddings: totalEmbeddings.count,
      };
    });

    console.log(`  📊 Stats: ${stats.totalPapers} papers, ${stats.totalEmbeddings} embeddings, ${stats.papersWithoutEmbeddings} missing`);

    // Step 2: Trigger backfill if needed
    if (stats.papersWithoutEmbeddings > 0) {
      await step.sendEvent("trigger-backfill", {
        name: "embeddings/backfill",
        data: { batchSize: 100 },
      });
      console.log(`  🔄 Triggered backfill for ${stats.papersWithoutEmbeddings} papers`);
    }

    return {
      success: true,
      ...stats,
      backfillTriggered: stats.papersWithoutEmbeddings > 0,
    };
  }
);

// Export all embedding functions
export const embeddingFunctions = [
  generatePaperEmbedding,
  backfillPaperEmbeddings,
  dailyEmbeddingMaintenance,
];
```

#### Register Embedding Functions in `src/lib/inngest/index.ts`

```typescript
export { inngest } from "./client";
export { functions } from "./functions";
export { nicheFeedFunctions } from "./niche-feeds";
export { embeddingFunctions } from "./embedding-functions"; // NEW
```

#### Update Inngest Route to Include Embedding Functions

In `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";
import { nicheFeedFunctions } from "@/lib/inngest/niche-feeds";
import { embeddingFunctions } from "@/lib/inngest/embedding-functions"; // NEW

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...functions,
    ...nicheFeedFunctions,
    ...embeddingFunctions, // NEW - Register embedding functions
  ],
});
```

#### Modify Existing `insertPaper` in `niche-feeds.ts`

```typescript
// Update the existing insertPaper function to return feedItemId
async function insertPaper(
  paper: VeritusPaper,
  nicheId: string
): Promise<{ inserted: boolean; feedItemId?: string }> {
  try {
    if (await paperExists(paper.id)) {
      console.log(`  ⏭️  Paper already exists: ${paper.id}`);
      return { inserted: false };
    }

    const [inserted] = await db
      .insert(feedItems)
      .values({
        nicheId,
        paperId: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        // ... rest of fields
      })
      .onConflictDoNothing()
      .returning({ id: feedItems.id });

    if (inserted) {
      return { inserted: true, feedItemId: inserted.id };
    }
    return { inserted: false };
  } catch (error) {
    console.error(`  ❌ Failed to insert paper ${paper.id}:`, error);
    return { inserted: false };
  }
}
```

#### Full Integration in `populateFieldFeed` Step 3

The key integration point is in `populateFieldFeed` after papers are inserted:

```typescript
// In populateFieldFeed function, after "insert-papers" step:

// Step 3: Insert papers AND collect IDs for embedding
const insertedPapers = await step.run("insert-papers", async () => {
  const insertedIds: string[] = [];
  let duplicates = 0;

  for (const paper of results as VeritusPaper[]) {
    const result = await insertPaper(paper, nicheId);
    if (result.inserted && result.feedItemId) {
      insertedIds.push(result.feedItemId);
    } else {
      duplicates++;
    }
  }

  console.log(`  ✅ Inserted: ${insertedIds.length}, Duplicates: ${duplicates}`);
  return { insertedIds, duplicates, total: results.length };
});

// Step 4: Trigger embedding generation for all new papers
await step.run("trigger-embedding-generation", async () => {
  if (insertedPapers.insertedIds.length === 0) {
    console.log("  ⏭️  No new papers to embed");
    return { triggered: 0 };
  }

  // Fan-out: Send embedding events in batches
  const batchSize = 25;
  let triggered = 0;

  for (let i = 0; i < insertedPapers.insertedIds.length; i += batchSize) {
    const batch = insertedPapers.insertedIds.slice(i, i + batchSize);
    
    await inngest.send(
      batch.map((feedItemId) => ({
        name: "paper/embedding.generate",
        data: {
          feedItemId,
          nicheId,
        },
      }))
    );
    
    triggered += batch.length;
  }

  console.log(`  📊 Triggered ${triggered} embedding generation jobs`);
  return { triggered };
});
```
```

---

## Frontend Components

### 1. Chat Interface (`src/components/chat/ChatInterface.tsx`)

```typescript
"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, BookOpen, ExternalLink } from "lucide-react";

interface ChatInterfaceProps {
  nicheSlug: string;
  nicheName: string;
  nicheInitials: string;
  nicheColor: string;
}

export function ChatInterface({
  nicheSlug,
  nicheName,
  nicheInitials,
  nicheColor,
}: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: `/api/chat/${nicheSlug}`,
      body: { conversationId },
      onFinish: (message) => {
        // Extract conversation ID from response if new
        if (!conversationId && message.id) {
          // Handle conversation ID
        }
      },
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3">
        <Avatar>
          <AvatarFallback style={{ backgroundColor: nicheColor }}>
            {nicheInitials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold">{nicheName}</h2>
          <p className="text-sm text-muted-foreground">AI Research Assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Ask me about {nicheName}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              I can help you understand papers, find research, and answer
              questions about this field.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "What are the latest trends?",
                "Find papers about...",
                "Explain the concept of...",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Set input to suggestion
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {/* Render tool invocations */}
              {message.toolInvocations?.map((tool) => (
                <div
                  key={tool.toolCallId}
                  className="text-xs bg-background/50 rounded p-2 mb-2"
                >
                  <span className="font-medium">
                    🔍 Searching papers...
                  </span>
                </div>
              ))}
              
              {/* Message content */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {message.content}
              </div>
              
              {/* Sources */}
              {message.experimental_attachments && (
                <div className="mt-2 pt-2 border-t">
                  <span className="text-xs font-medium">Sources:</span>
                  {/* Render source papers */}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm">
            Error: {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder={`Ask about ${nicheName}...`}
            className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### 2. DM Page (`src/app/dm/[nicheSlug]/page.tsx`)

```typescript
import { db } from "@/lib/db";
import { niches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default async function NicheDMPage({
  params,
}: {
  params: { nicheSlug: string };
}) {
  const { nicheSlug } = params;
  
  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.slug, nicheSlug))
    .limit(1);
  
  if (!niche) {
    notFound();
  }
  
  return (
    <div className="h-screen flex flex-col">
      <ChatInterface
        nicheSlug={niche.slug}
        nicheName={niche.displayName}
        nicheInitials={niche.avatarInitials}
        nicheColor={niche.avatarColor}
      />
    </div>
  );
}
```

---

## Edge Cases & Considerations

### 1. Embedding Generation
- **Rate Limiting**: Google's text-embedding-004 has rate limits (~1500 requests/min)
  - We use Inngest's `rateLimit` config: max 100/minute to stay well under
  - Each embedding function has `concurrency: 10` to parallelize safely
- **Batch Processing**: Process embeddings in batches of 25 with delays
  - Inngest handles retries automatically (3 retries configured)
  - `step.sleep("rate-limit", "100ms")` between embeddings in backfill
- **Retry Logic**: Inngest provides exponential backoff for failed embedding requests
- **Content Size**: Truncate very long abstracts (max ~8000 tokens ≈ 30000 chars)
- **Duplicate Prevention**: Check if embedding exists before generating

### 2. Embedding Content Strategy

The embedding combines multiple fields for rich semantic representation:

```typescript
function preparePaperContent(paper): string {
  const parts = [`Title: ${paper.title}`];
  
  // TL;DR is most valuable - concise summary
  if (paper.tldr) {
    parts.push(`Summary: ${paper.tldr}`);
  }
  
  // Full abstract for depth
  if (paper.abstract) {
    parts.push(`Abstract: ${paper.abstract}`);
  }
  
  // Authors for attribution context
  if (paper.authors) {
    parts.push(`Authors: ${paper.authors}`);
  }
  
  return parts.join("\n\n");
}
```

**Why this structure?**
- Title provides core topic identification
- TL;DR (if available) gives concise semantic meaning
- Abstract provides full context and methodology
- Authors help with attribution queries ("papers by X")

### 3. Vector Search Considerations
- **Empty Results**: Fallback to Veritus API search when no similar papers found
- **Index Tuning**: HNSW index with `vector_cosine_ops` for cosine similarity
- **Minimum Similarity**: Configurable threshold (default 0.6-0.7)
- **Niche Isolation**: Always filter by nicheId to prevent cross-niche results
- **Dimension**: 768 dimensions for text-embedding-004 (not 1536 like OpenAI)

### 4. Chat & Conversation
- **Message History**: Limit context window to last N messages to manage tokens
- **Conversation Pruning**: Archive old conversations after X days
- **Tool Timeout**: Set reasonable timeouts for Veritus API calls
- **Streaming Errors**: Handle mid-stream errors gracefully

### 5. Authorization
- **User Authentication**: Implement proper auth (NextAuth, Clerk, etc.)
- **Rate Limiting**: Limit messages per user per hour
- **Niche Access**: Optionally restrict DM access to followed niches

### 5. Cost Management
- **Embedding Costs**: ~$0.00001 per 1K tokens for text-embedding-004
- **LLM Costs**: Gemini 2.5 Flash is cost-effective but monitor usage
- **Veritus Credits**: Track and manage API credits usage

---

## Migration Steps

### 1. Database Migration

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create paper_embeddings table
CREATE TABLE paper_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL UNIQUE REFERENCES feed_items(id) ON DELETE CASCADE,
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX paper_embeddings_feed_item_idx ON paper_embeddings(feed_item_id);
CREATE INDEX paper_embeddings_niche_idx ON paper_embeddings(niche_id);
CREATE INDEX paper_embeddings_embedding_idx ON paper_embeddings 
  USING hnsw (embedding vector_cosine_ops);

-- Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  niche_id UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,
  title TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_message_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX conversations_user_idx ON conversations(user_id);
CREATE INDEX conversations_niche_idx ON conversations(niche_id);
CREATE INDEX conversations_user_niche_idx ON conversations(user_id, niche_id);
CREATE INDEX conversations_last_message_idx ON conversations(last_message_at);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  referenced_paper_ids JSONB DEFAULT '[]',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX messages_conversation_idx ON messages(conversation_id);
CREATE INDEX messages_role_idx ON messages(role);
CREATE INDEX messages_created_idx ON messages(created_at);
CREATE INDEX messages_conversation_created_idx ON messages(conversation_id, created_at);
```

### 2. Environment Variables

```env
# Add to .env.local
GOOGLE_API_KEY=your_google_api_key_here
# (Already have VERITUS_API_KEY from existing setup)
```

---

## Testing Checklist

- [ ] Enable pgvector extension in database
- [ ] Create all new tables and indexes
- [ ] Test embedding generation for single paper
- [ ] Test batch embedding backfill
- [ ] Test vector similarity search
- [ ] Test Veritus search tool
- [ ] Test chat API endpoint
- [ ] Test frontend chat interface
- [ ] Verify conversation persistence
- [ ] Load test with concurrent users
- [ ] Monitor embedding/LLM costs

---

## Files to Create

1. `src/lib/ai/embeddings.ts` - Embedding generation utilities
2. `src/lib/ai/vector-search.ts` - Vector similarity search
3. `src/lib/ai/tools/veritus-search.ts` - Veritus API tools for AI
4. `src/lib/ai/personas.ts` - **Niche-specific AI personas and system prompts**
5. `src/app/api/chat/[nicheSlug]/route.ts` - Chat API endpoint
6. `src/lib/inngest/embedding-functions.ts` - **Background embedding jobs (integrates with niche-feeds.ts)**
7. `src/components/chat/ChatInterface.tsx` - Chat UI component
8. `src/app/dm/[nicheSlug]/page.tsx` - DM page
9. `drizzle/migrations/xxxx_add_embeddings_and_chat.sql` - Database migration
10. Update `src/lib/db/schema.ts` - Add new table schemas + aiPersona field to niches

## Files to Modify

1. `src/lib/inngest/niche-feeds.ts` - **Add embedding trigger after paper insertion**
2. `src/lib/inngest/index.ts` - Export embedding functions
3. `src/app/api/inngest/route.ts` - Register embedding functions

---

## Inngest Workflow Summary

### Event Flow for Embedding Generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INNGEST EVENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CRON/MANUAL TRIGGER                                                        │
│       │                                                                      │
│       ▼                                                                      │
│  dailyNicheFeedPopulation ──► "niche/populate.field" events (fan-out)       │
│                                       │                                      │
│                                       ▼                                      │
│                              populateFieldFeed                               │
│                                       │                                      │
│                    ┌──────────────────┴──────────────────┐                  │
│                    ▼                                     ▼                   │
│            Create Veritus Job              Wait for webhook/poll            │
│                    │                                     │                   │
│                    └──────────────────┬──────────────────┘                  │
│                                       ▼                                      │
│                              "insert-papers" step                            │
│                                       │                                      │
│                         ┌─────────────┴─────────────┐                       │
│                         ▼                           ▼                        │
│                   Insert to DB            Collect feedItemIds               │
│                                                     │                        │
│                                                     ▼                        │
│                              "trigger-embedding-generation" step             │
│                                       │                                      │
│                                       ▼                                      │
│                    inngest.send("paper/embedding.generate") × N              │
│                                       │                                      │
│                    ┌──────────────────┴──────────────────┐                  │
│                    ▼                  ▼                  ▼                   │
│            generatePaperEmbedding  (runs concurrently with rate limiting)   │
│                    │                  │                  │                   │
│                    ▼                  ▼                  ▼                   │
│              Fetch paper       Generate embedding    Store in DB            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `dailyNicheFeedPopulation` | 3 AM UTC daily | Populates feeds for all niches |
| `weeklyHighQualityRefresh` | 2 AM UTC Sunday | Deep refresh for popular niches |
| `hourlyTrendingRefresh` | Every hour | Quick trending paper refresh |
| `dailyEmbeddingMaintenance` | 4 AM UTC daily | Backfills missing embeddings |

### Events

| Event Name | Trigger | Handler |
|------------|---------|---------|
| `niche/populate.field` | Scheduled jobs | `populateFieldFeed` |
| `paper/embedding.generate` | After paper insert | `generatePaperEmbedding` |
| `embeddings/backfill` | Manual/Scheduled | `backfillPaperEmbeddings` |
| `veritus/job.completed` | Webhook callback | Used by `step.waitForEvent` |

---

## Summary

This implementation provides:
- **RAG-based chat**: Papers stored as vector embeddings for semantic search
- **Tool augmentation**: AI can search Veritus API for additional papers
- **Niche-scoped context**: Each niche has isolated paper context
- **Persistent conversations**: Full conversation history stored
- **Streaming responses**: Real-time AI responses via Vercel AI SDK
- **Background processing**: Inngest handles embedding generation
- **Automatic embedding**: Embeddings generated automatically when papers are fetched
- **Backfill support**: Can backfill embeddings for existing papers
- **Rate limiting**: Built-in rate limiting to respect Google API limits
