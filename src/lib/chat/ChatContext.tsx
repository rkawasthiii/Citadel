"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { UIMessage } from "ai";

interface CachedConversation {
  messages: UIMessage[];
  lastFetchedAt: number;
}

interface ChatContextType {
  // Get cached messages for a niche
  getCachedMessages: (nicheSlug: string) => UIMessage[] | null;
  
  // Set messages for a niche (updates cache)
  setCachedMessages: (nicheSlug: string, messages: UIMessage[]) => void;
  
  // Check if cache is stale (older than 5 minutes)
  isCacheStale: (nicheSlug: string) => boolean;
  
  // Force sidebar refresh
  sidebarRefreshKey: number;
  triggerSidebarRefresh: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function ChatProvider({ children }: { children: ReactNode }) {
  // Use ref for cache to avoid re-renders when cache updates
  const messageCacheRef = useRef<Record<string, CachedConversation>>({});
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  const getCachedMessages = useCallback((nicheSlug: string): UIMessage[] | null => {
    const cached = messageCacheRef.current[nicheSlug];
    if (!cached) return null;
    return cached.messages;
  }, []);

  const setCachedMessages = useCallback((nicheSlug: string, messages: UIMessage[]) => {
    messageCacheRef.current[nicheSlug] = {
      messages,
      lastFetchedAt: Date.now(),
    };
  }, []);

  const isCacheStale = useCallback((nicheSlug: string): boolean => {
    const cached = messageCacheRef.current[nicheSlug];
    if (!cached) return true;
    return Date.now() - cached.lastFetchedAt > CACHE_TTL;
  }, []);

  const triggerSidebarRefresh = useCallback(() => {
    setSidebarRefreshKey(prev => prev + 1);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        getCachedMessages,
        setCachedMessages,
        isCacheStale,
        sidebarRefreshKey,
        triggerSidebarRefresh,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
