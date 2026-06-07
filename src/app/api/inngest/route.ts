import { serve } from "inngest/next";
import { 
  inngest, 
  functions, 
  nicheFeedFunctions, 
  embeddingFunctions,
  broadcastLikeUpdate,
  broadcastCommentUpdate,
  broadcastBookmarkUpdate,
} from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...functions, 
    ...nicheFeedFunctions, 
    ...embeddingFunctions,
    // Realtime broadcast functions
    broadcastLikeUpdate,
    broadcastCommentUpdate,
    broadcastBookmarkUpdate,
  ],
});
