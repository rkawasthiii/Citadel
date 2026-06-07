"use client";

import { useState, useEffect, useRef } from "react";
import { X, Heart, Send, ChevronDown, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/context";
import Image from "next/image";

// Get initials from name or email
function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

// Generate a color based on user ID or name
function getUserColor(seed: string): string {
  const colors = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981",
    "#06b6d4", "#6366f1", "#f43f5e", "#84cc16", "#14b8a6"
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  userName: string | null;
  userUsername: string | null;
  userAvatar: string | null;
  likesCount: number;
  repliesCount: number;
  parentCommentId: string | null;
}

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feedItemId: string;
  feedItemTitle: string;
  userId: string;
  commentsCount: number;
  onCommentAdded?: () => void;
}

export function CommentsDrawer({
  isOpen,
  onClose,
  feedItemId,
  feedItemTitle,
  userId,
  commentsCount: initialCommentsCount,
  onCommentAdded,
}: CommentsDrawerProps) {
  const { user, appUser } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Get user display info for the input avatar
  const displayName = appUser?.name || user?.displayName || user?.primaryEmail?.split("@")[0] || "User";
  const avatarUrl = appUser?.avatar || user?.profileImageUrl || null;
  const initials = getInitials(displayName, user?.primaryEmail);
  const avatarColor = getUserColor(user?.id || "default");

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Fetch comments when drawer opens
  useEffect(() => {
    if (isOpen && feedItemId) {
      fetchComments();
    }
  }, [isOpen, feedItemId]);

  // Focus input when replying and scroll into view
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [replyingTo]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feed/${feedItemId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/feed/${feedItemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          content: newComment.trim(),
          parentCommentId: replyingTo?.id || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments((prev) => [data.comment, ...prev]);
        setCommentsCount((prev) => prev + 1);
        setNewComment("");
        setReplyingTo(null);
        // Notify parent to update feed item count
        onCommentAdded?.();
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment("");
  };

  // Group comments: top-level and their replies
  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = comments.reduce((acc, comment) => {
    if (comment.parentCommentId) {
      if (!acc[comment.parentCommentId]) {
        acc[comment.parentCommentId] = [];
      }
      acc[comment.parentCommentId].push(comment);
    }
    return acc;
  }, {} as Record<string, Comment[]>);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[60] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-[#262626] rounded-t-[12px] h-[85vh] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-[#dbdbdb] dark:bg-[#363636] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#efefef] dark:border-[#363636]">
          <div className="w-8" />
          <h2 className="text-[16px] font-semibold text-[#262626] dark:text-[#f5f5f5]">
            Comments
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:opacity-70 transition-opacity"
          >
            <X className="w-6 h-6 text-[#262626] dark:text-[#f5f5f5]" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#8e8e8e]" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[16px] font-semibold text-[#262626] dark:text-[#f5f5f5] mb-1">
                No comments yet
              </p>
              <p className="text-[14px] text-[#8e8e8e]">
                Start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topLevelComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replies={repliesByParent[comment.id] || []}
                  onReply={handleReply}
                />
              ))}
            </div>
          )}
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 py-2 bg-[#fafafa] dark:bg-[#1a1a1a] border-t border-[#efefef] dark:border-[#363636] flex items-center justify-between">
            <span className="text-[13px] text-[#8e8e8e]">
              Replying to{" "}
              <span className="font-semibold text-[#262626] dark:text-[#f5f5f5]">
                @{replyingTo.userUsername || "user"}
              </span>
            </span>
            <button
              onClick={cancelReply}
              className="text-[13px] font-semibold text-[#0095f6]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 px-4 py-3 border-t border-[#efefef] dark:border-[#363636] bg-white dark:bg-[#262626] mt-auto shrink-0"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback 
                style={{ backgroundColor: avatarColor }}
                className="text-white text-xs font-semibold"
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={(e) => {
              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
            className="flex-1 bg-transparent text-[14px] text-[#262626] dark:text-[#f5f5f5] placeholder:text-[#8e8e8e] outline-none"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="text-[14px] font-semibold text-[#0095f6] disabled:opacity-30 transition-opacity"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Post"
            )}
          </button>
        </form>
      </div>
    </>
  );
}

// Individual comment component
function CommentItem({
  comment,
  replies,
  onReply,
  isReply = false,
}: {
  comment: Comment;
  replies?: Comment[];
  onReply: (comment: Comment) => void;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: false,
  });

  return (
    <div className={isReply ? "ml-10" : ""}>
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          {comment.userAvatar && (
            <AvatarImage src={comment.userAvatar} alt={comment.userName || ""} />
          )}
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
            {comment.userName?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] leading-[18px]">
                <span className="font-semibold text-[#262626] dark:text-[#f5f5f5] mr-1">
                  {comment.userUsername || comment.userName || "User"}
                </span>
                <span className="text-[#262626] dark:text-[#f5f5f5]">
                  {comment.content}
                </span>
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[12px] text-[#8e8e8e]">{timeAgo}</span>
                {comment.likesCount > 0 && (
                  <span className="text-[12px] text-[#8e8e8e] font-semibold">
                    {comment.likesCount} {comment.likesCount === 1 ? "like" : "likes"}
                  </span>
                )}
                <button
                  onClick={() => onReply(comment)}
                  className="text-[12px] text-[#8e8e8e] font-semibold hover:text-[#262626] dark:hover:text-[#f5f5f5]"
                >
                  Reply
                </button>
              </div>
            </div>

            <button
              onClick={() => setLiked(!liked)}
              className="p-1 flex-shrink-0"
            >
              <Heart
                className={`w-3 h-3 ${
                  liked
                    ? "fill-[#ed4956] text-[#ed4956]"
                    : "text-[#8e8e8e] hover:text-[#262626] dark:hover:text-[#f5f5f5]"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies && replies.length > 0 && (
        <div className="mt-2">
          {!showReplies ? (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-2 ml-11 text-[12px] text-[#8e8e8e] font-semibold"
            >
              <div className="w-6 h-[1px] bg-[#8e8e8e]" />
              View {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowReplies(false)}
                className="flex items-center gap-2 ml-11 text-[12px] text-[#8e8e8e] font-semibold mb-2"
              >
                <div className="w-6 h-[1px] bg-[#8e8e8e]" />
                Hide replies
              </button>
              <div className="space-y-3">
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    onReply={onReply}
                    isReply
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
