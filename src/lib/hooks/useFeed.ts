"use client";

import useSWR, { mutate } from "swr";
import { useCallback, useEffect } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { fetchFeedSubscriptionToken } from "@/app/actions/realtime";

export interface FeedItem {
  id: string;
  paperId: string;
  title: string;
  abstract: string | null;
  authors: string;
  doi: string | null;
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
}

interface FeedResponse {
  items: FeedItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const fetcher = async (url: string): Promise<FeedResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
};

interface UseFeedOptions {
  userId?: string;
  nicheSlug?: string;
  page?: number;
  limit?: number;
  // Polling interval in milliseconds (0 to disable)
  refreshInterval?: number;
  // Enable realtime updates via Inngest
  enableRealtime?: boolean;
}

export function useFeed(options: UseFeedOptions = {}) {
  const { 
    userId, 
    nicheSlug, 
    page = 1, 
    limit = 10, 
    refreshInterval = 60000, // Reduced polling since we have realtime
    enableRealtime = true 
  } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (userId) params.set("userId", userId);
  if (nicheSlug) params.set("niche", nicheSlug);

  const key = `/api/feed?${params}`;

  const { data, error, isLoading, isValidating, mutate: mutateFeed } = useSWR<FeedResponse>(
    key,
    fetcher,
    {
      refreshInterval, // Poll less frequently since we have realtime
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // Dedupe requests within 30 seconds
      revalidateIfStale: false, // Don't auto revalidate stale data
      keepPreviousData: true, // Keep previous data while fetching new
    }
  );

  // Subscribe to Inngest realtime updates
  const { latestData: realtimeData } = useInngestSubscription({
    refreshToken: enableRealtime ? fetchFeedSubscriptionToken : undefined,
  });

  // Handle realtime updates
  useEffect(() => {
    if (!realtimeData || !data) return;

    // Extract topic and data from the realtime event
    const topic = realtimeData.topic as string;
    const eventData = realtimeData.data as {
      feedItemId?: string;
      newCount?: number;
      action?: string;
      userId?: string;
    };

    if (!eventData?.feedItemId) return;

    // Update the local cache based on the realtime event
    mutateFeed((currentData) => {
      if (!currentData) return currentData;

      return {
        ...currentData,
        items: currentData.items.map((item) => {
          if (item.id !== eventData.feedItemId) return item;

          switch (topic) {
            case "like":
              return {
                ...item,
                likesCount: eventData.newCount ?? item.likesCount,
                // Don't update isLiked for other users' actions
                isLiked: eventData.userId === userId 
                  ? eventData.action === "liked"
                  : item.isLiked,
              };
            case "comment":
              return {
                ...item,
                commentsCount: eventData.newCount ?? item.commentsCount,
              };
            case "bookmark":
              return {
                ...item,
                bookmarksCount: eventData.newCount ?? item.bookmarksCount,
                isBookmarked: eventData.userId === userId
                  ? eventData.action === "bookmarked"
                  : item.isBookmarked,
              };
            default:
              return item;
          }
        }),
      };
    }, false);
  }, [realtimeData, data, mutateFeed, userId]);

  // Optimistic like update
  const optimisticLike = useCallback(
    async (itemId: string) => {
      if (!userId || !data) return;

      // Optimistically update the UI
      const optimisticData: FeedResponse = {
        ...data,
        items: data.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isLiked: !item.isLiked,
                likesCount: item.isLiked ? item.likesCount - 1 : item.likesCount + 1,
              }
            : item
        ),
      };

      // Update local state immediately
      mutateFeed(optimisticData, false);

      try {
        // Make API call (this will also trigger realtime broadcast)
        await fetch(`/api/feed/${itemId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (error) {
        // Revert on error
        mutateFeed(data, false);
        console.error("Failed to like:", error);
      }
    },
    [userId, data, mutateFeed]
  );

  // Optimistic bookmark update
  const optimisticBookmark = useCallback(
    async (itemId: string) => {
      if (!userId || !data) return;

      const optimisticData: FeedResponse = {
        ...data,
        items: data.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isBookmarked: !item.isBookmarked,
                bookmarksCount: item.isBookmarked
                  ? item.bookmarksCount - 1
                  : item.bookmarksCount + 1,
              }
            : item
        ),
      };

      mutateFeed(optimisticData, false);

      try {
        await fetch(`/api/feed/${itemId}/bookmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (error) {
        mutateFeed(data, false);
        console.error("Failed to bookmark:", error);
      }
    },
    [userId, data, mutateFeed]
  );

  // Update comment count locally
  const incrementCommentCount = useCallback(
    (itemId: string) => {
      if (!data) return;

      const optimisticData: FeedResponse = {
        ...data,
        items: data.items.map((item) =>
          item.id === itemId
            ? { ...item, commentsCount: item.commentsCount + 1 }
            : item
        ),
      };

      mutateFeed(optimisticData, false);
    },
    [data, mutateFeed]
  );

  // Force refresh
  const refresh = useCallback(() => {
    mutateFeed();
  }, [mutateFeed]);

  // Global mutate to refresh all feed queries
  const refreshAllFeeds = useCallback(() => {
    mutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
  }, []);

  return {
    items: data?.items || [],
    pagination: data?.pagination,
    isLoading,
    isValidating,
    error,
    refresh,
    refreshAllFeeds,
    optimisticLike,
    optimisticBookmark,
    incrementCommentCount,
  };
}

// Hook for individual feed item updates (useful for detail pages)
export function useFeedItem(itemId: string, userId?: string) {
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  
  const key = itemId ? `/api/feed/${itemId}?${params}` : null;

  const { data, error, isLoading, mutate: mutateItem } = useSWR(
    key,
    fetcher,
    {
      refreshInterval: 10000,
    }
  );

  return {
    item: data,
    isLoading,
    error,
    refresh: () => mutateItem(),
  };
}
