import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comments, users, feedItems, userInteractions, userNicheWeights } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { inngest } from "@/lib/inngest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const feedComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userId: comments.userId,
        userName: users.name,
        userUsername: users.username,
        userAvatar: users.avatar,
        likesCount: comments.likesCount,
        repliesCount: comments.repliesCount,
        parentCommentId: comments.parentCommentId,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(and(
        eq(comments.feedItemId, id),
        eq(comments.isDeleted, false)
      ))
      .orderBy(desc(comments.createdAt));

    return NextResponse.json({ comments: feedComments });
  } catch (error) {
    console.error("Failed to get comments:", error);
    return NextResponse.json(
      { error: "Failed to get comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, content, parentCommentId } = body;

    if (!userId || !content) {
      return NextResponse.json(
        { error: "userId and content are required" },
        { status: 400 }
      );
    }

    // Get the feed item to find nicheId
    const feedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
    });

    if (!feedItem) {
      return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
    }

    // Create comment
    const [newComment] = await db
      .insert(comments)
      .values({
        userId,
        feedItemId: id,
        content,
        parentCommentId: parentCommentId || null,
      })
      .returning();

    // Increment comments count on feed item
    await db
      .update(feedItems)
      .set({ commentsCount: sql`${feedItems.commentsCount} + 1` })
      .where(eq(feedItems.id, id));

    // If it's a reply, increment repliesCount on parent
    if (parentCommentId) {
      await db
        .update(comments)
        .set({ repliesCount: sql`${comments.repliesCount} + 1` })
        .where(eq(comments.id, parentCommentId));
    }

    // Track interaction
    await db.insert(userInteractions).values({
      userId,
      feedItemId: id,
      nicheId: feedItem.nicheId,
      interactionType: "comment",
      metadata: { commentId: newComment.id },
    });

    // Update user niche weights
    await updateUserNicheWeight(userId, feedItem.nicheId);

    // Get user info for response
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, username: true, avatar: true },
    });

    // Get updated comment count
    const updatedItem = await db.query.feedItems.findFirst({
      where: eq(feedItems.id, id),
      columns: { commentsCount: true },
    });

    // Broadcast realtime update via Inngest
    await inngest.send({
      name: "feed/comment.created",
      data: {
        feedItemId: id,
        userId,
        userName: user?.name || null,
        commentId: newComment.id,
        content: content.slice(0, 100), // Truncate for broadcast
        newCount: updatedItem?.commentsCount || 1,
      },
    });

    return NextResponse.json({ 
      comment: {
        ...newComment,
        userName: user?.name,
        userUsername: user?.username,
        userAvatar: user?.avatar,
      } 
    });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// DELETE endpoint for removing comments
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: feedItemId } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");
    const userId = searchParams.get("userId");

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: "commentId and userId are required" },
        { status: 400 }
      );
    }

    // Get the comment to verify ownership
    const comment = await db.query.comments.findFirst({
      where: and(
        eq(comments.id, commentId),
        eq(comments.userId, userId)
      ),
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found or unauthorized" },
        { status: 404 }
      );
    }

    // Soft delete the comment
    await db
      .update(comments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(comments.id, commentId));

    // Decrement comments count
    await db
      .update(feedItems)
      .set({ commentsCount: sql`GREATEST(${feedItems.commentsCount} - 1, 0)` })
      .where(eq(feedItems.id, feedItemId));

    // If it was a reply, decrement parent's replies count
    if (comment.parentCommentId) {
      await db
        .update(comments)
        .set({ repliesCount: sql`GREATEST(${comments.repliesCount} - 1, 0)` })
        .where(eq(comments.id, comment.parentCommentId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}

// Helper function to update user niche weights for comments
async function updateUserNicheWeight(userId: string, nicheId: string) {
  try {
    const existing = await db.query.userNicheWeights.findFirst({
      where: and(
        eq(userNicheWeights.userId, userId),
        eq(userNicheWeights.nicheId, nicheId)
      ),
    });

    if (existing) {
      await db
        .update(userNicheWeights)
        .set({
          totalComments: sql`${userNicheWeights.totalComments} + 1`,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userNicheWeights.userId, userId),
            eq(userNicheWeights.nicheId, nicheId)
          )
        );
    } else {
      await db.insert(userNicheWeights).values({
        userId,
        nicheId,
        totalComments: 1,
        lastInteractionAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Failed to update user niche weight:", error);
  }
}
