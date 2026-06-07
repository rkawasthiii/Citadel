"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, ExternalLink, Loader2, Heart, MessageCircle, Bookmark } from "lucide-react";

interface Paper {
  id: string;
  paperId: string;
  title: string;
  abstract: string | null;
  authors: string;
  year: number | null;
  journalName: string | null;
  citationCount: number;
  influentialCitationCount: number;
  tldr: string | null;
  link: string | null;
  pdfLink: string | null;
  isOpenAccess: boolean;
  fieldsOfStudy: string[];
  quartileRanking: string | null;
  nicheSlug: string | null;
  nicheName: string | null;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 500);

  const searchPapers = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setPapers([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setPapers(data.papers || []);
    } catch (error) {
      console.error("Search failed:", error);
      setPapers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchPapers(debouncedQuery);
  }, [debouncedQuery, searchPapers]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearSearch = () => {
    setQuery("");
    setPapers([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-2xl mx-auto px-3 md:px-4 pt-4 md:pt-6 pb-8">
      {/* Search Input - Sticky */}
          <div className="sticky top-0 bg-background pt-2 pb-3 md:pb-4 z-10">
            <div className="relative">
              <Search className="absolute left-3 md:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search papers..."
                className="w-full h-10 md:h-11 pl-9 md:pl-10 pr-9 md:pr-10 rounded-lg border border-border/60 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:bg-background focus:border-border transition-colors"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Results count */}
            {hasSearched && !isLoading && papers.length > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-2 md:mt-3 px-1">
                {papers.length} results
              </p>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          )}

          {/* Empty - Before Search */}
          {!hasSearched && !isLoading && (
            <div className="text-center py-20">
              <p className="text-muted-foreground/50 text-sm">
                Search for papers by title or topic
              </p>
            </div>
          )}

          {/* No Results */}
          {hasSearched && !isLoading && papers.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground/60 text-sm">
                No results for &quot;{query}&quot;
              </p>
            </div>
          )}

          {/* Results */}
          {!isLoading && papers.length > 0 && (
            <div className="space-y-1">
              {papers.map((paper) => (
                <PaperRow key={paper.id} paper={paper} />
              ))}
            </div>
          )}
        </div>
  );
}

function PaperRow({ paper }: { paper: Paper }) {
  const router = useRouter();
  const uniqueFields = [...new Set(paper.fieldsOfStudy || [])];
  
  const handleClick = () => {
    if (paper.nicheSlug) {
      // Navigate to niche page with paper ID in hash for deep linking
      router.push(`/niche/${paper.nicheSlug}#paper-${paper.id}`);
    }
  };
  
  return (
    <div 
      onClick={handleClick}
      className="group py-3 md:py-4 px-2 md:px-3 -mx-2 rounded-lg border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Niche badge */}
      {paper.nicheName && (
        <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] md:text-[11px] font-medium mb-1.5 md:mb-2">
          {paper.nicheName}
        </span>
      )}
      
      {/* Title */}
      <h3 className="font-medium text-sm md:text-[15px] leading-relaxed mb-1 group-hover:text-primary transition-colors">
        {paper.title}
      </h3>

      {/* Authors */}
      <p className="text-xs md:text-[13px] text-muted-foreground/70 mb-1.5 md:mb-2 line-clamp-1">
        {paper.authors}
      </p>

      {/* Meta line */}
      <div className="flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground/60 mb-1.5 md:mb-2">
        {paper.year && (
          <span>{paper.year}</span>
        )}
        {paper.year && paper.citationCount > 0 && <span>·</span>}
        {paper.citationCount > 0 && (
          <span>{paper.citationCount.toLocaleString()} citations</span>
        )}
        {paper.isOpenAccess && (
          <>
            <span>·</span>
            <span className="text-green-600 dark:text-green-500">Open Access</span>
          </>
        )}
      </div>

      {/* TLDR */}
      {paper.tldr && (
        <p className="text-[13px] text-muted-foreground/60 line-clamp-2 mb-2.5">
          {paper.tldr}
        </p>
      )}

      {/* Fields + Engagement Stats */}
      <div className="flex items-center justify-between gap-4">
        {/* Fields */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {uniqueFields.slice(0, 3).map((field, index) => (
            <span
              key={`${field}-${index}`}
              className="px-2 py-0.5 rounded-md bg-muted/60 text-[11px] text-muted-foreground/70"
            >
              {field}
            </span>
          ))}
        </div>

        {/* Engagement stats */}
        <div className="flex items-center gap-3 shrink-0 text-muted-foreground/50 text-xs">
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {paper.likesCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {paper.commentsCount}
          </span>
          <span className="flex items-center gap-1">
            <Bookmark className="h-3.5 w-3.5" />
            {paper.bookmarksCount}
          </span>
        </div>
      </div>
    </div>
  );
}
