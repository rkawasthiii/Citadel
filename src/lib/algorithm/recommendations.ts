import { db } from "@/lib/db";
import { 
  feedItems, 
  niches, 
  userNicheWeights, 
  nicheFollows,
  likes,
  bookmarks 
} from "@/lib/db/schema";
import { eq, desc, sql, and, inArray, gte, ne } from "drizzle-orm";

/**
 * Recommendation Algorithm for Veritus Feed
 * 
 * Uses a hybrid approach combining:
 * 1. Content-Based Filtering - Based on user's followed niches
 * 2. Engagement-Based Ranking - Real-time engagement signals
 * 3. Quality Scoring - Citation count, impact factor, etc.
 * 4. Temporal Decay - Recent papers weighted higher
 * 5. Personalization - User's interaction history
 */

interface RecommendationOptions {
  userId?: string;
  limit?: number;
  offset?: number;
  excludeIds?: string[];
}

interface ScoredFeedItem {
  id: string;
  score: number;
  nicheWeight: number;
  qualityScore: number;
  engagementScore: number;
  recencyScore: number;
}

// Weight constants for the algorithm
const WEIGHTS = {
  NICHE_AFFINITY: 0.35,    // User's preference for the niche
  PAPER_QUALITY: 0.25,     // Citation count, journal ranking
  ENGAGEMENT: 0.20,        // Likes, comments, shares
  RECENCY: 0.20,           // How recent the paper is
};

// Quality score weights
const QUALITY_WEIGHTS = {
  CITATION: 0.35,
  INFLUENTIAL_CITATION: 0.25,
  QUARTILE: 0.20,
  OPEN_ACCESS: 0.10,
  JOURNAL: 0.10,
};

/**
 * Calculate paper quality score (0-100)
 */
function calculateQualityScore(paper: {
  citationCount: number;
  influentialCitationCount: number;
  quartileRanking: string | null;
  isOpenAccess: boolean;
  journalName: string | null;
}): number {
  // Citation score (logarithmic scale, max at ~1000 citations)
  const citationScore = Math.min(
    Math.log10(paper.citationCount + 1) / 3 * 100,
    100
  );

  // Influential citation score
  const influentialScore = Math.min(
    Math.log10(paper.influentialCitationCount + 1) / 2 * 100,
    100
  );

  // Quartile score
  let quartileScore = 50; // Default for unknown
  if (paper.quartileRanking) {
    const quartile = paper.quartileRanking.toUpperCase();
    if (quartile === "Q1") quartileScore = 100;
    else if (quartile === "Q2") quartileScore = 75;
    else if (quartile === "Q3") quartileScore = 50;
    else if (quartile === "Q4") quartileScore = 25;
  }

  // Open access bonus
  const openAccessScore = paper.isOpenAccess ? 100 : 0;

  // Journal presence bonus
  const journalScore = paper.journalName ? 100 : 0;

  return (
    QUALITY_WEIGHTS.CITATION * citationScore +
    QUALITY_WEIGHTS.INFLUENTIAL_CITATION * influentialScore +
    QUALITY_WEIGHTS.QUARTILE * quartileScore +
    QUALITY_WEIGHTS.OPEN_ACCESS * openAccessScore +
    QUALITY_WEIGHTS.JOURNAL * journalScore
  );
}

/**
 * Calculate engagement velocity score (0-100)
 * Higher for papers with recent engagement
 */
function calculateEngagementScore(paper: {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  bookmarksCount: number;
  viewsCount: number;
  createdAt: Date;
}): number {
  const hoursOld = (Date.now() - paper.createdAt.getTime()) / (1000 * 60 * 60);
  
  // Engagement weighted sum
  const rawEngagement = 
    paper.likesCount * 1 +
    paper.commentsCount * 3 +
    paper.sharesCount * 5 +
    paper.bookmarksCount * 2 +
    paper.viewsCount * 0.1;

  // Velocity (engagement per hour, normalized)
  const velocity = rawEngagement / Math.sqrt(hoursOld + 2);
  
  // Normalize to 0-100 (assuming max velocity of ~50)
  return Math.min(velocity * 2, 100);
}

/**
 * Calculate temporal decay score (0-100)
 * More recent papers score higher
 */
function calculateRecencyScore(createdAt: Date): number {
  const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  
  // Decay function: 100 for brand new, ~50 at 24h, ~25 at 1 week
  return 100 / (1 + Math.log10(hoursOld + 1));
}

/**
 * Get user's niche weights
 */
