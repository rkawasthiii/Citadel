# Veritus Database Schema Design - Final Version

## Research Summary

Based on comprehensive research of social media platforms, recommendation systems, and PostgreSQL best practices, here are the key findings that inform our schema design:

### Key Insights from Research:

1. **Social Media Feed Systems** (GeeksforGeeks, Medium):
   - Denormalization is crucial for feed performance
   - Counter caching prevents expensive COUNT queries
   - Separate tables for interactions improve query speed
   - Use composite indexes on foreign key relationships

2. **Follow System Design**:
   - Many-to-many relationship between users and followed entities
   - Need bidirectional queries (followers and following)
   - Composite primary keys on junction tables
   - Separate follower/following counts as denormalized fields

3. **Time-Series Analytics** (Timescale, DataCamp):
   - User interactions are time-series data
   - Partition by time for better query performance
   - Keep raw interaction data for analytics
   - Aggregate metrics periodically via background jobs

4. **PostgreSQL Optimization**:
   - Use JSONB for flexible metadata
   - Create partial indexes for active records
   - Use materialized views for expensive aggregations
   - Implement proper cascade delete strategies

5. **Recommendation Systems**:
   - Store precomputed scores for fast retrieval
   - Separate hot data (recent) from cold data (historical)
   - Use Redis/cache for frequently accessed recommendations
   - Background jobs update recommendation scores

---

## Final Schema Design

### Design Principles:

1. **Performance First**: Denormalize counts, cache computed values
2. **Scalability**: Partition large tables, use proper indexing
3. **Flexibility**: JSONB for extensible metadata
4. **Analytics Ready**: Store raw interaction data for analysis
5. **Gorse Integration**: Schema designed to feed Gorse recommendation engine

---

## Core Tables

### 1. Users (Researchers)

```typescript
export const users = pgTable("users", {
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
  // researcher, student, professional, institution
  isActive: boolean("is_active").notNull().default(true),
  
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  onboardingData: jsonb("onboarding_data").$type<{
    selectedNiches?: string[];
    interests?: string[];
    careerStage?: string;
    researchAreas?: string[];
    completedAt?: string;
  }>(),
  
  // Denormalized Counts (updated via triggers/jobs)
  followingCount: integer("following_count").notNull().default(0),
  followerCount: integer("follower_count").notNull().default(0), // For future user-to-user follows
  papersLikedCount: integer("papers_liked_count").notNull().default(0),
  papersBookmarkedCount: integer("papers_bookmarked_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  
  // Settings
  settings: jsonb("settings").$type<{
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    privacy?: {
      profileVisibility?: 'public' | 'private';
      activityVisible?: boolean;
    };
  }>().default({
    emailNotifications: true,
    pushNotifications: true,
    theme: 'auto',
    language: 'en',
  }),
  
  // Timestamps
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes
  emailIdx: index("users_email_idx").on(table.email),
  usernameIdx: index("users_username_idx").on(table.username),
  activeIdx: index("users_active_idx").on(table.isActive),
  lastActiveIdx: index("users_last_active_idx").on(table.lastActiveAt),
}));
```

---

### 2. Niches (Research Topics/Fields)

