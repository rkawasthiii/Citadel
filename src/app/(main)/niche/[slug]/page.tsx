"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { FeedCard } from "@/components/feed/FeedCard";
import { CommentsDrawer } from "@/components/feed/CommentsDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/context";

// Generate DiceBear avatar URL for niches (shapes style - not people)
function getNicheAvatarUrl(seed: string, size: number = 128) {
  return `https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
import { ArrowLeft, Loader2, Grid3x3, BookMarked, User, X, ExternalLink, Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";

// Custom hook for intersection observer (infinite scroll)
function useIntersectionObserver(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callback();
      }
    }, options);

    observer.observe(target);
    return () => observer.disconnect();
  }, [callback, options]);

  return targetRef;
}

interface NicheData {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string | null;
  avatarInitials: string;
  avatarColor: string;
  stats: {
    totalPapers: number;
    totalFollowers: number;
  } | null;
}

interface FeedItem {
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
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export default function NichePage() {
  const params = useParams();
  const searchParams = useSearchParams(); // This triggers re-render on navigation
  const slug = decodeURIComponent(params.slug as string);
  const { user } = useUser();
  const userId = user?.id;
  
  const [niche, setNiche] = useState<NicheData | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [selectedPaper, setSelectedPaper] = useState<FeedItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  
  // Comments drawer state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentItem, setCommentItem] = useState<FeedItem | null>(null);
  
  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Track which hash we've already opened
  const openedHashRef = useRef<string | null>(null);
  // Track if we're searching for a deep-linked paper
  const searchingForPaperRef = useRef<string | null>(null);
  // Track current page for fetching
  const currentPageRef = useRef(1);

  // Get paper ID from hash
  const getPaperIdFromHash = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash;
    if (hash && hash.startsWith('#paper-')) {
      return hash.replace('#paper-', '');
    }
    return null;
  }, []);

  // Function to open paper from hash
  const openPaperFromHash = useCallback((paperId: string, itemsList: FeedItem[]) => {
    const paperIndex = itemsList.findIndex(item => item.id === paperId);
    
    if (paperIndex !== -1) {
      // Found the paper - open the modal
      openedHashRef.current = `#paper-${paperId}`;
      searchingForPaperRef.current = null;
      setSelectedPaper(itemsList[paperIndex]);
      setSelectedIndex(paperIndex);
      
      // Scroll to the paper card
      setTimeout(() => {
        const element = document.getElementById(`paper-${paperId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return true;
    }
    return false;
  }, []);

  // Fetch niche data
  const fetchNicheData = useCallback(async (pageNum = 1, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      });
      if (userId) params.set("userId", userId);
      
      const response = await fetch(`/api/niche/${slug}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      
      let newItems: FeedItem[] = [];
      
      if (pageNum === 1) {
        setNiche(data.niche);
        setItems(data.items);
        newItems = data.items;
      } else {
        // Deduplicate items to prevent duplicate key errors
        setItems(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          const filteredNewItems = data.items.filter((item: FeedItem) => !existingIds.has(item.id));
          newItems = [...prev, ...filteredNewItems];
          return newItems;
        });
      }
      
      setHasMore(data.pagination.hasMore);
      setPage(pageNum);
      currentPageRef.current = pageNum;
      
      // If we're searching for a deep-linked paper, check if it's now loaded
      if (searchingForPaperRef.current) {
        const paperId = searchingForPaperRef.current;
        const found = openPaperFromHash(paperId, newItems);
        
        // If not found and there's more data, keep loading
        if (!found && data.pagination.hasMore) {
          // Continue fetching in the background
          setTimeout(() => {
            fetchNicheData(pageNum + 1, true);
          }, 100);
        } else if (!found && !data.pagination.hasMore) {
          // Paper not found in all data, clear the search
          searchingForPaperRef.current = null;
        }
      }
    } catch (error) {
      console.error("Failed to fetch niche data:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [slug, userId, openPaperFromHash]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && !loading && hasMore) {
      fetchNicheData(currentPageRef.current + 1, true);
    }
  }, [loadingMore, loading, hasMore, fetchNicheData]);

  // Infinite scroll observer
  const loadMoreRef = useIntersectionObserver(loadMore, {
    rootMargin: '200px',
    threshold: 0,
  });

  // Initial data fetch
  useEffect(() => {
    // Check if there's a paper ID in the hash
    const paperId = getPaperIdFromHash();
    if (paperId) {
      searchingForPaperRef.current = paperId;
    }
    
    // Reset state for new niche
    setItems([]);
    setPage(1);
    currentPageRef.current = 1;
    setHasMore(true);
    openedHashRef.current = null;
    setIsFollowing(false);
    
    fetchNicheData(1);
    
    // Check follow status
    if (userId) {
      fetch(`/api/niche/${slug}/follow?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.following !== undefined) {
            setIsFollowing(data.following);
          }
        })
        .catch(console.error);
    }
  }, [slug, userId, fetchNicheData, getPaperIdFromHash]);

  // Handle hash changes (e.g., browser back/forward or new navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const paperId = getPaperIdFromHash();
      if (paperId && `#paper-${paperId}` !== openedHashRef.current) {
        // Try to open from current items first
        const found = openPaperFromHash(paperId, items);
        if (!found && hasMore) {
          // Paper not in current items, trigger search
          searchingForPaperRef.current = paperId;
          fetchNicheData(currentPageRef.current + 1, true);
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [items, hasMore, getPaperIdFromHash, openPaperFromHash, fetchNicheData]);

  // Try to open paper when items change (in case it was loaded)
  useEffect(() => {
    if (items.length > 0 && !loading) {
      const paperId = getPaperIdFromHash();
      if (paperId && `#paper-${paperId}` !== openedHashRef.current) {
        openPaperFromHash(paperId, items);
      }
    }
  }, [items, loading, getPaperIdFromHash, openPaperFromHash]);

  const navigatePaper = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
      setSelectedPaper(items[selectedIndex - 1]);
      setShowFullAbstract(false);
      // Update hash to new paper
      window.history.replaceState(null, '', `#paper-${items[selectedIndex - 1].id}`);
    } else if (direction === 'next' && selectedIndex < items.length - 1) {
      setSelectedIndex(selectedIndex + 1);
      setSelectedPaper(items[selectedIndex + 1]);
      setShowFullAbstract(false);
      // Update hash to new paper
      window.history.replaceState(null, '', `#paper-${items[selectedIndex + 1].id}`);
    }
  };

  const closeModal = () => {
    setSelectedPaper(null);
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!userId || followLoading) return;

    setFollowLoading(true);
    const wasFollowing = isFollowing;
    
    // Optimistic update
    setIsFollowing(!wasFollowing);
    if (niche) {
      setNiche(prev => prev ? {
        ...prev,
        stats: {
          ...prev.stats,
          totalPapers: prev.stats?.totalPapers || 0,
          totalFollowers: (prev.stats?.totalFollowers || 0) + (wasFollowing ? -1 : 1),
        }
      } : null);
    }

    try {
      const response = await fetch(`/api/niche/${slug}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to follow");
      
      const data = await response.json();
      setIsFollowing(data.following);
      
      // Update with actual count from server
      if (niche) {
        setNiche(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            totalPapers: prev.stats?.totalPapers || 0,
            totalFollowers: data.followersCount,
          }
        } : null);
      }
    } catch (error) {
      // Revert on error
      setIsFollowing(wasFollowing);
      if (niche) {
        setNiche(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            totalPapers: prev.stats?.totalPapers || 0,
            totalFollowers: (prev.stats?.totalFollowers || 0) + (wasFollowing ? 1 : -1),
          }
        } : null);
      }
      console.error("Failed to follow:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle like
  const handleLike = async (item: FeedItem) => {
    if (!userId) return;

    // Optimistic update
    const newLiked = !item.isLiked;
    const newCount = newLiked ? item.likesCount + 1 : item.likesCount - 1;

    setItems(prev => prev.map(i => 
      i.id === item.id 
        ? { ...i, isLiked: newLiked, likesCount: newCount }
        : i
    ));

    // Update selected paper if it's the same
    if (selectedPaper?.id === item.id) {
      setSelectedPaper(prev => prev ? { ...prev, isLiked: newLiked, likesCount: newCount } : null);
    }

    try {
      await fetch(`/api/feed/${item.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      // Revert on error
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, isLiked: item.isLiked, likesCount: item.likesCount }
          : i
      ));
      if (selectedPaper?.id === item.id) {
        setSelectedPaper(prev => prev ? { ...prev, isLiked: item.isLiked, likesCount: item.likesCount } : null);
      }
      console.error("Failed to like:", error);
    }
  };

  // Handle bookmark
  const handleBookmark = async (item: FeedItem) => {
    if (!userId) return;

    // Optimistic update
    const newBookmarked = !item.isBookmarked;
    const newCount = newBookmarked ? item.bookmarksCount + 1 : item.bookmarksCount - 1;

    setItems(prev => prev.map(i => 
      i.id === item.id 
        ? { ...i, isBookmarked: newBookmarked, bookmarksCount: newCount }
        : i
    ));

    // Update selected paper if it's the same
    if (selectedPaper?.id === item.id) {
      setSelectedPaper(prev => prev ? { ...prev, isBookmarked: newBookmarked, bookmarksCount: newCount } : null);
    }

    try {
      await fetch(`/api/feed/${item.id}/bookmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      // Revert on error
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, isBookmarked: item.isBookmarked, bookmarksCount: item.bookmarksCount }
          : i
      ));
      if (selectedPaper?.id === item.id) {
        setSelectedPaper(prev => prev ? { ...prev, isBookmarked: item.isBookmarked, bookmarksCount: item.bookmarksCount } : null);
      }
      console.error("Failed to bookmark:", error);
    }
  };

  // Handle comment click
  const handleComment = (item: FeedItem) => {
    setCommentItem(item);
    setCommentsOpen(true);
  };

  // Handle comment added
  const handleCommentAdded = (feedItemId: string) => {
    setItems(prev => prev.map(i => 
      i.id === feedItemId 
        ? { ...i, commentsCount: i.commentsCount + 1 }
        : i
    ));
    if (selectedPaper?.id === feedItemId) {
      setSelectedPaper(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
    }
  };

  // Handle share
  const handleShare = async (item: FeedItem) => {
    const shareUrl = item.link || `${window.location.origin}/niche/${slug}#paper-${item.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.tldr || item.abstract || "",
          url: shareUrl,
        });
      } catch {
        navigator.clipboard.writeText(shareUrl);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (loading && !niche) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!niche) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground mb-4">Niche not found</p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-[#dbdbdb] dark:border-[#262626] sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 hover:bg-[#efefef] dark:hover:bg-[#1a1a1a] rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-lg font-semibold truncate">{niche.displayName}</h1>
        </div>
      </div>

      {/* Profile Section */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-4 overflow-hidden">
        <div className="flex gap-6 mb-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <Avatar className="h-20 w-20 md:h-32 md:w-32 ring-2 ring-offset-2 ring-[#c13584] dark:ring-offset-background">
              <AvatarImage 
                src={getNicheAvatarUrl(niche.slug, 144)} 
                alt={niche.displayName}
              />
              <AvatarFallback 
                style={{ backgroundColor: niche.avatarColor }} 
                className="text-white text-2xl md:text-4xl font-semibold"
              >
                {niche.avatarInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-2 mb-3">
              <h2 className="text-base font-light truncate">{niche.displayName}</h2>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={handleFollow}
                  disabled={followLoading || !userId}
                  className={isFollowing 
                    ? "bg-[#efefef] hover:bg-[#dbdbdb] text-[#262626] dark:bg-[#363636] dark:hover:bg-[#262626] dark:text-[#f5f5f5] text-xs font-semibold px-4 rounded-md h-7 shrink-0"
                    : "bg-[#0095f6] hover:bg-[#1877f2] text-white text-xs font-semibold px-4 rounded-md h-7 shrink-0"
                  }
                >
                  {followLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isFollowing ? (
                    "Following"
                  ) : (
                    "Follow"
                  )}
                </Button>
                <Link href={`/dm/${niche.slug}`}>
                  <Button variant="outline" className="text-xs font-semibold px-4 rounded-md h-7 border-[#dbdbdb] dark:border-[#262626] shrink-0">
                    Message
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex gap-5 mb-3 text-xs flex-wrap">
              <div>
                <span className="font-semibold">{niche.stats?.totalPapers || 0}</span>{" "}
                <span className="text-foreground">papers</span>
              </div>
              <div>
                <span className="font-semibold">{niche.stats?.totalFollowers || 0}</span>{" "}
                <span className="text-foreground">followers</span>
              </div>
              <div>
                <span className="font-semibold">0</span>{" "}
                <span className="text-foreground">following</span>
              </div>
            </div>
            
            {/* Bio */}
            <div className="text-xs">
              <p className="font-semibold mb-1">{niche.name}</p>
              {niche.description && (
                <p className="text-foreground whitespace-pre-wrap">{niche.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Highlights/Stories Section */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
          {["Landscape", "Crit", "City", "Plants"].map((highlight, index) => (
            <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-[#fafafa] dark:bg-[#121212] border border-[#dbdbdb] dark:border-[#262626] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                <span className="text-xs text-muted-foreground">+</span>
              </div>
              <span className="text-xs text-foreground max-w-[70px] truncate">{highlight}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-[#dbdbdb] dark:bg-[#262626]" />

      {/* Tabs */}
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-center border-t border-[#dbdbdb] dark:border-[#262626]">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-1 px-4 py-3 text-xs font-semibold tracking-widest border-t ${
              activeTab === "posts"
                ? "border-foreground text-foreground"
                : "border-transparent text-[#8e8e8e] hover:text-[#737373]"
            } -mt-px transition-colors`}
          >
            <Grid3x3 className="w-3 h-3" />
            PAPERS
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex items-center gap-1 px-4 py-3 text-xs font-semibold tracking-widest border-t ${
              activeTab === "saved"
                ? "border-foreground text-foreground"
                : "border-transparent text-[#8e8e8e] hover:text-[#737373]"
            } -mt-px transition-colors`}
          >
            <BookMarked className="w-3 h-3" />
            SAVED
          </button>
        </div>
      </div>

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4"
          onClick={closeModal}
        >
          {/* Navigation Arrows */}
          {selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePaper('prev'); }}
              className="fixed left-2 md:left-6 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {selectedIndex < items.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePaper('next'); }}
              className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-105 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          )}
          
          <div 
            className="bg-white dark:bg-[#1a1a1a] rounded-none md:rounded-2xl max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Compact Header */}
            <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={getNicheAvatarUrl(niche.slug, 72)} />
                  <AvatarFallback 
                    style={{ backgroundColor: niche.avatarColor }}
                    className="text-white text-xs font-semibold"
                  >
                    {niche.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{niche.displayName}</p>
                  <p className="text-xs text-gray-500">{selectedPaper.year || 'Research'}</p>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-5 space-y-5">
                {/* Title */}
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                  {selectedPaper.title}
                </h1>

                {/* Authors */}
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedPaper.authors}
                </p>

                {/* Meta Row */}
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  {selectedPaper.year && (
                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md font-medium">
                      {selectedPaper.year}
                    </span>
                  )}
                  {selectedPaper.journalName && (
                    <a 
                      href={selectedPaper.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {selectedPaper.journalName}
                    </a>
                  )}
                  {selectedPaper.isOpenAccess && (
                    <span className="px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md font-medium">
                      Open Access
                    </span>
                  )}
                  {selectedPaper.quartileRanking && (
                    <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md font-medium">
                      {selectedPaper.quartileRanking}
                    </span>
                  )}
                </div>

                {/* Abstract Section */}
                {selectedPaper.abstract && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Abstract</h3>
                    <div className="relative">
                      <p className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${!showFullAbstract ? 'line-clamp-4' : ''}`}>
                        {selectedPaper.abstract}
                      </p>
                      {selectedPaper.abstract.length > 300 && (
                        <button 
                          onClick={() => setShowFullAbstract(!showFullAbstract)}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1"
                        >
                          {showFullAbstract ? 'Show less' : 'View more'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Citation Stats */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedPaper.citationCount || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Citations</p>
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedPaper.influentialCitationCount || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Influential Citations</p>
                  </div>
                </div>

                {/* Fields of Study */}
                {selectedPaper.fieldsOfStudy && selectedPaper.fieldsOfStudy.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fields of Study</h3>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set(selectedPaper.fieldsOfStudy)].map((field, index) => (
                        <span 
                          key={index}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedPaper.link && (
                    <a
                      href={selectedPaper.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Semantic Scholar
                    </a>
                  )}
                  {selectedPaper.doi && (
                    <a
                      href={`https://doi.org/${selectedPaper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      DOI
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-5 py-3">
              <div className="flex items-center justify-around">
                <button 
                  onClick={() => handleLike(selectedPaper)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <Heart className={`w-5 h-5 transition-colors ${selectedPaper.isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-400 group-hover:text-red-500'}`} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{selectedPaper.likesCount || 0}</span>
                </button>
                <button 
                  onClick={() => handleComment(selectedPaper)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <MessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{selectedPaper.commentsCount || 0}</span>
                </button>
                <button 
                  onClick={() => handleBookmark(selectedPaper)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <Bookmark className={`w-5 h-5 transition-colors ${selectedPaper.isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-gray-600 dark:text-gray-400 group-hover:text-amber-500'}`} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{selectedPaper.bookmarksCount || 0}</span>
                </button>
                <button 
                  onClick={() => handleShare(selectedPaper)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-green-500 transition-colors" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}      {/* Papers Grid - Clean Bento Style */}
      <div className="max-w-3xl mx-auto px-4 pb-24 md:pb-12 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              id={`paper-${item.id}`}
              onClick={() => {
                setSelectedPaper(item);
                setSelectedIndex(index);
                // Update URL hash without page reload
                window.history.replaceState(null, '', `#paper-${item.id}`);
              }}
              className="group relative bg-white dark:bg-[#1a1a1a] border border-[#dbdbdb] dark:border-[#262626] rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              {/* Paper Card Content */}
              <div className="p-4 flex flex-col h-full min-h-[280px]">
                {/* Niche Badge */}
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar className="h-6 w-6 flex-shrink-0 ring-1 ring-[#dbdbdb] dark:ring-[#262626]">
                    <AvatarImage src={getNicheAvatarUrl(niche.slug, 48)} />
                    <AvatarFallback 
                      style={{ backgroundColor: niche.avatarColor }} 
                      className="text-white text-[10px] font-semibold"
                    >
                      {niche.avatarInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-foreground">{niche.displayName}</span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
                  {item.title}
                </h3>

                {/* Authors */}
                <p className="text-xs text-muted-foreground italic mb-3 line-clamp-2 leading-relaxed">
                  {item.authors}
                </p>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Bottom Section */}
                <div className="space-y-3">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {item.year && (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-[#262626] text-[10px] font-medium text-muted-foreground">
                        📅 {item.year}
                      </span>
                    )}
                    {item.quartileRanking && (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[10px] font-medium">
                        {item.quartileRanking}
                      </span>
                    )}
                    {item.citationCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                        📚 {item.citationCount}
                      </span>
                    )}
                  </div>

                  {/* Stats Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#efefef] dark:border-[#262626]">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleLike(item); }}
                      className={`flex items-center gap-1.5 transition-colors ${item.isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                    >
                      <Heart className={`w-4 h-4 ${item.isLiked ? 'fill-current' : ''}`} />
                      <span className="text-xs font-medium">{item.likesCount}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleComment(item); }}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">{item.commentsCount}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBookmark(item); }}
                      className={`flex items-center gap-1.5 transition-colors ${item.isBookmarked ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                    >
                      <Bookmark className={`w-4 h-4 ${item.isBookmarked ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading More State */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#8e8e8e]" />
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {hasMore && !loading && !loadingMore && items.length > 0 && (
          <div ref={loadMoreRef} className="h-20" />
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-4 rounded-full border-2 border-[#dbdbdb] dark:border-[#262626] mb-4">
              <Grid3x3 className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No papers yet</p>
          </div>
        )}

        {/* End State */}
        {!hasMore && items.length > 0 && !loading && !loadingMore && (
          <div className="text-center py-12">
            <div className="inline-block p-3 rounded-full border-2 border-foreground mb-4">
              <User className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground">You've seen all papers</p>
          </div>
        )}n      </div>

      {/* Comments Drawer */}
      {commentItem && userId && (
        <CommentsDrawer
          feedItemId={commentItem.id}
          feedItemTitle={commentItem.title}
          userId={userId}
          isOpen={commentsOpen}
          onClose={() => {
            setCommentsOpen(false);
            setCommentItem(null);
          }}
          commentsCount={commentItem.commentsCount}
          onCommentAdded={() => handleCommentAdded(commentItem.id)}
        />
      )}
    </div>
  );
}
