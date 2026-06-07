"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useUser } from "@/lib/context";
import useSWR from "swr";

interface NicheSuggestion {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string | null;
  avatarColor: string;
  avatarInitials: string;
  stats: {
    totalPapers?: number;
    totalFollowers?: number;
  } | null;
  metadata: {
    keywords?: string[];
    relatedNiches?: string[];
  } | null;
}

// Generate DiceBear avatar URL for niches (shapes style - not people)
function getNicheAvatarUrl(seed: string, size: number = 64) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// Get initials from name or email
function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

// Generate a color based on user ID or name
function getUserColor(seed: string): string {
  const colors = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981",
    "#06b6d4", "#6366f1", "#f43f5e", "#84cc16", "#14b8a6"
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function RightSidebar() {
  const { user, appUser } = useUser();
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  const userId = user?.id;

  // Use SWR for caching suggestions
  const { data: suggestions = [], isLoading: loading } = useSWR<NicheSuggestion[]>(
    "/api/niches/suggestions?limit=5",
    async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      return data.success ? data.data : [];
    },
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true,
    }
  );

  // Fetch follow status for suggestions
  useEffect(() => {
    if (!userId || suggestions.length === 0) return;
    
    async function fetchFollowStatuses() {
      const followStatuses: Record<string, boolean> = {};
      await Promise.all(
        suggestions.map(async (niche: NicheSuggestion) => {
          try {
            const followRes = await fetch(`/api/niche/${niche.slug}/follow?userId=${userId}`);
            const followData = await followRes.json();
            followStatuses[niche.id] = followData.following || false;
          } catch {
            followStatuses[niche.id] = false;
          }
        })
      );
      setFollowingStates(followStatuses);
    }
    fetchFollowStatuses();
  }, [userId, suggestions]);

  const handleFollow = async (niche: NicheSuggestion, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId || followLoading[niche.id]) return;

    setFollowLoading(prev => ({ ...prev, [niche.id]: true }));
    const wasFollowing = followingStates[niche.id] || false;
    
    // Optimistic update
    setFollowingStates(prev => ({ ...prev, [niche.id]: !wasFollowing }));

    try {
      const response = await fetch(`/api/niche/${niche.slug}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to follow");
      
      const data = await response.json();
      setFollowingStates(prev => ({ ...prev, [niche.id]: data.following }));
    } catch (error) {
      // Revert on error
      setFollowingStates(prev => ({ ...prev, [niche.id]: wasFollowing }));
      console.error("Failed to follow:", error);
    } finally {
      setFollowLoading(prev => ({ ...prev, [niche.id]: false }));
    }
  };

  // Get user display info
  const displayName = appUser?.name || user?.displayName || user?.primaryEmail?.split("@")[0] || "User";
  const username = appUser?.username || user?.primaryEmail?.split("@")[0] || "user";
  const avatarUrl = appUser?.avatar || user?.profileImageUrl || null;
  const initials = getInitials(displayName, user?.primaryEmail);
  const avatarColor = getUserColor(user?.id || "default");

  return (
    <aside className="w-full pt-4 md:pt-9 pb-5 md:pr-8 sticky top-0 h-screen overflow-y-auto">
      <div className="space-y-5">
        {/* User Profile */}
        <Link href="/profile" className="flex items-center justify-between py-2 hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] -mx-2 px-2 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={44}
            height={44}
            className="rounded-full object-cover aspect-square"
          />
        ) : (
          <Avatar className="h-11 w-11">
            <AvatarFallback 
          style={{ backgroundColor: avatarColor }}
          className="text-white text-sm font-semibold"
            >
          {initials}
            </AvatarFallback>
          </Avatar>
        )}
        <div>
          <p className="text-[14px] font-semibold text-[#262626] dark:text-[#f5f5f5]">
            {username}
          </p>
          <p className="text-[14px] text-[#737373] dark:text-[#a8a8a8]">
            {displayName}
          </p>
        </div>
          </div>
        </Link>

        {/* Suggestions Header */}
        <div className="flex items-center justify-between py-1">
          <p className="text-[14px] font-semibold text-[#8e8e8e] dark:text-[#a8a8a8]">
        Suggested Niches
          </p>
          <Link 
        href="/explore"
        className="text-[12px] font-semibold text-[#262626] dark:text-[#f5f5f5] hover:text-[#8e8e8e]"
          >
        See All
          </Link>
        </div>

        {/* Suggestions List */}
        <div className="space-y-2">
          {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-[#8e8e8e]" />
        </div>
          ) : suggestions.length === 0 ? (
        <p className="text-[13px] text-[#737373] dark:text-[#a8a8a8] py-2">
          No suggestions available
        </p>
          ) : (
        suggestions.map((niche) => (
          <Link 
            key={niche.id} 
            href={`/niche/${niche.slug}`}
            className="flex items-center justify-between hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] -mx-2 px-2 py-1.5 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={getNicheAvatarUrl(niche.slug, 64)} />
            <AvatarFallback 
              style={{ backgroundColor: niche.avatarColor }}
              className="text-white text-[11px] font-semibold"
            >
              {niche.avatarInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[14px] font-semibold text-[#262626] dark:text-[#f5f5f5]">
              {niche.slug}
            </p>
            <p className="text-[12px] text-[#737373] dark:text-[#a8a8a8]">
              {niche.stats?.totalPapers || 0} papers · {niche.stats?.totalFollowers || 0} followers
            </p>
          </div>
            </div>
            <button 
          className={`text-[12px] font-semibold transition-colors ${
            followingStates[niche.id]
              ? "text-[#262626] dark:text-[#f5f5f5] hover:text-[#8e8e8e]"
              : "text-[#0095f6] hover:text-[#00376b] dark:hover:text-[#e0f1ff]"
          }`}
          onClick={(e) => handleFollow(niche, e)}
          disabled={followLoading[niche.id] || !userId}
            >
          {followLoading[niche.id] ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : followingStates[niche.id] ? (
            "Following"
          ) : (
            "Follow"
          )}
            </button>
          </Link>
        ))
          )}
        </div>

        {/* Footer Links */}
        <div className="pt-8 space-y-4">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-[12px] text-[#c7c7c7] dark:text-[#737373]">
        <Link href="#" className="hover:underline">About</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Help</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Press</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">API</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Jobs</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Terms</Link>
        <span>·</span>
        <Link href="#" className="hover:underline">Locations</Link>
          </div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-[12px] text-[#c7c7c7] dark:text-[#737373]">
        <Link href="#" className="hover:underline">Language</Link>
          </div>

          <p className="text-[12px] text-[#c7c7c7] dark:text-[#737373]">
        © 2025 FEEDS FROM VERITUS
          </p>
          {/* Powered by Veritus branding - new logo and text */}
          <a
        href="https://veritus.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-start mt-6 hover:opacity-80 transition-opacity"
          >
        <span className="text-xs text-gray-400 mb-1 tracking-wide">Powered by</span>
        <div className="flex place-items-baseline">
          {/* Provided Veritus logo SVG */}
          <Image
            src="/veritus-logo.png"
            alt="Veritus Logo"
            width={24}
            height={24}
          />
          <span className="text-lg font-semibold tracking-widest text-[#0A1970]">ERITUS</span>
        </div>
          </a>
        </div>
      </div>
    </aside>
  );
}
