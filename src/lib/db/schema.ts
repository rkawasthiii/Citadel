import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

// ============================================================================
// CUSTOM TYPES
// ============================================================================

// pgvector custom type for 768-dimensional embeddings (text-embedding-004)
const vector = customType<{ data: number[]; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 768})`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      // Parse PostgreSQL vector format: [1,2,3] or (1,2,3)
      return JSON.parse(value.replace(/^\[|\]$/g, "[").replace(/^\(|\)$/g, "["));
    }
    return value as number[];
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
});

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Authentication & Profile
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
    avatar: text("avatar"),
    bio: text("bio"),
    institution: text("institution"),

    // User Type & Status
    profileType: text("profile_type").notNull().default("researcher"),
    isActive: boolean("is_active").notNull().default(true),

    // Onboarding
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    onboardingData: jsonb("onboarding_data").$type<{
      selectedNiches?: string[];
      interests?: string[];
      careerStage?: string;
      researchAreas?: string[];
      completedAt?: string;
    }>(),

    // Denormalized Counts
    followingCount: integer("following_count").notNull().default(0),
    followerCount: integer("follower_count").notNull().default(0),
    papersLikedCount: integer("papers_liked_count").notNull().default(0),
    papersBookmarkedCount: integer("papers_bookmarked_count")
      .notNull()
      .default(0),
    commentsCount: integer("comments_count").notNull().default(0),

    // Settings
    settings: jsonb("settings")
      .$type<{
        emailNotifications?: boolean;
        pushNotifications?: boolean;
        theme?: "light" | "dark" | "auto";
        language?: string;
        privacy?: {
          profileVisibility?: "public" | "private";
          activityVisible?: boolean;
        };
      }>()
      .default({
        emailNotifications: true,
        pushNotifications: true,
        theme: "auto",
        language: "en",
      }),

    // Timestamps
    lastActiveAt: timestamp("last_active_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    usernameIdx: index("users_username_idx").on(table.username),
    activeIdx: index("users_active_idx").on(table.isActive),
    lastActiveIdx: index("users_last_active_idx").on(table.lastActiveAt),
  })
);

// ============================================================================
// NICHES TABLE
// ============================================================================

export const niches = pgTable(
  "niches",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Identity
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),

    // Visual
    avatarColor: text("avatar_color").notNull().default("#6366F1"),
    avatarInitials: text("avatar_initials").notNull(),
    thumbnailUrl: text("thumbnail_url"),

    // Classification
    categoryType: text("category_type").notNull().default("field"),
    parentNicheId: uuid("parent_niche_id").references((): any => niches.id),

    // Metadata
    metadata: jsonb("metadata").$type<{
      fieldsOfStudy?: string[];
      keywords?: string[];
      relatedNiches?: string[];
      officialWebsite?: string;
      wikipediaUrl?: string;
      aliases?: string[];
    }>(),

    // Denormalized Stats
    stats: jsonb("stats")
      .$type<{
        totalPapers?: number;
        totalFollowers?: number;
        weeklyGrowth?: number;
        monthlyGrowth?: number;
        avgCitationCount?: number;
        topAuthors?: string[];
      }>()
      .default({
        totalPapers: 0,
        totalFollowers: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
      }),

    // Popularity Score
    popularityScore: integer("popularity_score").notNull().default(0),
    trendingScore: integer("trending_score").notNull().default(0),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),

    // AI Persona Configuration (optional override for default personas)
    aiPersona: jsonb("ai_persona").$type<{
      name: string;
      role: string;
      personality: string;
      expertise: string[];
      speakingStyle: string;
      greeting: string;
      systemPrompt?: string;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("niches_slug_idx").on(table.slug),
    categoryIdx: index("niches_category_idx").on(table.categoryType),
    popularityIdx: index("niches_popularity_idx").on(table.popularityScore),
    trendingIdx: index("niches_trending_idx").on(table.trendingScore),
    activeIdx: index("niches_active_idx").on(table.isActive),
    featuredIdx: index("niches_featured_idx").on(table.isFeatured),
    parentIdx: index("niches_parent_idx").on(table.parentNicheId),
  })
);

// ============================================================================
// FEED ITEMS TABLE
// ============================================================================

export const feedItems = pgTable(
  "feed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Niche Association
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "set null" })
      .notNull(),

    // External ID
    paperId: text("paper_id").notNull().unique(),

    // Paper Content
    title: text("title").notNull(),
    abstract: text("abstract"),
    tldr: text("tldr"),

    // Authors & Publication
    authors: text("authors").notNull(),
    authorsList: jsonb("authors_list").$type<
      Array<{
        name: string;
        id?: string;
        affiliations?: string[];
      }>
    >(),

    // Publication Details
    doi: text("doi"),
    journalName: text("journal_name"),
    year: integer("year"),
    publicationType: text("publication_type"),
    publishedAt: timestamp("published_at"),

    // Quality Indicators
    citationCount: integer("citation_count").notNull().default(0),
    influentialCitationCount: integer("influential_citation_count")
      .notNull()
      .default(0),
    quartileRanking: text("quartile_ranking"),
    impactFactor: integer("impact_factor"),

    // Access
    isOpenAccess: boolean("is_open_access").notNull().default(false),
    pdfLink: text("pdf_link"),
    link: text("link"),

    // Classification
    fieldsOfStudy: jsonb("fields_of_study").$type<string[]>().default([]),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Visual
    thumbnailUrl: text("thumbnail_url"),

    // Feed Metadata
    publishedToFeedAt: timestamp("published_to_feed_at").defaultNow().notNull(),

    // Computed Scores
    qualityScore: integer("quality_score").notNull().default(0),
    relevanceScore: integer("relevance_score").notNull().default(0),
    trendingScore: integer("trending_score").notNull().default(0),

    // Denormalized Engagement Counts
    likesCount: integer("likes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    bookmarksCount: integer("bookmarks_count").notNull().default(0),
    sharesCount: integer("shares_count").notNull().default(0),
    viewsCount: integer("views_count").notNull().default(0),

    // Status
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nicheIdx: index("feed_items_niche_idx").on(table.nicheId),
    paperIdIdx: index("feed_items_paper_id_idx").on(table.paperId),
    publishedIdx: index("feed_items_published_idx").on(table.publishedToFeedAt),
    qualityIdx: index("feed_items_quality_idx").on(table.qualityScore),
    trendingIdx: index("feed_items_trending_idx").on(table.trendingScore),
    activeIdx: index("feed_items_active_idx").on(table.isActive),
    yearIdx: index("feed_items_year_idx").on(table.year),
    nichePublishedIdx: index("feed_items_niche_published_idx").on(
      table.nicheId,
      table.publishedToFeedAt
    ),
    nicheTrendingIdx: index("feed_items_niche_trending_idx").on(
      table.nicheId,
      table.trendingScore
    ),
  })
);

// ============================================================================
// NICHE FOLLOWS TABLE
// ============================================================================

export const nicheFollows = pgTable(
  "niche_follows",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),

    // Follow Metadata
    followedAt: timestamp("followed_at").defaultNow().notNull(),
    notificationsEnabled: boolean("notifications_enabled")
      .notNull()
      .default(true),

    // Source
    source: text("source"),

    // Engagement
    interactionCount: integer("interaction_count").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.nicheId] }),
    userIdx: index("niche_follows_user_idx").on(table.userId),
    nicheIdx: index("niche_follows_niche_idx").on(table.nicheId),
    followedAtIdx: index("niche_follows_followed_at_idx").on(table.followedAt),
    userInteractionIdx: index("niche_follows_user_interaction_idx").on(
      table.userId,
      table.interactionCount
    ),
  })
);

// ============================================================================
// USER INTERACTIONS TABLE
// ============================================================================

export const userInteractions = pgTable(
  "user_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Who & What
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull(),
    nicheId: uuid("niche_id").references(() => niches.id, {
      onDelete: "set null",
    }),

    // Interaction Type
    interactionType: text("interaction_type").notNull(),

    // Engagement Metrics
    duration: integer("duration"),
    scrollDepth: integer("scroll_depth"),

    // Context
    context: jsonb("context").$type<{
      device?: string;
      platform?: string;
      referrer?: string;
      sessionId?: string;
      feedPosition?: number;
      sourceScreen?: string;
    }>(),

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, any>>(),

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_interactions_user_idx").on(table.userId),
    feedItemIdx: index("user_interactions_feed_item_idx").on(table.feedItemId),
    nicheIdx: index("user_interactions_niche_idx").on(table.nicheId),
    typeIdx: index("user_interactions_type_idx").on(table.interactionType),
    createdIdx: index("user_interactions_created_idx").on(table.createdAt),
    userCreatedIdx: index("user_interactions_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    nicheCreatedIdx: index("user_interactions_niche_created_idx").on(
      table.nicheId,
      table.createdAt
    ),
    userTypeIdx: index("user_interactions_user_type_idx").on(
      table.userId,
      table.interactionType
    ),
  })
);

// ============================================================================
// USER NICHE WEIGHTS TABLE
// ============================================================================

export const userNicheWeights = pgTable(
  "user_niche_weights",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),

    // Computed Scores (0-100)
    engagementScore: integer("engagement_score").notNull().default(0),
    viewTimeScore: integer("view_time_score").notNull().default(0),
    interactionScore: integer("interaction_score").notNull().default(0),
    recencyScore: integer("recency_score").notNull().default(0),

    // Combined Weight
    combinedWeight: integer("combined_weight").notNull().default(0),

    // Raw Metrics
    totalViews: integer("total_views").notNull().default(0),
    totalLikes: integer("total_likes").notNull().default(0),
    totalComments: integer("total_comments").notNull().default(0),
    totalShares: integer("total_shares").notNull().default(0),
    totalBookmarks: integer("total_bookmarks").notNull().default(0),
    totalTimeSpent: integer("total_time_spent").notNull().default(0),

    // Negative Signals
    totalHides: integer("total_hides").notNull().default(0),
    totalScrollPasts: integer("total_scroll_pasts").notNull().default(0),

    // Timestamps
    lastInteractionAt: timestamp("last_interaction_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.nicheId] }),
    userWeightIdx: index("user_niche_weights_user_weight_idx").on(
      table.userId,
      table.combinedWeight
    ),
    nicheWeightIdx: index("user_niche_weights_niche_weight_idx").on(
      table.nicheId,
      table.combinedWeight
    ),
    userUpdatedIdx: index("user_niche_weights_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
  })
);

// ============================================================================
// LIKES TABLE
// ============================================================================

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.feedItemId] }),
    userIdx: index("likes_user_idx").on(table.userId),
    feedItemIdx: index("likes_feed_item_idx").on(table.feedItemId),
    createdIdx: index("likes_created_idx").on(table.createdAt),
  })
);

// ============================================================================
// BOOKMARKS TABLE
// ============================================================================

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull(),

    // Collections (future feature)
    collectionId: uuid("collection_id"),

    // Notes (future feature)
    note: text("note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.feedItemId] }),
    userIdx: index("bookmarks_user_idx").on(table.userId),
    feedItemIdx: index("bookmarks_feed_item_idx").on(table.feedItemId),
    createdIdx: index("bookmarks_created_idx").on(table.createdAt),
    collectionIdx: index("bookmarks_collection_idx").on(table.collectionId),
  })
);

// ============================================================================
// COMMENTS TABLE
// ============================================================================

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull(),

    // Threading (future feature)
    parentCommentId: uuid("parent_comment_id").references((): any =>
      comments.id, { onDelete: "cascade" }
    ),

    content: text("content").notNull(),

    // Engagement
    likesCount: integer("likes_count").notNull().default(0),
    repliesCount: integer("replies_count").notNull().default(0),

    // Moderation
    isEdited: boolean("is_edited").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("comments_user_idx").on(table.userId),
    feedItemIdx: index("comments_feed_item_idx").on(table.feedItemId),
    parentIdx: index("comments_parent_idx").on(table.parentCommentId),
    createdIdx: index("comments_created_idx").on(table.createdAt),
    feedItemParentIdx: index("comments_feed_item_parent_idx").on(
      table.feedItemId,
      table.parentCommentId
    ),
  })
);

// ============================================================================
// STORIES TABLE
// ============================================================================

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull(),

    // Story Type
    storyType: text("story_type").notNull().default("trending"),

    // Display
    priority: integer("priority").notNull().default(0),
    customThumbnail: text("custom_thumbnail"),
    customTitle: text("custom_title"),

    // Stats
    stats: jsonb("stats")
      .$type<{
        views?: number;
        clicks?: number;
        swipes?: number;
        avgViewDuration?: number;
      }>()
      .default({
        views: 0,
        clicks: 0,
        swipes: 0,
      }),

    // Lifecycle
    expiresAt: timestamp("expires_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nicheIdx: index("stories_niche_idx").on(table.nicheId),
    feedItemIdx: index("stories_feed_item_idx").on(table.feedItemId),
    activeIdx: index("stories_active_idx").on(table.isActive),
    expiresIdx: index("stories_expires_idx").on(table.expiresAt),
    nicheActiveExpiresIdx: index("stories_niche_active_expires_idx").on(
      table.nicheId,
      table.isActive,
      table.expiresAt
    ),
  })
);

// ============================================================================
// USER STORY VIEWS TABLE
// ============================================================================

export const userStoryViews = pgTable(
  "user_story_views",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),

    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
    viewDuration: integer("view_duration"),

    clickedThrough: boolean("clicked_through").notNull().default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.storyId] }),
    userIdx: index("user_story_views_user_idx").on(table.userId),
    storyIdx: index("user_story_views_story_idx").on(table.storyId),
    viewedIdx: index("user_story_views_viewed_idx").on(table.viewedAt),
  })
);

// ============================================================================
// FEED JOBS TABLE
// ============================================================================

export const feedJobs = pgTable(
  "feed_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Optional userId - null for system-generated jobs
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" }),

    // Job Details
    veritusJobId: text("veritus_job_id"),
    status: text("status").notNull().default("pending"),

    jobType: text("job_type").notNull(),

    // Search Parameters
    params: jsonb("params").$type<{
      phrases?: string[];
      query?: string;
      nicheId?: string;
      filters?: Record<string, unknown>;
    }>(),

    // Results
    resultsCount: integer("results_count"),
    newPapersCount: integer("new_papers_count"),

    // Error Handling
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userIdx: index("feed_jobs_user_idx").on(table.userId),
    statusIdx: index("feed_jobs_status_idx").on(table.status),
    createdIdx: index("feed_jobs_created_idx").on(table.createdAt),
    userStatusIdx: index("feed_jobs_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

// ============================================================================
// PAPER EMBEDDINGS TABLE (pgvector)
// ============================================================================

export const paperEmbeddings = pgTable(
  "paper_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedItemId: uuid("feed_item_id")
      .references(() => feedItems.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),

    // Combined text for embedding (title + abstract + tldr)
    content: text("content").notNull(),

    // Vector embedding (768 dimensions for text-embedding-004)
    embedding: vector("embedding", { dimensions: 768 }).notNull(),

    // Metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    feedItemIdx: index("paper_embeddings_feed_item_idx").on(table.feedItemId),
    nicheIdx: index("paper_embeddings_niche_idx").on(table.nicheId),
    // Note: HNSW index should be created manually in SQL migration:
    // CREATE INDEX paper_embeddings_embedding_idx ON paper_embeddings
    //   USING hnsw (embedding vector_cosine_ops);
  })
);

// ============================================================================
// CONVERSATIONS TABLE
// ============================================================================

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nicheId: uuid("niche_id")
      .references(() => niches.id, { onDelete: "cascade" })
      .notNull(),

    // Conversation metadata
    title: text("title"), // Auto-generated from first message

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("conversations_user_idx").on(table.userId),
    nicheIdx: index("conversations_niche_idx").on(table.nicheId),
    userNicheIdx: index("conversations_user_niche_idx").on(
      table.userId,
      table.nicheId
    ),
    lastMessageIdx: index("conversations_last_message_idx").on(
      table.lastMessageAt
    ),
  })
);

// ============================================================================
// MESSAGES TABLE
// ============================================================================

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),

    // Message content
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),

    // Tool calls and results (for AI responses)
    toolCalls: jsonb("tool_calls").$type<
      Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }>
    >(),
    toolResults: jsonb("tool_results").$type<
      Array<{
        toolCallId: string;
        result: unknown;
      }>
    >(),

    // Referenced papers (papers cited in this message)
    referencedPaperIds: jsonb("referenced_paper_ids")
      .$type<string[]>()
      .default([]),

    // Metadata
    metadata: jsonb("metadata").$type<{
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      finishReason?: string;
      searchResults?: {
        query: string;
        resultsCount: number;
      };
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
    roleIdx: index("messages_role_idx").on(table.role),
    createdIdx: index("messages_created_idx").on(table.createdAt),
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  })
);

// ============================================================================
// LEGACY TABLES (TO BE DEPRECATED)
// ============================================================================

// Keep userPreferences for backward compatibility during migration
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  phrases: jsonb("phrases").$type<string[]>().default([]),
  fieldsOfStudy: jsonb("fields_of_study").$type<string[]>().default([]),
  minCitationCount: integer("min_citation_count").default(0),
  openAccessOnly: boolean("open_access_only").default(false),
  quartileRankings: jsonb("quartile_rankings").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Niche = typeof niches.$inferSelect;
export type NewNiche = typeof niches.$inferInsert;
export type FeedItem = typeof feedItems.$inferSelect;
export type NewFeedItem = typeof feedItems.$inferInsert;
export type NicheFollow = typeof nicheFollows.$inferSelect;
export type NewNicheFollow = typeof nicheFollows.$inferInsert;
export type UserInteraction = typeof userInteractions.$inferSelect;
export type NewUserInteraction = typeof userInteractions.$inferInsert;
export type UserNicheWeight = typeof userNicheWeights.$inferSelect;
export type NewUserNicheWeight = typeof userNicheWeights.$inferInsert;
export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type UserStoryView = typeof userStoryViews.$inferSelect;
export type NewUserStoryView = typeof userStoryViews.$inferInsert;
export type FeedJob = typeof feedJobs.$inferSelect;
export type NewFeedJob = typeof feedJobs.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;

// Chat & Embeddings Types
export type PaperEmbedding = typeof paperEmbeddings.$inferSelect;
export type NewPaperEmbedding = typeof paperEmbeddings.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
