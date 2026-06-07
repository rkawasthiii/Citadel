"use client";

import { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

// Generate DiceBear avatar URL for niches (shapes style - not people)
function getNicheAvatarUrl(seed: string, size: number = 64) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

interface FeedItemProps {
  id: string;
  title: string;
  abstract: string | null;
  authors: string;
  journalName: string | null;
  year: number | null;
  citationCount: number;
  influentialCitationCount: number;
  isOpenAccess: boolean;
  pdfLink: string | null;
  link: string | null;
  tldr: string | null;
  fieldsOfStudy: string[];
  quartileRanking: string | null;
  publicationType: string | null;
  doi: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  niche?: {
    id: string;
    slug: string;
    name: string;
    displayName: string;
    avatarInitials: string;
    avatarColor: string;
  };
  isLiked?: boolean;
  isBookmarked?: boolean;
  onLike?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
}

export function FeedCard({
  id,
  title,
  abstract,
  authors,
  journalName,
  year,
  citationCount,
  influentialCitationCount,
  isOpenAccess,
  pdfLink,
  link,
  tldr,
  fieldsOfStudy,
  quartileRanking,
  publicationType,
  doi,
  thumbnailUrl,
  createdAt,
  likesCount,
  commentsCount,
  niche,
  isLiked = false,
  isBookmarked = false,
  onLike,
  onBookmark,
  onComment,
  onShare,
}: FeedItemProps) {
  const [liked, setLiked] = useState(isLiked);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [likes, setLikes] = useState(Number(likesCount) || 0);
  const [prevLikes, setPrevLikes] = useState(Number(likesCount) || 0);
  const [expanded, setExpanded] = useState(false);
  const [animateDirection, setAnimateDirection] = useState<'up' | 'down' | null>(null);

  // Sync local state with props when they change (e.g., from realtime updates)
  useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setBookmarked(isBookmarked);
  }, [isBookmarked]);

  useEffect(() => {
    const newCount = Number(likesCount) || 0;
    // Only update if it's different and not from our own action
    if (newCount !== likes) {
      setPrevLikes(likes);
      setLikes(newCount);
    }
  }, [likesCount]);

  const handleLike = () => {
    const newLikedState = !liked;
    setLiked(newLikedState);
    
    // Store previous count
    setPrevLikes(likes);
    
    // Update the count
    const newLikes = newLikedState ? likes + 1 : likes - 1;
    setLikes(newLikes);
    
    // Trigger slide animation
    setAnimateDirection(newLikedState ? 'up' : 'down');
    setTimeout(() => setAnimateDirection(null), 300);
    
    onLike?.(id);
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.(id);
  };

  // Always use niche data for profile display
  const displayName = niche?.displayName || "Research";
  const initials = niche?.avatarInitials || "RS";
  const avatarColor = niche?.avatarColor || "#f97316";
  const profileSlug = niche?.slug;
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: false });

  return (
    <article className="pb-4 mb-4 px-3 md:px-0 border-b border-[#efefef] dark:border-[#262626]">
      {/* Header */}
      <div className="flex items-center justify-between py-2.5 gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar with gradient ring */}
          <Link href={profileSlug ? `/niche/${profileSlug}` : "#"} className="shrink-0 flex justify-center items-center">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#feda75] via-[#fa7e1e] via-[#d62976] via-[#962fbf] to-[#4f5bd5] p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-white dark:bg-black rounded-full p-0.5 flex items-center justify-center">
                <Avatar className="w-full h-full">
                  <AvatarImage 
                    src={profileSlug ? getNicheAvatarUrl(profileSlug, 64) : undefined} 
                    className="object-cover"
                  />
                  <AvatarFallback 
                    style={{ backgroundColor: avatarColor }} 
                    className="text-white text-[11px] font-semibold"
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </Link>
          <div className="flex items-center min-w-0 flex-1">
            <Link href={profileSlug ? `/niche/${profileSlug}` : "#"} className="flex items-center min-w-0">
              <span className="text-[14px] font-semibold text-[#262626] dark:text-[#f5f5f5] tracking-[-0.01em] truncate max-w-[150px] md:max-w-[200px] hover:text-[#737373] cursor-pointer">{displayName}</span>
            </Link>
            <span className="text-[14px] text-[#737373] dark:text-[#a8a8a8] mx-1.5 font-normal shrink-0">•</span>
            <span className="text-[14px] text-[#737373] dark:text-[#a8a8a8] font-normal whitespace-nowrap shrink-0">{timeAgo}</span>
          </div>
        </div>
        <button className="p-2 hover:opacity-50 shrink-0">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="mb-3">
        {/* Title */}
        <h3 className="text-[15px] font-medium leading-[20px] text-[#262626] dark:text-[#f5f5f5] tracking-[-0.02em] mb-1">
          {title}
        </h3>
        
        {/* Authors */}
        <p className="text-[13px] text-[#737373] dark:text-[#a8a8a8] mb-2 italic">
          {authors.split(",").slice(0, 3).join(", ")}
          {authors.split(",").length > 3 && " et al."}
        </p>
        
        {/* TL;DR */}
        {tldr && (
          <p className="text-[14px] leading-[20px] text-[#262626] dark:text-[#f5f5f5] tracking-[-0.01em] mb-2">
            <span className="font-semibold text-[#0095f6]">TL;DR:</span>{" "}<span className="text-[#262626] dark:text-[#f5f5f5]">{tldr}</span>
          </p>
        )}

        {/* Abstract */}
        {abstract && (
          <div className="text-[14px] leading-[20px] text-[#737373] dark:text-[#a8a8a8] mb-2">
            <p className={expanded ? "" : "line-clamp-3"}>
              {abstract}
            </p>
            {abstract.length > 200 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[#c7c7c7] dark:text-[#737373] text-[14px] mt-0.5 hover:text-[#8e8e8e]"
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="flex overflow-x-auto scrollbar-hide items-center gap-2 mb-2 pb-1 -mx-3 px-3 md:mx-0 md:px-0">
          {publicationType && (
            <span className="inline-flex text-xs px-2.5 py-1 bg-[#efefef] dark:bg-[#363636] rounded-sm text-[#262626] dark:text-[#f5f5f5] font-normal capitalize whitespace-nowrap shrink-0">
              {publicationType}
            </span>
          )}
          {year && (
            <span className="inline-flex text-xs px-2.5 py-1 bg-[#efefef] dark:bg-[#363636] rounded-sm text-[#262626] dark:text-[#f5f5f5] font-normal whitespace-nowrap shrink-0">
              {year}
            </span>
          )}
          {journalName && (
            <span className="inline-flex text-xs px-2.5 py-1 bg-[#efefef] dark:bg-[#363636] rounded-sm text-[#262626] dark:text-[#f5f5f5] font-normal max-w-[200px] truncate shrink-0">
              {journalName}
            </span>
          )}
          {citationCount > 0 && (
            <span className="inline-flex text-xs px-2.5 py-1 bg-[#efefef] dark:bg-[#363636] rounded-sm text-[#262626] dark:text-[#f5f5f5] font-normal whitespace-nowrap shrink-0">
              📚 {citationCount.toLocaleString()}
            </span>
          )}
          {influentialCitationCount > 0 && (
            <span className="inline-flex text-xs px-2.5 py-1 bg-[#fef3c7] dark:bg-[#854d0e] rounded-sm text-[#92400e] dark:text-[#fef3c7] font-normal whitespace-nowrap shrink-0">
              ⭐ {influentialCitationCount.toLocaleString()} influential
            </span>
          )}
          {isOpenAccess && (
            <span className="inline-flex text-xs px-2.5 py-1 rounded-sm border border-[#00a400] text-[#00a400] dark:text-[#4ade80] font-normal whitespace-nowrap shrink-0">
              🔓 Open Access
            </span>
          )}
          {quartileRanking && (
            <span className="inline-flex text-xs px-2.5 py-1 rounded-sm border border-[#ed8936] text-[#ed8936] dark:text-[#fbd38d] font-normal whitespace-nowrap shrink-0">
              {quartileRanking}
            </span>
          )}
          {doi && (
            <a
              href={`https://doi.org/${doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs px-2.5 py-1 rounded-sm border border-[#0095f6] text-[#0095f6] font-normal hover:bg-[#0095f6] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              DOI
            </a>
          )}
        </div>

        {/* Hashtags */}
        {fieldsOfStudy && fieldsOfStudy.length > 0 && (
          <div className="flex flex-wrap gap-x-1.5 mt-1">
            {fieldsOfStudy.slice(0, 3).map((field, index) => (
              <span
                key={index}
                className="text-sm text-[#00376b] dark:text-[#e0f1ff] font-normal"
              >
                #{field.replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 hover:text-[#262626] dark:hover:text-[#f5f5f5] cursor-pointer transition-colors ${liked ? "text-[#ed4956]" : "text-[#8e8e8e] dark:text-[#a8a8a8]"}`}
          >
            <Heart
              className={`h-[22px] w-[22px] ${liked ? "fill-current" : ""} transition-all duration-150`}
              strokeWidth={1.8}
            />
            <span className="relative inline-flex items-center justify-center overflow-hidden h-[18px] min-w-[16px]">
              <span 
                className={`text-[13px] font-medium transition-transform duration-300 ease-out ${
                  animateDirection === 'up' 
                    ? 'animate-slideUp' 
                    : animateDirection === 'down'
                    ? 'animate-slideDown'
                    : ''
                }`}
                key={likes}
              >
                {String(likes)}
              </span>
            </span>
          </button>
          <button
            onClick={() => onComment?.(id)}
            className="flex items-center gap-2 hover:text-[#262626] dark:hover:text-[#f5f5f5] cursor-pointer transition-colors text-[#8e8e8e] dark:text-[#a8a8a8]"
          >
            <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <span className="text-[13px] font-medium">{commentsCount}</span>
          </button>
          <button
            onClick={() => onShare?.(id)}
            className="flex items-center gap-2 hover:text-[#262626] dark:hover:text-[#f5f5f5] cursor-pointer transition-colors text-[#8e8e8e] dark:text-[#a8a8a8]"
          >
            <Send className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          {(pdfLink || link) && (
            <a
              href={pdfLink || link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#262626] dark:hover:text-[#f5f5f5] cursor-pointer transition-colors text-[#8e8e8e] dark:text-[#a8a8a8]"
            >
              <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </a>
          )}
          <button
            onClick={handleBookmark}
            className="hover:text-[#262626] dark:hover:text-[#f5f5f5] cursor-pointer transition-colors text-[#8e8e8e] dark:text-[#a8a8a8]"
          >
            <Bookmark
              className={`h-[22px] w-[22px] ${bookmarked ? "fill-current" : ""}`}
              strokeWidth={1.8}
            />
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[10px] text-[#737373] dark:text-[#a8a8a8] uppercase tracking-normal mt-1.5">
        {timeAgo.toUpperCase()} AGO
      </div>
    </article>
  );
}