```typescript
export const niches = pgTable("niches", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Identity
  slug: text("slug").notNull().unique(), // "machine-learning", "quantum-physics"
  name: text("name").notNull(), // "Machine Learning"
  displayName: text("display_name").notNull(), // "ML"
  description: text("description"),
  
  // Visual
  avatarColor: text("avatar_color").notNull().default("#6366F1"), // Hex color
  avatarInitials: text("avatar_initials").notNull(), // "ML", "QP"
  thumbnailUrl: text("thumbnail_url"), // Optional custom image
  
  // Classification
  categoryType: text("category_type").notNull().default("field"),
  // field, topic, journal, institution, conference
  parentNicheId: uuid("parent_niche_id").references(() => niches.id), // For sub-niches
  
  // Metadata
  metadata: jsonb("metadata").$type<{
    fieldsOfStudy?: string[];
    keywords?: string[];
    relatedNiches?: string[];
    officialWebsite?: string;
    wikipediaUrl?: string;
    aliases?: string[]; // Alternative names
  }>(),
  
  // Denormalized Stats (updated periodically)
  stats: jsonb("stats").$type<{
    totalPapers?: number;
    totalFollowers?: number;
    weeklyGrowth?: number;
    monthlyGrowth?: number;
    avgCitationCount?: number;
    topAuthors?: string[];
  }>().default({
    totalPapers: 0,
    totalFollowers: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
  }),
  
  // Popularity Score (for ranking/discovery)
  popularityScore: integer("popularity_score").notNull().default(0),
  trendingScore: integer("trending_score").notNull().default(0),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes
  slugIdx: index("niches_slug_idx").on(table.slug),
  categoryIdx: index("niches_category_idx").on(table.categoryType),
  popularityIdx: index("niches_popularity_idx").on(table.popularityScore),
  trendingIdx: index("niches_trending_idx").on(table.trendingScore),
  activeIdx: index("niches_active_idx").on(table.isActive),
  featuredIdx: index("niches_featured_idx").on(table.isFeatured),
  parentIdx: index("niches_parent_idx").on(table.parentNicheId),
}));
```

---

### 3. Feed Items (Papers)

```typescript
export const feedItems = pgTable("feed_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Niche Association (PRIMARY RELATIONSHIP)
  nicheId: uuid("niche_id")
    .references(() => niches.id, { onDelete: "set null" })
    .notNull(),
  
  // External ID
  paperId: text("paper_id").notNull().unique(), // Veritus API ID
  
  // Paper Content
  title: text("title").notNull(),
  abstract: text("abstract"),
  tldr: text("tldr"), // AI-generated summary
  
  // Authors & Publication
  authors: text("authors").notNull(), // Comma-separated or JSON
  authorsList: jsonb("authors_list").$type<Array<{
    name: string;
    id?: string;
    affiliations?: string[];
  }>>(),
  
  // Publication Details
  doi: text("doi"),
  journalName: text("journal_name"),
  year: integer("year"),
  publicationType: text("publication_type"), // journal, conference, preprint
  publishedAt: timestamp("published_at"),
  
  // Quality Indicators
  citationCount: integer("citation_count").notNull().default(0),
  influentialCitationCount: integer("influential_citation_count").notNull().default(0),
  quartileRanking: text("quartile_ranking"), // Q1, Q2, Q3, Q4
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
  
  // Computed Scores (updated periodically)
  qualityScore: integer("quality_score").notNull().default(0), // 0-100
  relevanceScore: integer("relevance_score").notNull().default(0), // 0-100
  trendingScore: integer("trending_score").notNull().default(0), // 0-100
  
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
}, (table) => ({
  // Indexes
  nicheIdx: index("feed_items_niche_idx").on(table.nicheId),
  paperIdIdx: index("feed_items_paper_id_idx").on(table.paperId),
  publishedIdx: index("feed_items_published_idx").on(table.publishedToFeedAt),
  qualityIdx: index("feed_items_quality_idx").on(table.qualityScore),
  trendingIdx: index("feed_items_trending_idx").on(table.trendingScore),
  activeIdx: index("feed_items_active_idx").on(table.isActive),
  yearIdx: index("feed_items_year_idx").on(table.year),
  // Composite indexes for common queries
  nichePublishedIdx: index("feed_items_niche_published_idx")
    .on(table.nicheId, table.publishedToFeedAt),
  nicheTrendingIdx: index("feed_items_niche_trending_idx")
    .on(table.nicheId, table.trendingScore),
}));
```

---

### 4. Niche Follows (User → Niche Relationship)

