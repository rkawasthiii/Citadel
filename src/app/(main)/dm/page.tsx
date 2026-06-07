import { getNichePersona } from "@/lib/ai/personas";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

// Featured researchers to show
const FEATURED_NICHES = [
  { slug: "computer-science", color: "#3B82F6" },
  { slug: "medicine", color: "#EF4444" },
  { slug: "physics", color: "#8B5CF6" },
  { slug: "biology", color: "#22C55E" },
];

export default function DMIndexPage() {
  const featuredPersonas = FEATURED_NICHES.map(niche => ({
    ...getNichePersona(niche.slug),
    slug: niche.slug,
    color: niche.color,
  }));

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center max-w-lg px-6">
        {/* Stacked avatars */}
        <div className="flex justify-center -space-x-3 mb-6">
          {featuredPersonas.map((persona, i) => (
            <Avatar 
              key={persona.slug} 
              className="h-12 w-12 ring-2 ring-background"
              style={{ zIndex: featuredPersonas.length - i }}
            >
              <AvatarImage src={persona.avatarUrl} alt={persona.name} />
              <AvatarFallback style={{ backgroundColor: FEATURED_NICHES[i].color }} className="text-white text-sm">
                {persona.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold mb-2">Start a conversation</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Pick a researcher to chat with about their field
        </p>

        {/* Quick start cards */}
        <div className="space-y-2">
          {featuredPersonas.slice(0, 3).map((persona) => (
            <Link 
              key={persona.slug} 
              href={`/dm/${persona.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={persona.avatarUrl} alt={persona.name} />
                <AvatarFallback className="text-white text-xs">
                  {persona.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{persona.name}</p>
                <p className="text-xs text-muted-foreground truncate">{persona.role}</p>
              </div>
              <span className="text-xs text-muted-foreground/60">→</span>
            </Link>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/50 mt-6">
          or select from the sidebar
        </p>
      </div>
    </div>
  );
}
