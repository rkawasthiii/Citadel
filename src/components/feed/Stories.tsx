"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRef, useState, useEffect } from "react";
import { StoriesViewer } from "./StoriesViewer";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

interface Story {
  id: string;
  slug: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarInitials: string;
  hasUnseenStory: boolean;
  recentPaperCount: number;
}

// Generate DiceBear avatar URL for niches (shapes style - not people)
function getNicheAvatarUrl(seed: string, size: number = 112) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

interface StoryItemProps {
  story: Story;
  onClick: () => void;
}

function StoryItem({ story, onClick }: StoryItemProps) {
  return (
    <Link 
      href={`/niche/${story.slug}`}
      className="flex flex-col items-center gap-1.5 min-w-[70px] cursor-pointer shrink-0"
    >
      {/* Avatar with gradient ring */}
      <div 
        className={`p-[2.5px] rounded-full ${
          story.hasUnseenStory 
            ? "bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] via-[#d62976] via-[#962fbf] to-[#4f5bd5]" 
            : "bg-[#dbdbdb] dark:bg-[#363636]"
        }`}
      >
        <div className="bg-white dark:bg-black p-[2px] rounded-full">
          <Avatar className="h-[62px] w-[62px]">
            <AvatarImage src={getNicheAvatarUrl(story.slug, 124)} />
            <AvatarFallback 
              style={{ backgroundColor: story.avatarColor }} 
              className="text-white text-[13px] font-semibold"
            >
              {story.avatarInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      
      {/* Username */}
      <span className="text-xs text-[#262626] dark:text-[#f5f5f5] font-normal text-center max-w-[70px] truncate">
        {story.slug}
      </span>
    </Link>
  );
}

export function Stories() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Use SWR for caching stories data
  const { data, isLoading } = useSWR(
    "/api/niches/stories?limit=10",
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

  const stories = data || [];

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    
    // Show left fade if scrolled right
    setShowLeftFade(scrollLeft > 10);
    
    // Show right fade if not at the end
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check initial state
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [stories]); // Re-run when stories load

  if (isLoading) {
    return (
      <div className="py-4 mb-3 border-b border-[#efefef] dark:border-[#262626]">
        <div className="flex items-center justify-center h-[80px]">
          <Loader2 className="w-5 h-5 animate-spin text-[#8e8e8e]" />
        </div>
      </div>
    );
  }

  if (stories.length === 0) {
    return null;
  }

  return (
    <div className="py-4 mb-3 border-b border-[#efefef] dark:border-[#262626]">
      <div className="relative">
        {/* Gradient fade overlays */}
        <div 
          className={`absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-black to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            showLeftFade ? 'opacity-100' : 'opacity-0'
          }`} 
        />
        <div 
          className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-black to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            showRightFade ? 'opacity-100' : 'opacity-0'
          }`} 
        />
        
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-1"
        >
          {stories.map((story: Story) => (
            <StoryItem key={story.id} story={story} onClick={() => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}
