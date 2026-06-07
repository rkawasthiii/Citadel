"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, User, ArrowLeft, MoreVertical, Search, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MemoizedStreamingMarkdown, StreamingMarkdown } from "./MarkdownRenderer";
import { useChatContext } from "@/lib/chat/ChatContext";
import { useUser } from "@/lib/context";

// Generate DiceBear avatar URL
function getAvatarUrl(seed: string, size: number = 64) {
  return `https://api.dicebear.com/9.x/notionists/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}

// Get initials from name
function getInitials(name?: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return "U";
}

interface NichePersona {
  name: string;
  role: string;
  greeting: string;
  expertise: string[];
  suggestedPrompts: string[];
  avatarUrl?: string;
}

interface ChatInterfaceProps {
  nicheSlug: string;
  nicheName: string;
  nicheInitials: string;
  nicheColor: string;
  persona?: NichePersona;
}

export function ChatInterface({
  nicheSlug,
  nicheName,
  nicheInitials,
  nicheColor,
  persona,
}: ChatInterfaceProps) {
  const { user, appUser } = useUser();
  const [showGreeting, setShowGreeting] = useState(true);
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasLoadedRef = useRef(false);
  const prevMessageCountRef = useRef(0);
  const isNewConversationRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const router = useRouter();
  
  // User avatar info
  const displayName = appUser?.name || user?.displayName || "User";
  const username = appUser?.username || user?.primaryEmail?.split("@")[0] || "user";
  const userAvatarUrl = appUser?.avatar || user?.profileImageUrl || null;
  const userInitials = getInitials(displayName);
  
  // Use chat context for caching
  const { 
    getCachedMessages, 
    setCachedMessages, 
    isCacheStale,
  } = useChatContext();

  // Create transport for custom API endpoint
  const createTransport = useCallback(() => {
    return new DefaultChatTransport({
      api: `/api/chat/${nicheSlug}`,
    });
  }, [nicheSlug]);

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: createTransport(),
  });

  // Fetch message history on mount - with caching (runs once per nicheSlug)
  useEffect(() => {
    // Reset refs when nicheSlug changes
    hasLoadedRef.current = false;
    prevMessageCountRef.current = 0;
    isNewConversationRef.current = false;
    setIsLoadingHistory(true);
    setShowGreeting(true);
    
    async function fetchHistory() {
      // Check cache first
      const cachedMessages = getCachedMessages(nicheSlug);
      
      if (cachedMessages && cachedMessages.length > 0 && !isCacheStale(nicheSlug)) {
        // Use cached messages
        setMessages(cachedMessages);
        setShowGreeting(false);
        setIsLoadingHistory(false);
        hasLoadedRef.current = true;
        prevMessageCountRef.current = cachedMessages.length;
        // Instant scroll after DOM update
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        });
        return;
      }
      
      // Fetch from server
      try {
        const response = await fetch(`/api/chat/${nicheSlug}/messages`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            setCachedMessages(nicheSlug, data.messages);
            setShowGreeting(false);
            prevMessageCountRef.current = data.messages.length;
          } else {
            // No messages - this is a new conversation
            isNewConversationRef.current = true;
          }
        }
      } catch (err) {
        console.error("Failed to fetch message history:", err);
      } finally {
        setIsLoadingHistory(false);
        hasLoadedRef.current = true;
      }
    }
    fetchHistory();
  }, [nicheSlug]); // Only depend on nicheSlug - functions are stable now

  const isLoading = status === "streaming" || status === "submitted";
  const scrollRAFRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);

  // Check if user is at bottom of scroll container
  const isAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // Consider "at bottom" if within 150px of bottom (gives space for streaming)
    return scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  // Smooth scroll to bottom - throttled to prevent jitter during streaming
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!messagesContainerRef.current) return;
    
    // Cancel any pending scroll
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
    
    // Throttle scrolls during streaming to reduce jitter (max once per 50ms)
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTimeRef.current;
    
    if (behavior === 'smooth' && timeSinceLastScroll < 50) {
      // Schedule scroll for later
      scrollRAFRef.current = requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
      return;
    }
    
    lastScrollTimeRef.current = now;
    
    scrollRAFRef.current = requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        // Use scrollTop assignment for smoother continuous scrolling during streaming
        if (behavior === 'auto') {
          container.scrollTop = container.scrollHeight;
        } else {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: behavior,
          });
        }
      }
    });
  }, []);

  // Handle scroll to detect if user scrolled away from bottom
  const handleScroll = useCallback(() => {
    shouldAutoScrollRef.current = isAtBottom();
  }, [isAtBottom]);

  // Auto-scroll on new messages if user is at bottom
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    // For initial load, always scroll instantly
    if (prevMessageCountRef.current === 0 && messages.length > 0) {
      scrollToBottom('auto');
      return;
    }
    
    // Only auto-scroll if user is at bottom
    if (shouldAutoScrollRef.current) {
      // During streaming, use instant scroll to prevent jitter
      // The content naturally pushes down, instant keeps it smooth
      if (status === "streaming") {
        scrollToBottom('auto');
      } else {
        scrollToBottom('smooth');
      }
    }
  }, [messages, scrollToBottom, status]);

  // Update cache and handle new conversation sidebar refresh
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    
    if (messages.length > 0) {
      setShowGreeting(false);
      
      // Only update cache if messages actually changed
      if (messages.length !== prevMessageCountRef.current) {
        setCachedMessages(nicheSlug, messages);
        prevMessageCountRef.current = messages.length;
        
        // If this was a new conversation and we now have AI response, refresh sidebar
        if (isNewConversationRef.current && messages.length >= 2) {
          isNewConversationRef.current = false;
          router.refresh();
        }
      }
    }
  }, [messages.length, nicheSlug, setCachedMessages, router]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      const messageText = input;
      sendMessage({ text: messageText });
      setInput("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.blur(); // Blur to hide keyboard briefly
        setTimeout(() => inputRef.current?.focus(), 50); // Refocus quickly
      }
      // Enable auto-scroll and scroll to bottom
      shouldAutoScrollRef.current = true;
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  };

  // Handle Enter key (without shift) to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        const messageText = input;
        sendMessage({ text: messageText });
        setInput("");
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
        }
        // Enable auto-scroll and scroll to bottom
        shouldAutoScrollRef.current = true;
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    }
  };

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  // Handle textarea focus - ensure it's visible above keyboard on mobile
  const handleTextareaFocus = () => {
    // Small delay to let keyboard animation start
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "nearest",
        });
      }
    }, 300);
  };

  // Suggested prompts
  const suggestedPrompts = persona?.suggestedPrompts || [
    `What are the latest trends in ${nicheName}?`,
    `Find papers about recent breakthroughs`,
    `Explain the concept of...`,
  ];

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Helper to get message text content from parts
  const getMessageContent = (message: (typeof messages)[0]): string => {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  // Check if any message has active tool calls (type starts with "tool-")
  const hasActiveToolCall = messages.some((msg) => {
    return msg.parts.some((part) => {
      if (part.type.startsWith("tool-")) {
        // Tool parts have state property
        const toolPart = part as { type: string; state?: string };
        return toolPart.state === "call" || toolPart.state === "partial-call" || toolPart.state === "input-streaming";
      }
      return false;
    });
  });

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[#dbdbdb] dark:border-[#262626] px-3 py-2.5 flex items-center gap-2.5 bg-background">
        {/* Back button for mobile */}
        <Link href="/dm" className="md:hidden">
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        
        <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-primary/20">
          {persona?.avatarUrl && (
            <AvatarImage src={persona.avatarUrl} alt={persona.name} />
          )}
          <AvatarFallback
            style={{ backgroundColor: nicheColor }}
            className="text-white font-semibold"
          >
            {nicheInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm md:text-base truncate">{persona?.name || nicheName}</h2>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {persona?.role || `${nicheName} Research Assistant`}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 relative h-8 w-8">
          <Video className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-[7px] md:text-[9px] text-primary-foreground px-1 py-0.5 rounded-full font-medium whitespace-nowrap">
            Soon
          </span>
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col scroll-smooth"
        style={{ scrollBehavior: status === 'streaming' ? 'auto' : 'smooth' }}
      >
        <div className="p-3 md:p-4 space-y-1.5 md:space-y-2 pb-24 md:pb-28">
        {/* Greeting / Welcome Message */}
        {showGreeting && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 md:py-12 px-3 md:px-4">
            {/* Avatar */}
            <Avatar className="h-12 w-12 md:h-16 md:w-16 mb-3 md:mb-4">
              {persona?.avatarUrl && (
                <AvatarImage src={persona.avatarUrl} alt={persona.name} />
              )}
              <AvatarFallback
                style={{ backgroundColor: nicheColor }}
                className="text-white text-xl font-semibold"
              >
                {nicheInitials}
              </AvatarFallback>
            </Avatar>
            
            {/* Name & Role */}
            <h3 className="text-base md:text-lg font-semibold mb-1">{persona?.name || nicheName}</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6">{persona?.role || `${nicheName} Research`}</p>
            
            {/* Greeting */}
            <p className="text-center text-sm md:text-[15px] text-foreground/90 max-w-md mb-6 md:mb-8 leading-relaxed px-2">
              {persona?.greeting || `Hey! I help people explore ${nicheName} research. What are you curious about?`}
            </p>

            {/* Suggested Prompts */}
            <div className="w-full max-w-sm space-y-1.5 md:space-y-2">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border border-border/60 hover:border-border hover:bg-muted/50 transition-colors text-xs md:text-sm text-foreground/80"
                  onClick={() => handleSuggestedPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message List */}
        {(() => {
          const filteredMessages = messages.filter((message) => {
            const content = getMessageContent(message);
            return content && content.trim().length > 0;
          });
          
          return filteredMessages.map((message, index) => {
            // Only apply min-height during active streaming on the last message
            const isLastMessage = index === filteredMessages.length - 1;
            // Only apply the ChatGPT-style min-height when actively streaming (not on page refresh/load)
            const shouldApplyMinHeight = isLastMessage && isLoading && status === "streaming";
            
            return (
          <div
            key={message.id}
            className={cn(
              "flex gap-2 md:gap-3",
              message.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
            style={shouldApplyMinHeight ? { minHeight: 'calc(100dvh - 280px)' } : undefined}
          >
            <Avatar className="h-7 w-7 md:h-8 md:w-8 shrink-0">
              {message.role === "assistant" ? (
                <>
                  {persona?.avatarUrl && (
                    <AvatarImage src={persona.avatarUrl} alt={persona.name} />
                  )}
                  <AvatarFallback
                    style={{ backgroundColor: nicheColor }}
                    className="text-white text-xs font-semibold"
                  >
                    {nicheInitials}
                  </AvatarFallback>
                </>
              ) : (
                <>
                  {userAvatarUrl ? (
                    <AvatarImage src={userAvatarUrl} alt={displayName} />
                  ) : (
                    <AvatarImage src={getAvatarUrl(username, 64)} alt={displayName} />
                  )}
                  <AvatarFallback className="bg-linear-to-br from-purple-500 to-pink-500 text-white text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </>
              )}
            </Avatar>

            <div
              className={cn(
                "max-w-[85%] md:max-w-[80%] px-3 md:px-4 py-2 md:py-2.5 rounded-2xl overflow-hidden",
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : ""
              )}
            >
              {message.role === "assistant" ? (
                // Use non-memoized version during streaming for real-time token updates
                isLastMessage && status === "streaming" ? (
                  <StreamingMarkdown
                    content={getMessageContent(message)}
                    className="text-xs md:text-sm"
                  />
                ) : (
                  <MemoizedStreamingMarkdown
                    content={getMessageContent(message)}
                    className="text-xs md:text-sm"
                  />
                )
              ) : (
                <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {getMessageContent(message)}
                </div>
              )}
            </div>
          </div>
            );
          });
        })()}

        {/* Loading indicator - show when loading and last message is empty or from user */}
        {isLoading && messages.length > 0 && (
          messages[messages.length - 1].role === "user" || !getMessageContent(messages[messages.length - 1])
        ) && (
          <div 
            className="flex gap-2 md:gap-3"
          >
            <Avatar className="h-7 w-7 md:h-8 md:w-8 shrink-0">
              {persona?.avatarUrl && (
                <AvatarImage src={persona.avatarUrl} alt={persona.name} />
              )}
              <AvatarFallback
                style={{ backgroundColor: nicheColor }}
                className="text-white text-xs font-semibold"
              >
                {nicheInitials}
              </AvatarFallback>
            </Avatar>
            <div className="px-3 py-2 md:px-4 md:py-3">
              {hasActiveToolCall ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-3 w-3 md:h-3.5 md:w-3.5 animate-pulse" />
                  <span className="text-xs md:text-sm">Searching papers...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-foreground/30 rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-foreground/30 rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-foreground/30 rounded-full typing-dot" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            <p>Error: {error.message}</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area with gradient fade */}
      <div className="shrink-0 relative">
        {/* Gradient overlay */}
        <div className="absolute -top-12 left-0 right-0 h-12 bg-linear-to-t from-background to-transparent pointer-events-none" />
        
        <div className="px-3 md:px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-1 pt-1.5 md:pt-2 bg-background">
          <form onSubmit={handleSubmit} className="flex items-end gap-1.5 md:gap-2 max-w-3xl mx-auto">
            <div className="flex-1 relative flex items-center">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                onFocus={handleTextareaFocus}
                placeholder={`Message ${persona?.name || nicheName}...`}
                className="w-full resize-none rounded-2xl border border-border/50 bg-muted/30 px-3 py-2.5 pr-10 md:px-4 md:py-3 md:pr-12 text-xs md:text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:border-border focus-visible:bg-background transition-colors min-h-[38px] md:min-h-[42px] max-h-[100px] md:max-h-[120px] scrollbar-hide"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 h-7 w-7 md:h-8 md:w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 disabled:opacity-30"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                )}
              </Button>
            </div>
          </form>
          <p className="hidden md:block text-[11px] text-muted-foreground/50 mt-1.5 text-center px-2">
            {persona?.name || "AI"} can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </div>
  );
}