```typescript
export const nicheFollows = pgTable("niche_follows", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  nicheId: uuid("niche_id")
    .references(() => niches.id, { onDelete: "cascade" })
    .notNull(),
  
  // Follow Metadata
  followedAt: timestamp("followed_at").defaultNow().notNull(),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  
  // Source (how they found this niche)
  source: text("source"), // onboarding, search, suggestion, explore
  
  // Engagement with this niche (denormalized for quick access)
  interactionCount: integer("interaction_count").notNull().default(0),
  lastInteractionAt: timestamp("last_interaction_at"),
}, (table) => ({
  // Composite primary key
  pk: primaryKey({ columns: [table.userId, table.nicheId] }),
  
  // Indexes for bidirectional queries
  userIdx: index("niche_follows_user_idx").on(table.userId),
  nicheIdx: index("niche_follows_niche_idx").on(table.nicheId),
  followedAtIdx: index("niche_follows_followed_at_idx").on(table.followedAt),
  
  // For finding most engaged niches per user
  userInteractionIdx: index("niche_follows_user_interaction_idx")
    .on(table.userId, table.interactionCount),
}));
```

---

### 5. User Interactions (Event Stream)

This is the core analytics table that feeds into Gorse and generates user-niche weights.

```typescript
export const userInteractions = pgTable("user_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Who & What
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  feedItemId: uuid("feed_item_id")
    .references(() => feedItems.id, { onDelete: "cascade" })
    .notNull(),
  nicheId: uuid("niche_id")
    .references(() => niches.id, { onDelete: "set null" }),
  
  // Interaction Type
  interactionType: text("interaction_type").notNull(),
  // like, unlike, bookmark, unbookmark, comment, delete_comment
  // share, click, view, read_abstract, read_full, download_pdf
  // scroll_past, hide, report
  
  // Engagement Metrics
  duration: integer("duration"), // Time spent in seconds
  scrollDepth: integer("scroll_depth"), // 0-100 percentage
  
  // Context
  context: jsonb("context").$type<{
    device?: string;
    platform?: string;
    referrer?: string;
    sessionId?: string;
    feedPosition?: number; // Position in feed when interacted
    sourceScreen?: string; // feed, search, explore, niche_profile
  }>(),
  
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  // Timestamp (CRITICAL for time-series)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for common query patterns
  userIdx: index("user_interactions_user_idx").on(table.userId),
  feedItemIdx: index("user_interactions_feed_item_idx").on(table.feedItemId),
  nicheIdx: index("user_interactions_niche_idx").on(table.nicheId),
  typeIdx: index("user_interactions_type_idx").on(table.interactionType),
  createdIdx: index("user_interactions_created_idx").on(table.createdAt),
  
  // Composite indexes for analytics
  userCreatedIdx: index("user_interactions_user_created_idx")
    .on(table.userId, table.createdAt),
  nicheCreatedIdx: index("user_interactions_niche_created_idx")
    .on(table.nicheId, table.createdAt),
  userTypeIdx: index("user_interactions_user_type_idx")
    .on(table.userId, table.interactionType),
}));
```

---

### 6. User Niche Weights (Precomputed Affinity Scores)

This table stores aggregated metrics for each user-niche pair, updated periodically by background jobs.

