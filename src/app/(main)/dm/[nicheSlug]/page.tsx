import { ChatInterface } from "@/components/chat/ChatInterface";
import { db } from "@/lib/db";
import { niches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getNichePersona } from "@/lib/ai/personas";

interface DMChatPageProps {
  params: Promise<{
    nicheSlug: string;
  }>;
}

export default async function DMChatPage({ params }: DMChatPageProps) {
  const { nicheSlug } = await params;

  // Fetch the niche from the database
  const niche = await db.query.niches.findFirst({
    where: eq(niches.slug, nicheSlug),
  });

  if (!niche) {
    notFound();
  }

  // Get persona for this niche
  const persona = getNichePersona(nicheSlug);

  // Generate initials from niche name
  const nicheInitials = niche.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Generate a consistent color based on niche slug
  const nicheColor = getColorFromSlug(nicheSlug);

  // Map persona to the format expected by ChatInterface
  const chatPersona = {
    name: persona.name,
    role: persona.role,
    greeting: persona.greeting,
    expertise: persona.expertise,
    suggestedPrompts: persona.suggestedPrompts,
    avatarUrl: persona.avatarUrl,
  };

  return (
    <div className="h-full">
      <ChatInterface
        nicheSlug={nicheSlug}
        nicheName={niche.name}
        nicheInitials={niche.avatarInitials || nicheInitials}
        nicheColor={niche.avatarColor || nicheColor}
        persona={chatPersona}
      />
    </div>
  );
}

// Helper function to generate a consistent color from slug
function getColorFromSlug(slug: string): string {
  const colors = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#a855f7", // purple
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#f43f5e", // rose
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#eab308", // yellow
    "#84cc16", // lime
    "#22c55e", // green
    "#10b981", // emerald
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#0ea5e9", // sky
    "#3b82f6", // blue
  ];

  // Simple hash function for consistent color
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Generate metadata for the page
export async function generateMetadata({ params }: DMChatPageProps) {
  const { nicheSlug } = await params;

  const niche = await db.query.niches.findFirst({
    where: eq(niches.slug, nicheSlug),
  });

  if (!niche) {
    return {
      title: "Chat Not Found",
    };
  }

  const persona = getNichePersona(nicheSlug);

  return {
    title: `Chat with ${persona.name} | ${niche.name}`,
    description: `Ask questions about ${niche.name} research papers with ${persona.name}, your AI research assistant.`,
  };
}