async function getUserNicheWeights(userId: string): Promise<Map<string, number>> {
  const weights = await db
    .select({
      nicheId: userNicheWeights.nicheId,
      weight: userNicheWeights.combinedWeight,
      totalLikes: userNicheWeights.totalLikes,
      totalComments: userNicheWeights.totalComments,
      totalBookmarks: userNicheWeights.totalBookmarks,
      totalViews: userNicheWeights.totalViews,
      totalTimeSpent: userNicheWeights.totalTimeSpent,
    })
    .from(userNicheWeights)
    .where(eq(userNicheWeights.userId, userId));

  const weightMap = new Map<string, number>();
  
  for (const w of weights) {
    // Calculate engagement-based weight if combinedWeight is 0
    let calculatedWeight = w.weight;
    
    if (calculatedWeight === 0) {
      // Simple calculation based on interactions
      calculatedWeight = Math.min(
        (w.totalLikes * 10 +
         w.totalComments * 20 +
         w.totalBookmarks * 15 +
         w.totalViews * 1 +
         w.totalTimeSpent * 0.1),
        100
      );
    }
    
    weightMap.set(w.nicheId, calculatedWeight);
  }

  return weightMap;
}

/**
 * Get user's followed niches
 */
async function getUserFollowedNiches(userId: string): Promise<string[]> {
  const follows = await db
    .select({ nicheId: nicheFollows.nicheId })
    .from(nicheFollows)
    .where(eq(nicheFollows.userId, userId));

  return follows.map(f => f.nicheId);
}

/**
 * Main recommendation function
 */
export async function getRecommendedFeed(options: RecommendationOptions) {
  const { 
    userId, 
    limit = 20, 
    offset = 0, 
    excludeIds = [] 
  } = options;

  // Get candidate papers (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let candidates = await db
    .select({
      id: feedItems.id,
      nicheId: feedItems.nicheId,
      citationCount: feedItems.citationCount,
      influentialCitationCount: feedItems.influentialCitationCount,
      quartileRanking: feedItems.quartileRanking,
      isOpenAccess: feedItems.isOpenAccess,
      journalName: feedItems.journalName,
      likesCount: feedItems.likesCount,
      commentsCount: feedItems.commentsCount,
      sharesCount: feedItems.sharesCount,
      bookmarksCount: feedItems.bookmarksCount,
      viewsCount: feedItems.viewsCount,
      createdAt: feedItems.createdAt,
      qualityScore: feedItems.qualityScore,
      trendingScore: feedItems.trendingScore,
    })
    .from(feedItems)
    .where(
      and(
        eq(feedItems.isActive, true),
        gte(feedItems.createdAt, thirtyDaysAgo),
        excludeIds.length > 0 ? ne(feedItems.id, excludeIds[0]) : undefined
      )
    )
    .orderBy(desc(feedItems.createdAt))
    .limit(500); // Get top 500 candidates

  // Filter out excluded IDs
  if (excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds);
    candidates = candidates.filter(c => !excludeSet.has(c.id));
  }

  // Get user preferences if logged in
  let nicheWeights = new Map<string, number>();
  let followedNiches: string[] = [];

  if (userId) {
    [nicheWeights, followedNiches] = await Promise.all([
      getUserNicheWeights(userId),
      getUserFollowedNiches(userId),
    ]);
  }

  // Score each candidate
  const scoredCandidates: ScoredFeedItem[] = candidates.map(paper => {
    // Niche affinity score
    let nicheWeight = 50; // Default for non-personalized
    if (userId) {
      if (nicheWeights.has(paper.nicheId)) {
        nicheWeight = nicheWeights.get(paper.nicheId)!;
      } else if (followedNiches.includes(paper.nicheId)) {
        nicheWeight = 60; // Followed but no interaction yet
      } else {
        nicheWeight = 30; // Not followed - discovery penalty
      }
    }

    // Quality score
    const qualityScore = calculateQualityScore({
      citationCount: paper.citationCount,
      influentialCitationCount: paper.influentialCitationCount,
      quartileRanking: paper.quartileRanking,
      isOpenAccess: paper.isOpenAccess,
      journalName: paper.journalName,
    });

    // Engagement score
    const engagementScore = calculateEngagementScore({
      likesCount: paper.likesCount,
      commentsCount: paper.commentsCount,
      sharesCount: paper.sharesCount,
      bookmarksCount: paper.bookmarksCount,
      viewsCount: paper.viewsCount,
      createdAt: paper.createdAt,
    });

    // Recency score
    const recencyScore = calculateRecencyScore(paper.createdAt);

    // Combined score
    const score = 
      WEIGHTS.NICHE_AFFINITY * nicheWeight +
      WEIGHTS.PAPER_QUALITY * qualityScore +
      WEIGHTS.ENGAGEMENT * engagementScore +
      WEIGHTS.RECENCY * recencyScore;

    return {
      id: paper.id,
      score,
      nicheWeight,
      qualityScore,
      engagementScore,
      recencyScore,
    };
  });

  // Sort by score and apply pagination
  scoredCandidates.sort((a, b) => b.score - a.score);
  const paginatedIds = scoredCandidates
    .slice(offset, offset + limit)
    .map(c => c.id);

  // Fetch full paper data for selected IDs
  if (paginatedIds.length === 0) {
    return { items: [], hasMore: false };
  }

  const items = await db
    .select({
      id: feedItems.id,
      paperId: feedItems.paperId,
      title: feedItems.title,
      abstract: feedItems.abstract,
      authors: feedItems.authors,
      doi: feedItems.doi,
      journalName: feedItems.journalName,
      year: feedItems.year,
      citationCount: feedItems.citationCount,
      influentialCitationCount: feedItems.influentialCitationCount,
      isOpenAccess: feedItems.isOpenAccess,
      pdfLink: feedItems.pdfLink,
      link: feedItems.link,
      tldr: feedItems.tldr,
      fieldsOfStudy: feedItems.fieldsOfStudy,
      quartileRanking: feedItems.quartileRanking,
      publicationType: feedItems.publicationType,
      thumbnailUrl: feedItems.thumbnailUrl,
      createdAt: feedItems.createdAt,
      likesCount: feedItems.likesCount,
      commentsCount: feedItems.commentsCount,
      bookmarksCount: feedItems.bookmarksCount,
      niche: {
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        displayName: niches.displayName,
        avatarInitials: niches.avatarInitials,
        avatarColor: niches.avatarColor,
      },
    })
    .from(feedItems)
    .innerJoin(niches, eq(feedItems.nicheId, niches.id))
    .where(inArray(feedItems.id, paginatedIds));

  // Sort items to match the scored order
  const idToIndex = new Map(paginatedIds.map((id, i) => [id, i]));
  items.sort((a, b) => (idToIndex.get(a.id) || 0) - (idToIndex.get(b.id) || 0));

  // Add user's like/bookmark status if logged in
  let userLikes: Set<string> = new Set();
  let userBookmarks: Set<string> = new Set();

  if (userId && items.length > 0) {
    const itemIds = items.map(item => item.id);

    const [likedItems, bookmarkedItems] = await Promise.all([
      db
        .select({ feedItemId: likes.feedItemId })
        .from(likes)
        .where(and(
          eq(likes.userId, userId),
          inArray(likes.feedItemId, itemIds)
        )),
      db
        .select({ feedItemId: bookmarks.feedItemId })
        .from(bookmarks)
        .where(and(
          eq(bookmarks.userId, userId),
          inArray(bookmarks.feedItemId, itemIds)
        )),
    ]);

    userLikes = new Set(likedItems.map(l => l.feedItemId));
    userBookmarks = new Set(bookmarkedItems.map(b => b.feedItemId));
  }

  const itemsWithUserState = items.map(item => ({
    ...item,
    isLiked: userLikes.has(item.id),
    isBookmarked: userBookmarks.has(item.id),
  }));

  return {
    items: itemsWithUserState,
    hasMore: offset + limit < scoredCandidates.length,
    totalCandidates: scoredCandidates.length,
  };
}