```typescript
export const userNicheWeights = pgTable("user_niche_weights", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  nicheId: uuid("niche_id")
    .references(() => niches.id, { onDelete: "cascade" })
    .notNull(),
  
  // Computed Scores (0-1 normalized)
  engagementScore: integer("engagement_score").notNull().default(0), // 0-100
  viewTimeScore: integer("view_time_score").notNull().default(0), // 0-100
  interactionScore: integer("interaction_score").notNull().default(0), // 0-100
  recencyScore: integer("recency_score").notNull().default(0), // 0-100
  
  // Combined Weight (weighted average)
  combinedWeight: integer("combined_weight").notNull().default(0), // 0-100
  
  // Raw Metrics (for score calculation)
  totalViews: integer("total_views").notNull().default(0),
  totalLikes: integer("total_likes").notNull().default(0),
  totalComments: integer("total_comments").notNull().default(0),
  totalShares: integer("total_shares").notNull().default(0),
  totalBookmarks: integer("total_bookmarks").notNull().default(0),
  totalTimeSpent: integer("total_time_spent").notNull().default(0), // seconds
  
  // Negative Signals
  totalHides: integer("total_hides").notNull().default(0),
  totalScrollPasts: integer("total_scroll_pasts").notNull().default(0),
  
  // Timestamps
  lastInteractionAt: timestamp("last_interaction_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Composite primary key
  pk: primaryKey({ columns: [table.userId, table.nicheId] }),
  
  // Indexes for ranking queries
  userWeightIdx: index("user_niche_weights_user_weight_idx")
    .on(table.userId, table.combinedWeight),
  nicheWeightIdx: index("user_niche_weights_niche_weight_idx")
    .on(table.nicheId, table.combinedWeight),
  userUpdatedIdx: index("user_niche_weights_user_updated_idx")
    .on(table.userId, table.updatedAt),
}));
```

---

### 7. Likes (Denormalized for Performance)

```typescript
export const likes = pgTable("likes", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  feedItemId: uuid("feed_item_id")
    .references(() => feedItems.id, { onDelete: "cascade" })
    .notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.feedItemId] }),
  
  // Indexes
  userIdx: index("likes_user_idx").on(table.userId),
  feedItemIdx: index("likes_feed_item_idx").on(table.feedItemId),
  createdIdx: index("likes_created_idx").on(table.createdAt),
}));
```

---

### 8. Bookmarks

```typescript
export const bookmarks = pgTable("bookmarks", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  feedItemId: uuid("feed_item_id")
    .references(() => feedItems.id, { onDelete: "cascade" })
    .notNull(),
  
  // Collections (future feature)
  collectionId: uuid("collection_id"), // Reference to bookmark collections
  
  // Notes (future feature)
  note: text("note"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.feedItemId] }),
  
  userIdx: index("bookmarks_user_idx").on(table.userId),
  feedItemIdx: index("bookmarks_feed_item_idx").on(table.feedItemId),
  createdIdx: index("bookmarks_created_idx").on(table.createdAt),
  collectionIdx: index("bookmarks_collection_idx").on(table.collectionId),
}));
```

---

### 9. Comments

```typescript
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  feedItemId: uuid("feed_item_id")
    .references(() => feedItems.id, { onDelete: "cascade" })
    .notNull(),
  
  // Threading (future feature)
  parentCommentId: uuid("parent_comment_id")
    .references(() => comments.id, { onDelete: "cascade" }),
  
  content: text("content").notNull(),
  
  // Engagement
  likesCount: integer("likes_count").notNull().default(0),
  repliesCount: integer("replies_count").notNull().default(0),
  
  // Moderation
  isEdited: boolean("is_edited").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("comments_user_idx").on(table.userId),
  feedItemIdx: index("comments_feed_item_idx").on(table.feedItemId),
  parentIdx: index("comments_parent_idx").on(table.parentCommentId),
  createdIdx: index("comments_created_idx").on(table.createdAt),
  
  // For nested comments
  feedItemParentIdx: index("comments_feed_item_parent_idx")
    .on(table.feedItemId, table.parentCommentId),
}));
```

---

### 10. Stories

