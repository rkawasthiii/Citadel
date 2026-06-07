"use server";

import { getSubscriptionToken } from "@inngest/realtime";
import { inngest, feedChannel } from "@/lib/inngest";

// Check if Inngest is properly configured for realtime
const isInngestRealtimeConfigured = !!(
  process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY
);

/**
 * Server action to fetch a subscription token for the feed realtime channel.
 * This token is used by clients to securely subscribe to feed updates.
 * Returns null if Inngest is not configured.
 */
export async function fetchFeedSubscriptionToken() {
  // Skip if Inngest realtime is not configured
  if (!isInngestRealtimeConfigured) {
    return null;
  }

  try {
    const token = await getSubscriptionToken(inngest, {
      channel: feedChannel(),
      topics: ["like", "comment", "bookmark"],
    });
    return token;
  } catch (error) {
    console.warn("Failed to get Inngest subscription token:", error);
    return null;
  }
}