/**
 * Update user's combined weight for a niche
 * Called periodically (e.g., by a cron job)
 */
export async function updateUserNicheCombinedWeights(userId: string) {
  const weights = await db
    .select()
    .from(userNicheWeights)
    .where(eq(userNicheWeights.userId, userId));

  for (const weight of weights) {
    // Calculate engagement score (normalized 0-100)
    const engagementScore = Math.min(
      (weight.totalLikes * 10 +
       weight.totalComments * 30 +
       weight.totalShares * 50 +
       weight.totalBookmarks * 20),
      100
    );

    // Calculate view time score (normalized 0-100)
    // Assume average session is 300 seconds, max at 1800 seconds
    const viewTimeScore = Math.min(
      (weight.totalTimeSpent / 1800) * 100,
      100
    );

    // Calculate interaction frequency score
    const totalInteractions = 
      weight.totalViews + 
      weight.totalLikes + 
      weight.totalComments + 
      weight.totalBookmarks + 
      weight.totalShares;
    const interactionScore = Math.min(totalInteractions * 5, 100);

    // Calculate recency score
    let recencyScore = 0;
    if (weight.lastInteractionAt) {
      const daysSinceInteraction = 
        (Date.now() - weight.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
      recencyScore = Math.max(100 - daysSinceInteraction * 5, 0);
    }

    // Combined weight
    const combinedWeight = Math.round(
      0.35 * engagementScore +
      0.25 * viewTimeScore +
      0.25 * interactionScore +
      0.15 * recencyScore
    );

    // Update the record
    await db
      .update(userNicheWeights)
      .set({
        engagementScore: Math.round(engagementScore),
        viewTimeScore: Math.round(viewTimeScore),
        interactionScore: Math.round(interactionScore),
        recencyScore: Math.round(recencyScore),
        combinedWeight,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userNicheWeights.userId, userId),
          eq(userNicheWeights.nicheId, weight.nicheId)
        )
      );
  }
}
