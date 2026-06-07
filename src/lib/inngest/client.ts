import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";
import { channel, topic } from "@inngest/realtime";
import { z } from "zod";

// Create a client to send and receive events with realtime middleware
export const inngest = new Inngest({
  id: "veritus-feeds",
  name: "Veritus Feeds for Researchers",
  middleware: [realtimeMiddleware()],
});

// ============================================================================
// REALTIME CHANNELS FOR LIVE UPDATES
// ============================================================================

// Feed channel for broadcasting likes, comments, bookmarks across all users
export const feedChannel = channel("feed-updates")
  .addTopic(
    topic("like").schema(
      z.object({
        feedItemId: z.string(),
        userId: z.string(),
        action: z.enum(["liked", "unliked"]),
        newCount: z.number(),
      })
    )
  )
  .addTopic(
    topic("comment").schema(
      z.object({
        feedItemId: z.string(),
        userId: z.string(),
        userName: z.string().nullable(),
        commentId: z.string(),
        content: z.string(),
        newCount: z.number(),
      })
    )
  )
  .addTopic(
    topic("bookmark").schema(
      z.object({
        feedItemId: z.string(),
        userId: z.string(),
        action: z.enum(["bookmarked", "unbookmarked"]),
        newCount: z.number(),
      })
    )
  );

// Niche-specific channel for updates within a niche
export const nicheChannel = channel((nicheSlug: string) => `niche:${nicheSlug}`)
  .addTopic(
    topic("new-paper").schema(
      z.object({
        feedItemId: z.string(),
        title: z.string(),
        nicheSlug: z.string(),
      })
    )
  );