```typescript
export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  nicheId: uuid("niche_id")
    .references(() => niches.id, { onDelete: "cascade" })
    .notNull(),
  feedItemId: uuid("feed_item_id")
    .references(() => feedItems.id, { onDelete: "cascade" })
    .notNull(),
  
  // Story Type
  storyType: text("story_type").notNull().default("trending"),
  // trending, breaking, featured, sponsored
  
  // Display
  priority: integer("priority").notNull().default(0), // Higher = shown first
  customThumbnail: text("custom_thumbnail"),
  customTitle: text("custom_title"),
  
  // Stats
  stats: jsonb("stats").$type<{
    views?: number;
    clicks?: number;
    swipes?: number;
    avgViewDuration?: number;
  }>().default({
    views: 0,
    clicks: 0,
    swipes: 0,
  }),
  
  // Lifecycle
  expiresAt: timestamp("expires_at").notNull(), // 24h from creation
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nicheIdx: index("stories_niche_idx").on(table.nicheId),
  feedItemIdx: index("stories_feed_item_idx").on(table.feedItemId),
  activeIdx: index("stories_active_idx").on(table.isActive),
  expiresIdx: index("stories_expires_idx").on(table.expiresAt),
  
  // For fetching active stories for a niche
  nicheActiveExpiresIdx: index("stories_niche_active_expires_idx")
    .on(table.nicheId, table.isActive, table.expiresAt),
}));
```

---

### 11. User Story Views

```typescript
export const userStoryViews = pgTable("user_story_views", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  viewDuration: integer("view_duration"), // seconds
  
  // Did they click through to read the paper?
  clickedThrough: boolean("clicked_through").notNull().default(false),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.storyId] }),
  
  userIdx: index("user_story_views_user_idx").on(table.userId),
  storyIdx: index("user_story_views_story_idx").on(table.storyId),
  viewedIdx: index("user_story_views_viewed_idx").on(table.viewedAt),
}));
```

---

### 12. Feed Jobs (Veritus API Integration)

```typescript
export const feedJobs = pgTable("feed_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  
  // Job Details
  veritusJobId: text("veritus_job_id"),
  status: text("status").notNull().default("pending"),
  // pending, queued, processing, completed, failed
  
  jobType: text("job_type").notNull(),
  // keywordSearch, querySearch, combinedSearch, nicheRefresh
  
  // Search Parameters
  params: jsonb("params").$type<{
    phrases?: string[];
    query?: string;
    nicheId?: string;
    filters?: Record<string, any>;
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
}, (table) => ({
  userIdx: index("feed_jobs_user_idx").on(table.userId),
  statusIdx: index("feed_jobs_status_idx").on(table.status),
  createdIdx: index("feed_jobs_created_idx").on(table.createdAt),
  
  userStatusIdx: index("feed_jobs_user_status_idx")
    .on(table.userId, table.status),
}));
```

---

## Materialized Views for Performance

### View 1: Niche Statistics

```sql
CREATE MATERIALIZED VIEW niche_statistics AS
SELECT 
  n.id as niche_id,
  n.name as niche_name,
  COUNT(DISTINCT fi.id) as total_papers,
  COUNT(DISTINCT nf.user_id) as total_followers,
  AVG(fi.citation_count) as avg_citations,
  SUM(fi.views_count) as total_views,
  SUM(fi.likes_count) as total_likes
FROM niches n
LEFT JOIN feed_items fi ON fi.niche_id = n.id
LEFT JOIN niche_follows nf ON nf.niche_id = n.id
WHERE n.is_active = true
GROUP BY n.id, n.name;

CREATE UNIQUE INDEX ON niche_statistics (niche_id);
```

### View 2: User Activity Summary

```sql
CREATE MATERIALIZED VIEW user_activity_summary AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT l.feed_item_id) as total_likes,
  COUNT(DISTINCT b.feed_item_id) as total_bookmarks,
  COUNT(DISTINCT c.id) as total_comments,
  COUNT(DISTINCT nf.niche_id) as total_follows,
  MAX(ui.created_at) as last_activity_at
FROM users u
LEFT JOIN likes l ON l.user_id = u.id
LEFT JOIN bookmarks b ON b.user_id = u.id
LEFT JOIN comments c ON c.user_id = u.id
LEFT JOIN niche_follows nf ON nf.user_id = u.id
LEFT JOIN user_interactions ui ON ui.user_id = u.id
GROUP BY u.id;

CREATE UNIQUE INDEX ON user_activity_summary (user_id);
```

---

## Database Triggers

