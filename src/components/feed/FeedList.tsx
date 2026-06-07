"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FeedCard } from "./FeedCard";
import { CommentsDrawer } from "./CommentsDrawer";
import { Loader2, RefreshCw } from "lucide-react";
import { useUser } from "@/lib/context";
import { useFeed, type FeedItem } from "@/lib/hooks/useFeed";

export function FeedList() {
  const { user } = useUser();
  const userId = user?.id;
  
  // Use SWR for feed data with polling every 30 seconds
  const {
    items,
    pagination,
    isLoading,
    isValidating,
    error,
    refresh,
    optimisticLike,
    optimisticBookmark,
    incrementCommentCount,
  } = useFeed({ 
    userId, 
    refreshInterval: 30000 // Poll every 30 seconds for real-time updates
  });
  
  // Additional items for infinite scroll (pages beyond first)
  const [additionalItems, setAdditionalItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Comments drawer state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

  // Combine SWR items with additional pages
  const allItems = page === 1 ? items : [...items, ...additionalItems];

  // Reset pagination when SWR data changes
  useEffect(() => {
    if (pagination) {
      setHasMore(pagination.hasMore);
    }
  }, [pagination]);

  // Fetch additional pages
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: "10",
      });
      if (userId) params.set("userId", userId);

      const response = await fetch(`/api/feed?${params}`);
      if (!response.ok) throw new Error("Failed to fetch feed");
      
      const data = await response.json();
      
      // Deduplicate
      setAdditionalItems((prev) => {
        const existingIds = new Set([...items, ...prev].map(item => item.id));
        const newItems = data.items.filter((item: FeedItem) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      
      setHasMore(data.pagination.hasMore);
      setPage((p) => p + 1);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, userId, items]);

  // Infinite scroll observer
  useEffect(() => {
    if (isLoading || loadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchMore();
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, isLoading, fetchMore]);

  const handleRefresh = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch("/api/feed/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Reset pagination and refresh
        setPage(1);
        setAdditionalItems([]);
        setTimeout(() => refresh(), 2000);
      }
    } catch (err) {
      console.error("Failed to refresh:", err);
    }
  };

  const handleLike = async (id: string) => {
    await optimisticLike(id);
    
    // Also update additional items if needed
    setAdditionalItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isLiked: !item.isLiked,
              likesCount: item.isLiked ? item.likesCount - 1 : item.likesCount + 1,
            }
          : item
      )
    );
  };

  const handleComment = (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (item) {
      setSelectedItem(item);
      setCommentsOpen(true);
    }
  };

  const handleCloseComments = () => {
    setCommentsOpen(false);
    setSelectedItem(null);
  };

  // Update comment count when a new comment is added
  const handleCommentAdded = (feedItemId: string) => {
    incrementCommentCount(feedItemId);
    
    // Also update additional items
    setAdditionalItems((prev) =>
      prev.map((item) =>
        item.id === feedItemId
          ? { ...item, commentsCount: item.commentsCount + 1 }
          : item
      )
    );
    
    // Update selected item
    if (selectedItem?.id === feedItemId) {
      setSelectedItem((prev) =>
        prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null
      );
    }
  };

  const handleBookmark = async (id: string) => {
    await optimisticBookmark(id);
    
    // Also update additional items
    setAdditionalItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isBookmarked: !item.isBookmarked,
              bookmarksCount: item.isBookmarked
                ? item.bookmarksCount - 1
                : item.bookmarksCount + 1,
            }
          : item
      )
    );
  };

  const handleShare = async (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;

    let shareType = "copy";

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.tldr || item.abstract || "",
          url: item.link || window.location.href,
        });
        shareType = "native";
      } catch {
        navigator.clipboard.writeText(item.link || window.location.href);
      }
    } else {
      navigator.clipboard.writeText(item.link || window.location.href);
    }

    // Track the share
    try {
      await fetch(`/api/feed/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, shareType }),
      });
    } catch (error) {
      console.error("Failed to track share:", error);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <p className="text-red-500 mb-4">{error.message}</p>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Real-time update indicator */}
      {isValidating && !isLoading && (
        <div className="fixed top-4 right-4 z-50 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Updating...
        </div>
      )}

      {/* Feed Items */}
      <div className="pb-20">
        {allItems.map((item) => (
          <FeedCard
            key={item.id}
            {...item}
            isLiked={item.isLiked}
            isBookmarked={item.isBookmarked}
            onLike={handleLike}
            onBookmark={handleBookmark}
            onComment={handleComment}
            onShare={handleShare}
          />
        ))}

        {/* Loading indicator */}
        {(isLoading || loadingMore) && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Load more trigger */}
        {hasMore && !isLoading && !loadingMore && (
          <div ref={loadMoreRef} className="h-10" />
        )}

        {/* End of feed */}
        {!hasMore && allItems.length > 0 && (
          <p className="text-center text-muted-foreground py-8">
            You've caught up! 🎉
          </p>
        )}

        {/* Empty state */}
        {!isLoading && allItems.length === 0 && (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground mb-4">
              No papers in your feed yet.
            </p>
            {userId && (
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Discover Papers
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comments Drawer */}
      {selectedItem && userId && (
        <CommentsDrawer
          isOpen={commentsOpen}
          onClose={handleCloseComments}
          feedItemId={selectedItem.id}
          feedItemTitle={selectedItem.title}
          userId={userId}
          commentsCount={selectedItem.commentsCount}
          onCommentAdded={() => handleCommentAdded(selectedItem.id)}
        />
      )}
    </div>
  );
}
