import { inngest, feedChannel } from "./client";

// ============================================================================
// REALTIME BROADCAST FUNCTIONS
// ============================================================================

/**
 * Broadcast a like/unlike event to all connected users
 */
export const broadcastLikeUpdate = inngest.createFunction(
  {
    id: "broadcast-like-update",
    name: "Broadcast Like Update",
  },
  { event: "feed/like.updated" },
  async ({ event, publish }) => {
    const { feedItemId, userId, action, newCount } = event.data;

    // Publish to the feed channel so all connected clients receive the update
    await publish(
      feedChannel().like({
        feedItemId,
        userId,
        action,
        newCount,
      })
    );

    return { success: true, broadcasted: "like", feedItemId };
  }
);

/**
 * Broadcast a new comment event to all connected users
 */
export const broadcastCommentUpdate = inngest.createFunction(
  {
    id: "broadcast-comment-update",
    name: "Broadcast Comment Update",
  },
  { event: "feed/comment.created" },
  async ({ event, publish }) => {
    const { feedItemId, userId, userName, commentId, content, newCount } = event.data;

    await publish(
      feedChannel().comment({
        feedItemId,
        userId,
        userName,
        commentId,
        content,
        newCount,
      })
    );

    return { success: true, broadcasted: "comment", feedItemId };
  }
);

/**
 * Broadcast a bookmark event to all connected users
 */
export const broadcastBookmarkUpdate = inngest.createFunction(
  {
    id: "broadcast-bookmark-update",
    name: "Broadcast Bookmark Update",
  },
  { event: "feed/bookmark.updated" },
  async ({ event, publish }) => {
    const { feedItemId, userId, action, newCount } = event.data;

    await publish(
      feedChannel().bookmark({
        feedItemId,
        userId,
        action,
        newCount,
      })
    );

    return { success: true, broadcasted: "bookmark", feedItemId };
  }
);