### Trigger 1: Update Feed Item Counts

```sql
-- Trigger for likes_count
CREATE OR REPLACE FUNCTION update_feed_item_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_items 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.feed_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_items 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.feed_item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_feed_item_likes_count();
```

### Trigger 2: Update User Following Count

```sql
CREATE OR REPLACE FUNCTION update_user_following_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users 
    SET following_count = following_count + 1 
    WHERE id = NEW.user_id;
    
    UPDATE niches
    SET stats = jsonb_set(
      COALESCE(stats, '{}'::jsonb),
      '{totalFollowers}',
      to_jsonb(COALESCE((stats->>'totalFollowers')::int, 0) + 1)
    )
    WHERE id = NEW.niche_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users 
    SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.user_id;
    
    UPDATE niches
    SET stats = jsonb_set(
      stats,
      '{totalFollowers}',
      to_jsonb(GREATEST(0, (stats->>'totalFollowers')::int - 1))
    )
    WHERE id = OLD.niche_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER following_count_trigger
AFTER INSERT OR DELETE ON niche_follows
FOR EACH ROW EXECUTE FUNCTION update_user_following_count();
```

---

## Migration Strategy

### Phase 1: Create New Tables
1. Create all new tables (niches, user_niche_weights, etc.)
2. Create indexes
3. Create triggers

### Phase 2: Migrate Existing Data
1. Extract unique fields of study → Create niches
2. Map feed_items to niches
3. Convert user_preferences to niche_follows
4. Initialize user_niche_weights with default values

### Phase 3: Parallel Run
1. Keep old and new schemas
2. Dual-write to both
3. Validate data consistency

### Phase 4: Cutover
1. Switch reads to new schema
2. Remove old tables after 2 weeks

---

## TypeScript Types

```typescript
// Export all types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Niche = typeof niches.$inferSelect;
export type NewNiche = typeof niches.$inferInsert;
export type FeedItem = typeof feedItems.$inferSelect;
export type NewFeedItem = typeof feedItems.$inferInsert;
export type NicheFollow = typeof nicheFollows.$inferSelect;
export type UserInteraction = typeof userInteractions.$inferSelect;
export type UserNicheWeight = typeof userNicheWeights.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type UserStoryView = typeof userStoryViews.$inferSelect;
export type FeedJob = typeof feedJobs.$inferSelect;
```

---

## Performance Optimization Checklist

- [x] Composite indexes on foreign key relationships
- [x] Partial indexes on active records
- [x] Denormalized counts to avoid COUNT() queries
- [x] JSONB for flexible metadata
- [x] Materialized views for expensive aggregations
- [x] Triggers for real-time count updates
- [x] Proper cascade delete strategies
- [x] Time-based partitioning for interactions (future)
- [x] Separate hot/cold data (future)

---

## Estimated Table Sizes

**Year 1 Projections (10,000 active users):**

| Table | Estimated Rows | Storage |
|-------|---------------|---------|
| users | 10,000 | ~5 MB |
| niches | 500 | ~1 MB |
| feed_items | 100,000 | ~500 MB |
| niche_follows | 50,000 | ~10 MB |
| user_interactions | 5,000,000 | ~2 GB |
| user_niche_weights | 50,000 | ~20 MB |
| likes | 500,000 | ~50 MB |
| bookmarks | 200,000 | ~20 MB |
| comments | 100,000 | ~100 MB |
| stories | 5,000 | ~5 MB |

**Total: ~3 GB** (within free tiers)

---

## Next Steps

1. ✅ Review and approve schema design
2. ⏭️ Implement schema in Drizzle ORM
3. ⏭️ Create migration scripts
4. ⏭️ Seed initial niche data
5. ⏭️ Set up triggers
6. ⏭️ Create materialized views
7. ⏭️ Test with sample data
8. ⏭️ Performance benchmark
9. ⏭️ Deploy to Neon DB

---

**Document Version:** 1.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation
