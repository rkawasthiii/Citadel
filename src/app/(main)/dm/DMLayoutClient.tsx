"use client";

import { DMSidebar } from "@/components/chat/DMSidebar";
import { ChatProvider } from "@/lib/chat/ChatContext";
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
}

interface DMLayoutClientProps {
  children: React.ReactNode;
  followedNiches: Array<{
    id: string;
    slug: string;
    name: string;
    displayName: string;
    avatarInitials: string;
    avatarColor: string;
  }>;
  conversations: NicheConversation[];
}

export function DMLayoutClient({
  children,
  followedNiches,
  conversations,
}: DMLayoutClientProps) {
  const pathname = usePathname();
  
  // Check if we're on a specific conversation (not just /dm)
  const hasActiveConversation = pathname !== "/dm" && pathname?.split("/dm/")[1];

  return (
    <ChatProvider>
      <div className="flex">
        {/* DM Conversations Sidebar - always visible on desktop, conditionally on mobile */}
        <div className={`${hasActiveConversation ? 'hidden' : 'flex'} md:flex w-full md:w-[380px] border-r border-[#dbdbdb] dark:border-[#262626] shrink-0`}>
          <DMSidebar
            conversations={conversations}
            followedNiches={followedNiches}
          />
        </div>

        {/* Chat area - only show on mobile when conversation is active */}
        <div className={`${hasActiveConversation ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 h-full overflow-hidden`}>
          {children}
        </div>
      </div>
    </ChatProvider>
  );
}