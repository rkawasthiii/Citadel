"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getNichePersona } from "@/lib/ai/personas";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageSquare, Search, Plus, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NicheConversation {
  id: string;
  nicheId: string;
  nicheSlug: string;
  nicheName: string;
  nicheInitials: string;
  nicheColor: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  personaName?: string;
  personaAvatarUrl?: string;
}

interface DMSidebarProps {
  conversations: NicheConversation[];
  followedNiches: Array<{
    id: string;
    slug: string;
    name: string;
    displayName: string;
    avatarInitials: string;
    avatarColor: string;
  }>;
  isLoading?: boolean;
  onNewChat?: (nicheSlug: string) => void;
}

export function DMSidebar({
  conversations,
  followedNiches,
  isLoading = false,
  onNewChat,
}: DMSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatOptions, setShowNewChatOptions] = useState(false);
  const pathname = usePathname();

  // Get current niche slug from URL
  const currentNicheSlug = pathname?.split("/dm/")[1];

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) =>
    conv.nicheName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get niches that don't have active conversations
  const nichesWithoutConversations = followedNiches.filter(
    (niche) => !conversations.some((conv) => conv.nicheSlug === niche.slug)
  );

  // Format time for display
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen bg-background w-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-[#dbdbdb] dark:border-[#262626] shrink-0">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="font-semibold text-lg md:text-xl flex items-center gap-2">
            Messages
          </h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNewChatOptions(!showNewChatOptions)}
                  className="hover:bg-[#efefef] dark:hover:bg-[#262626]"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New conversation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[#efefef] dark:bg-[#262626] border-0 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* New Chat Options */}
      {showNewChatOptions && (
        <div className="p-4 border-b border-[#dbdbdb] dark:border-[#262626] bg-[#fafafa] dark:bg-[#121212]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Start new chat with:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewChatOptions(false)}
              className="hover:bg-[#efefef] dark:hover:bg-[#262626]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-48">
            <div className="space-y-1">
              {nichesWithoutConversations.length > 0 ? (
                nichesWithoutConversations.map((niche) => {
                  const persona = getNichePersona(niche.slug);
                  return (
                  <Link
                    key={niche.id}
                    href={`/dm/${niche.slug}`}
                    onClick={() => {
                      setShowNewChatOptions(false);
                      onNewChat?.(niche.slug);
                    }}
                  >
                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#efefef] dark:hover:bg-[#262626] transition-colors cursor-pointer">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={persona.avatarUrl} alt={persona.name} />
                        <AvatarFallback
                          style={{ backgroundColor: niche.avatarColor }}
                          className="text-white text-sm font-semibold"
                        >
                          {niche.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{persona.name}</span>
                        <span className="text-xs text-muted-foreground">{niche.displayName}</span>
                      </div>
                    </div>
                  </Link>
                );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  You have conversations with all your followed niches!
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="py-2">
          {isLoading ? (
            // Loading skeletons
            <div className="space-y-2 px-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="space-y-0.5">
              {filteredConversations.map((conv) => {
                const persona = getNichePersona(conv.nicheSlug);
                return (
                <Link key={conv.id} href={`/dm/${conv.nicheSlug}`} className="block">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
                      currentNicheSlug === conv.nicheSlug
                        ? "bg-[#efefef] dark:bg-[#262626]"
                        : "hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a]"
                    )}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={persona.avatarUrl} alt={persona.name} />
                      <AvatarFallback
                        style={{ backgroundColor: conv.nicheColor }}
                        className="text-white font-semibold"
                      >
                        {conv.nicheInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          {persona.name}
                        </span>
                        {conv.lastMessageAt && (
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage || "Start a conversation..."}
                      </p>
                    </div>
                    {conv.unreadCount && conv.unreadCount > 0 && (
                      <Badge variant="default" className="ml-2 shrink-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
              })}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">No conversations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start chatting with an AI research assistant for any niche
                you&apos;re following.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowNewChatOptions(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Start a conversation
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* All Niches Section */}
      {!showNewChatOptions && followedNiches.length > 0 && (
        <div className="border-t border-[#dbdbdb] dark:border-[#262626] p-4 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            All Niches
          </p>
          <div className="flex flex-wrap gap-2">
            {followedNiches.slice(0, 5).map((niche) => {
              const persona = getNichePersona(niche.slug);
              return (
              <TooltipProvider key={niche.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/dm/${niche.slug}`}>
                      <Avatar
                        className={cn(
                          "h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all",
                          currentNicheSlug === niche.slug && "ring-primary"
                        )}
                      >
                        <AvatarImage src={persona.avatarUrl} alt={persona.name} />
                        <AvatarFallback
                          style={{ backgroundColor: niche.avatarColor }}
                          className="text-white text-xs font-semibold"
                        >
                          {niche.avatarInitials}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{persona.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
            })}
            {followedNiches.length > 5 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-[#efefef] dark:bg-[#262626] hover:bg-[#dbdbdb] dark:hover:bg-[#363636]"
                      onClick={() => setShowNewChatOptions(true)}
                    >
                      <span className="text-xs font-medium">+{followedNiches.length - 5}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View all niches</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
