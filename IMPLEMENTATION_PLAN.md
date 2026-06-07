# Veritus Social Platform - Implementation Plan

## Executive Summary

Transform Veritus into a research paper social media platform similar to Instagram, where:
- **Niches** (research topics/fields) are the primary content creators (not users)
- **Papers** are the content within each niche
- **Users** (researchers) consume, engage with (like, comment, share), and follow niches
- **Personalized feeds** are generated based on user behavior and preferences
- **Stories** showcase trending papers from followed niches

---

## 1. Data Model Architecture

### Understanding the Image
Based on the provided screenshot, "Symmetry" appears to be a **Niche/Topic Profile** that:
- Posts research papers as content
- Has followers (users like "imkir", "organic_ai", etc.)
- Generates feed items that users can interact with
- Acts as a content channel, not a user account

### Core Entities

#### 1.1 Niches (Research Topics)
```typescript
niches {
  id: uuid (PK)
  slug: string (unique) // "quantum-physics", "machine-learning"
  name: string // "Quantum Physics", "Machine Learning"
  displayName: string // "QuantumPhy"
  description: text
  avatarColor: string // For generated avatars
  avatarInitials: string // "QU", "ML"
  categoryType: enum('field', 'topic', 'journal', 'institution')
  parentNicheId: uuid (nullable) // For sub-niches
  metadata: jsonb {
    fieldsOfStudy: string[]
    keywords: string[]
    relatedNiches: uuid[]
  }
  stats: jsonb {
    totalPapers: number
    totalFollowers: number
    weeklyGrowth: number
  }
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 1.2 Users (Researchers)
```typescript
users {
  id: uuid (PK)
  email: string (unique)
  username: string (unique) // "imkir", "organic_ai"
  name: string
  avatar: string
  bio: text
  institution: string
  profileType: enum('researcher', 'student', 'professional')
  onboardingCompleted: boolean
  onboardingData: jsonb {
    selectedNiches: uuid[]
    interests: string[]
    careerStage: string
    completedAt: timestamp
  }
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 1.3 Feed Items (Papers from Niches)
```typescript
feedItems {
  id: uuid (PK)
  nicheId: uuid (FK -> niches.id)
  paperId: string (unique) // Veritus API ID
  
  // Paper data
  title: text
  abstract: text
  authors: text
  doi: string
  journalName: string
  year: integer
  citationCount: integer
  influentialCitationCount: integer
  isOpenAccess: boolean
  pdfLink: string
  link: string
  tldr: text
  fieldsOfStudy: string[]
  quartileRanking: string
  publicationType: string
  thumbnailUrl: string
  
  // Feed metadata
  publishedToFeedAt: timestamp
  relevanceScore: float // Algorithm score for this paper
  trendingScore: float // Calculated from engagement
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### 1.4 Niche Follows (User subscribes to Niches)
```typescript
nicheFollows {
  userId: uuid (FK -> users.id)
  nicheId: uuid (FK -> niches.id)
  followedAt: timestamp
  notificationsEnabled: boolean
  
  PRIMARY KEY (userId, nicheId)
}
```

#### 1.5 User Interactions (Engagement Tracking)
```typescript
userInteractions {
  id: uuid (PK)
  userId: uuid (FK -> users.id)
  feedItemId: uuid (FK -> feedItems.id)
  nicheId: uuid (FK -> niches.id)
  
  interactionType: enum(
    'like', 'unlike',
    'bookmark', 'unbookmark',
    'comment', 'delete_comment',
    'share',
    'click', 'view',
    'read_abstract', 'read_full',
    'download_pdf'
  )
  
  duration: integer // Time spent (for views)
  metadata: jsonb // Extra context
  
  createdAt: timestamp
}
```

#### 1.6 User Behavior Weights (Algorithm Preferences)
```typescript
userNicheWeights {
  userId: uuid (FK -> users.id)
  nicheId: uuid (FK -> niches.id)
  
  // Calculated weights (updated periodically)
  engagementScore: float // 0-1
  viewTimeScore: float // 0-1
  interactionScore: float // 0-1
  recencyScore: float // 0-1
  combinedWeight: float // Weighted sum
  
  // Raw metrics
  totalViews: integer
  totalLikes: integer
  totalComments: integer
  totalShares: integer
  totalTimeSpent: integer // seconds
  lastInteractionAt: timestamp
  
  updatedAt: timestamp
  
  PRIMARY KEY (userId, nicheId)
}
```

#### 1.7 Stories (Trending Papers)
```typescript
stories {
  id: uuid (PK)
  nicheId: uuid (FK -> niches.id)
  feedItemId: uuid (FK -> feedItems.id)
  
  storyType: enum('trending', 'breaking', 'featured')
  priority: integer // Display order
  expiresAt: timestamp // Stories are ephemeral
  
  stats: jsonb {
    views: number
    clicks: number
  }
  
  isActive: boolean
  createdAt: timestamp
}
```

#### 1.8 User Story Views
```typescript
userStoryViews {
  userId: uuid (FK -> users.id)
  storyId: uuid (FK -> stories.id)
  viewedAt: timestamp
  viewDuration: integer
  
  PRIMARY KEY (userId, storyId)
}
```

---

## 2. Recommendation Algorithm Architecture

### 2.1 Algorithm Overview

The recommendation system uses a **hybrid approach** combining:
1. **Content-Based Filtering** - Based on niche content similarity
2. **Collaborative Filtering** - Based on similar user behaviors
3. **Engagement-Based Ranking** - Real-time engagement signals
4. **Temporal Decay** - Recent papers weighted higher

### 2.2 Feed Generation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    FEED GENERATION PIPELINE                 │
└─────────────────────────────────────────────────────────────┘

1. CANDIDATE GENERATION (Retrieval Phase)
   ├─ Get user's followed niches
   ├─ Get recent papers from each niche (last 30 days)
   ├─ Expand with similar niches (collaborative)
   └─ Result: ~500-1000 candidate papers

2. FIRST-PASS RANKING (Fast Scoring)
   ├─ Calculate user-niche affinity score
   ├─ Apply temporal decay
   ├─ Filter by quality threshold
   └─ Result: Top 200 papers

3. SECOND-PASS RANKING (Heavy Computation)
   ├─ Multi-factor scoring model:
   │  ├─ User-niche weight (35%)
   │  ├─ Paper quality score (25%)
   │  ├─ Engagement velocity (20%)
   │  ├─ Temporal relevance (15%)
   │  └─ Diversity penalty (5%)
   └─ Result: Personalized ranked feed

4. POST-PROCESSING
   ├─ Remove already seen papers
   ├─ Apply diversity rules
   ├─ Insert sponsored/featured content
   └─ Result: Final feed (paginated)
```

### 2.3 Scoring Formulas

#### User-Niche Affinity Score
```
affinity_score(user, niche) = 
  w1 * engagement_score +
  w2 * time_spent_score +
  w3 * interaction_frequency_score +
  w4 * recency_score

where:
  w1 = 0.35 (likes, comments, shares)
  w2 = 0.25 (time spent reading)
  w3 = 0.25 (how often they interact)
  w4 = 0.15 (recent vs old interactions)
```

#### Paper Relevance Score
```
relevance_score(user, paper) = 
  niche_affinity * niche_weight +
  paper_quality_score * quality_weight +
  engagement_velocity * trending_weight +
  temporal_decay * recency_weight

where:
  niche_weight = 0.35
  quality_weight = 0.25
  trending_weight = 0.20
  recency_weight = 0.20
```

#### Paper Quality Score
```
quality_score(paper) = normalize(
  0.3 * log(citation_count + 1) +
  0.2 * log(influential_citations + 1) +
  0.2 * quartile_score +
  0.15 * open_access_bonus +
  0.15 * venue_prestige_score
)
```

#### Engagement Velocity (Trending)
```
velocity(paper) = 
  (likes + 2*comments + 3*shares) / 
  sqrt(hours_since_published + 2)
```

#### Temporal Decay
```
temporal_decay(paper) = 
  1 / (1 + log(hours_since_published + 1))
```

### 2.4 Implementation Strategy

#### Phase 1: Simple Ranking (MVP)
```typescript
// Pseudo-code
async function generateFeed(userId: string, page: number) {
  // Get followed niches
  const followedNiches = await getFollowedNiches(userId);
  
  // Get recent papers from these niches
  const papers = await getPapersFromNiches(followedNiches, {
    limit: 100,
    daysBack: 30
  });
  
  // Simple scoring: niche weight * paper quality
  const scored = papers.map(paper => ({
    ...paper,
    score: getUserNicheWeight(userId, paper.nicheId) * 
           getPaperQuality(paper)
  }));
  
  // Sort and paginate
  return scored.sort((a, b) => b.score - a.score)
                .slice(page * 10, (page + 1) * 10);
}
```

#### Phase 2: Advanced ML (Future)
- Use **Two-Tower Neural Network** (like Instagram)
- User embedding tower + Paper embedding tower
- Train on interaction data
- Real-time inference with caching

---

## 3. Onboarding Flow

### 3.1 User Journey

```
Step 1: Welcome & Profile Setup
├─ Name, email, username
├─ Institution (optional)
├─ Career stage (student, researcher, professional)
└─ Avatar upload/generation

Step 2: Interest Discovery
├─ Show top 20 popular niches with avatars
├─ User selects 5-10 niches to follow
├─ "See what's trending in [niche name]"
└─ Visual, Instagram-style selection

Step 3: Preference Refinement
├─ Show sample papers from selected niches
├─ User swipes/clicks to indicate interest
├─ System learns initial preferences
└─ "Almost there! Just a few more..."

Step 4: Follow Suggestions
├─ "Users like you also follow..."
├─ Collaborative filtering suggestions
├─ Show 5-10 more niche suggestions
└─ Skip option available

Step 5: Feed Preview
├─ Generate first personalized feed
├─ Show tutorial overlay
├─ "Pull to refresh", "Tap to read more"
└─ Complete onboarding
```

### 3.2 Initial Niche Weights

After onboarding:
```typescript
// Set initial weights for selected niches
selectedNiches.forEach(niche => {
  setUserNicheWeight(userId, nicheId, {
    engagementScore: 0.5,    // Mid-level interest
    viewTimeScore: 0.5,
    interactionScore: 0.5,
    recencyScore: 1.0,       // Recent follow
    combinedWeight: 0.6      // Above average
  });
});
```

---

## 4. User Behavior Tracking System

### 4.1 Events to Track

```typescript
// Frontend tracking events
const TRACKED_EVENTS = {
  // View events
  FEED_ITEM_VIEWED: 'feed_item_viewed',      // In viewport >1s
  FEED_ITEM_CLICKED: 'feed_item_clicked',    // Expanded to read
  ABSTRACT_READ: 'abstract_read',            // Read full abstract
  PAPER_OPENED: 'paper_opened',              // External link clicked
  PDF_DOWNLOADED: 'pdf_downloaded',
  
  // Interaction events
  LIKE: 'like',
  UNLIKE: 'unlike',
  COMMENT: 'comment',
  SHARE: 'share',
  BOOKMARK: 'bookmark',
  
  // Niche events
  NICHE_FOLLOWED: 'niche_followed',
  NICHE_UNFOLLOWED: 'niche_unfollowed',
  NICHE_PROFILE_VIEWED: 'niche_profile_viewed',
  
  // Story events
  STORY_VIEWED: 'story_viewed',
  STORY_TAPPED: 'story_tapped',
  STORY_EXITED: 'story_exited',
  
  // Negative signals
  HIDE_PAPER: 'hide_paper',                  // User hides content
  REPORT_PAPER: 'report_paper',
  SCROLL_PAST: 'scroll_past',                // Quickly scrolled past
};
```

### 4.2 Tracking Implementation

```typescript
// Analytics service
class AnalyticsService {
  async trackEvent(userId: string, event: {
    type: string;
    feedItemId?: string;
    nicheId?: string;
    duration?: number;
    metadata?: any;
  }) {
    // Save to userInteractions table
    await db.insert(userInteractions).values({
      userId,
      feedItemId: event.feedItemId,
      nicheId: event.nicheId,
      interactionType: event.type,
      duration: event.duration,
      metadata: event.metadata,
      createdAt: new Date()
    });
    
    // Trigger weight update (async background job)
    await queue.enqueue('update-user-weights', { userId });
  }
}
```

### 4.3 Weight Update Algorithm

```typescript
// Background job: runs every hour or after N interactions
async function updateUserNicheWeights(userId: string) {
  const niches = await getUserNiches(userId);
  
  for (const niche of niches) {
    // Get recent interactions (last 30 days)
    const interactions = await getInteractions(userId, niche.id, 30);
    
    // Calculate scores
    const engagementScore = calculateEngagement(interactions);
    const viewTimeScore = calculateViewTime(interactions);
    const interactionScore = calculateInteractionFrequency(interactions);
    const recencyScore = calculateRecency(interactions);
    
    // Weighted combination
    const combinedWeight = 
      0.35 * engagementScore +
      0.25 * viewTimeScore +
      0.25 * interactionScore +
      0.15 * recencyScore;
    
    // Update in database
    await db.insert(userNicheWeights).values({
      userId,
      nicheId: niche.id,
      engagementScore,
      viewTimeScore,
      interactionScore,
      recencyScore,
      combinedWeight,
      totalViews: interactions.views,
      totalLikes: interactions.likes,
      totalComments: interactions.comments,
      totalShares: interactions.shares,
      totalTimeSpent: interactions.timeSpent,
      lastInteractionAt: interactions.lastInteraction,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [userNicheWeights.userId, userNicheWeights.nicheId],
      set: { /* update values */ }
    });
  }
}
```

---

## 5. Stories System

### 5.1 Story Generation Logic

```typescript
// Stories are generated for each niche based on:
// 1. High engagement papers (last 24-48 hours)
// 2. Breaking/important papers (editorial picks)
// 3. Papers from followed niches

async function generateStories() {
  const niches = await getActiveNiches();
  
  for (const niche of niches) {
    // Get trending papers from last 48 hours
    const trending = await getTrendingPapers(niche.id, {
      hoursBack: 48,
      minEngagement: 10,
      limit: 5
    });
    
    // Create story for each trending paper
    for (const paper of trending) {
      await db.insert(stories).values({
        nicheId: niche.id,
        feedItemId: paper.id,
        storyType: 'trending',
        priority: paper.engagementVelocity,
        expiresAt: addHours(new Date(), 24), // Expires in 24h
        isActive: true
      });
    }
  }
}
```

### 5.2 User Story Feed

```typescript
// Get stories for user's feed (top bar)
async function getUserStories(userId: string) {
  // Get followed niches
  const followedNiches = await getFollowedNiches(userId);
  
  // Get niche weights for sorting
  const weights = await getUserNicheWeights(userId);
  
  // Get active stories from followed niches
  const stories = await db
    .select()
    .from(stories)
    .where(
      and(
        inArray(stories.nicheId, followedNiches.map(n => n.id)),
        eq(stories.isActive, true),
        gt(stories.expiresAt, new Date())
      )
    );
  
  // Group by niche
  const storiesByNiche = groupBy(stories, 'nicheId');
  
  // Sort niches by weight
  const sortedNiches = followedNiches.sort((a, b) => {
    const weightA = weights.find(w => w.nicheId === a.id)?.combinedWeight || 0;
    const weightB = weights.find(w => w.nicheId === b.id)?.combinedWeight || 0;
    return weightB - weightA;
  });
  
  // Return stories with niche info
  return sortedNiches.map(niche => ({
    niche: {
      id: niche.id,
      name: niche.name,
      avatarColor: niche.avatarColor,
      avatarInitials: niche.avatarInitials
    },
    stories: storiesByNiche[niche.id] || [],
    hasUnviewed: hasUnviewedStories(userId, storiesByNiche[niche.id])
  }));
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create new database schema (niches, niche follows, interactions, weights)
- [ ] Migration scripts to restructure existing data
- [ ] Create seed data for niches (based on fieldsOfStudy)
- [ ] Update API routes for new structure
- [ ] Basic niche profile pages

### Phase 2: Core Features (Weeks 3-4)
- [ ] Implement follow/unfollow niche functionality
- [ ] Create onboarding flow
- [ ] Build simple recommendation algorithm (Phase 1)
- [ ] Update feed to show niche-attributed papers
- [ ] Implement interaction tracking

### Phase 3: Algorithm & Personalization (Weeks 5-6)
- [ ] Build weight calculation system
- [ ] Implement background jobs for weight updates
- [ ] Create advanced scoring algorithm
- [ ] Add diversity and freshness to feed
- [ ] A/B testing framework

### Phase 4: Stories & Polish (Weeks 7-8)
- [ ] Build stories system
- [ ] Create story viewer UI
- [ ] Implement story generation logic
- [ ] Add story tracking and analytics
- [ ] Performance optimization

### Phase 5: Advanced Features (Weeks 9+)
- [ ] Explore/Discovery page (find new niches)
- [ ] Trending papers section
- [ ] User profiles with activity
- [ ] Notifications system
- [ ] ML-based recommendations (Two-Tower model)

---

## 7. Key Architectural Decisions

### 7.1 Why Niches as Content Creators?

**Advantages:**
1. **Scalability**: Papers are automatically attributed to niches
2. **Quality Control**: Users follow topics, not individual users who might post low-quality content
3. **Discovery**: Easier to find relevant content through topic-based organization
4. **No User-Generated Content**: Eliminates moderation challenges
5. **Authority**: Research papers are inherently authoritative content

**Instagram Parallel:**
- Instagram: User posts photo → Followers see it
- Veritus: Niche "posts" paper → Followers see it

### 7.2 Feed Ranking Strategy

We'll use a **hybrid approach** (like Instagram, Facebook, Twitter):

1. **Candidate Generation** (Retrieval)
   - Fast, broad search
   - Returns ~1000 candidates
   - Based on follows and content similarity

2. **Ranking** (Scoring)
   - Slow, accurate scoring
   - Ranks top 200
   - Uses ML models and complex features

3. **Re-ranking** (Post-processing)
   - Diversity injection
   - Remove duplicates
   - Insert ads/featured content

### 7.3 Real-time vs Batch Processing

**Real-time:**
- User interactions (likes, comments) → Immediate DB write
- Feed generation → On-demand with caching
- Story views → Real-time tracking

**Batch (Background Jobs):**
- Weight updates → Hourly/daily Inngest jobs
- Story generation → Every 6 hours
- Trending calculations → Every hour
- Niche statistics → Daily

### 7.4 Caching Strategy

```typescript
// Feed caching
const CACHE_TTL = {
  USER_FEED: 5 * 60,        // 5 minutes
  NICHE_PAPERS: 15 * 60,    // 15 minutes
  TRENDING: 30 * 60,        // 30 minutes
  STORIES: 60,              // 1 minute
  USER_WEIGHTS: 60 * 60     // 1 hour
};

// Example with Redis
async function getFeed(userId: string, page: number) {
  const cacheKey = `feed:${userId}:${page}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Generate fresh feed
  const feed = await generateFeed(userId, page);
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, CACHE_TTL.USER_FEED, JSON.stringify(feed));
  
  return feed;
}
```

---

## 8. Frontend Changes

### 8.1 Component Updates

```
src/components/
├── niches/
│   ├── NicheAvatar.tsx       # Circular avatar with initials/color
│   ├── NicheCard.tsx         # Niche profile card
│   ├── NicheHeader.tsx       # Niche page header
│   ├── NicheFollowButton.tsx # Follow/Unfollow button
│   └── NicheGrid.tsx         # Grid of niche suggestions
├── feed/
│   ├── FeedCard.tsx          # Update: Show niche attribution
│   ├── FeedList.tsx          # Update: New sorting
│   └── FeedEmpty.tsx         # Empty state (follow niches)
├── stories/
│   ├── StoriesBar.tsx        # Top horizontal scroll
│   ├── StoryViewer.tsx       # Full-screen story view
│   ├── StoryRing.tsx         # Circular story indicator
│   └── StoryProgress.tsx     # Progress bars
├── onboarding/
│   ├── OnboardingFlow.tsx    # Multi-step wizard
│   ├── NicheSelector.tsx     # Grid selection
│   └── PreferenceSwiper.tsx  # Swipe interface
└── explore/
    ├── ExploreGrid.tsx       # Discover new niches
    └── TrendingSection.tsx   # Trending papers
```

### 8.2 Updated FeedCard

```tsx
// Show niche as "author"
<FeedCard
  niche={{
    id: "uuid",
    name: "Machine Learning",
    displayName: "ML",
    avatarColor: "#FF6B6B",
    avatarInitials: "ML"
  }}
  paper={{...paperData}}
  onFollowNiche={handleFollow}
  isFollowingNiche={true}
/>
```

---

## 9. API Endpoints

### 9.1 New Endpoints

```typescript
// Niches
GET    /api/niches                    // List all niches
GET    /api/niches/:id                // Get niche details
GET    /api/niches/:id/papers         // Papers in niche
GET    /api/niches/:id/followers      // Followers count/list
GET    /api/niches/trending           // Trending niches
POST   /api/niches/:id/follow         // Follow niche
DELETE /api/niches/:id/follow         // Unfollow niche

// Feed (updated)
GET    /api/feed                      // Personalized feed
GET    /api/feed/explore              // Discovery feed

// Stories
GET    /api/stories                   // User's story feed
GET    /api/stories/:nicheId          // Stories for a niche
POST   /api/stories/:id/view          // Mark story as viewed

// Onboarding
POST   /api/onboarding/complete       // Save onboarding data
GET    /api/onboarding/suggestions    // Get niche suggestions

// Analytics
POST   /api/analytics/track           // Track user interaction

// User
GET    /api/user/following            // Followed niches
GET    /api/user/preferences          // User preferences
PUT    /api/user/preferences          // Update preferences
```

---

## 10. Database Migration Plan

### 10.1 Migration Strategy

```sql
-- Step 1: Create new tables
CREATE TABLE niches (...);
CREATE TABLE niche_follows (...);
CREATE TABLE user_interactions (...);
CREATE TABLE user_niche_weights (...);
CREATE TABLE stories (...);
CREATE TABLE user_story_views (...);

-- Step 2: Migrate existing data
-- Create niches from unique fieldsOfStudy
INSERT INTO niches (slug, name, displayName, categoryType)
SELECT DISTINCT
  LOWER(REPLACE(field, ' ', '-')),
  field,
  UPPER(SUBSTRING(field, 1, 2)),
  'field'
FROM (
  SELECT UNNEST(fields_of_study) as field
  FROM feed_items
) subquery;

-- Step 3: Link papers to niches
ALTER TABLE feed_items ADD COLUMN niche_id UUID;
UPDATE feed_items fi
SET niche_id = n.id
FROM niches n
WHERE n.name = ANY(fi.fields_of_study);

-- Step 4: Migrate user preferences to niche follows
INSERT INTO niche_follows (user_id, niche_id, followed_at)
SELECT 
  up.user_id,
  n.id,
  NOW()
FROM user_preferences up
CROSS JOIN UNNEST(up.fields_of_study) as field
JOIN niches n ON n.name = field;

-- Step 5: Initialize weights for followed niches
INSERT INTO user_niche_weights (user_id, niche_id, combined_weight)
SELECT user_id, niche_id, 0.6
FROM niche_follows;
```

### 10.2 Rollback Plan

Keep old schema for 2 weeks, run in parallel, switch gradually.

---

## 11. Performance Considerations

### 11.1 Database Indexes

```sql
-- Critical indexes
CREATE INDEX idx_feed_items_niche_id ON feed_items(niche_id);
CREATE INDEX idx_feed_items_published ON feed_items(published_to_feed_at DESC);
CREATE INDEX idx_user_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX idx_user_niche_weights_user ON user_niche_weights(user_id, combined_weight DESC);
CREATE INDEX idx_stories_niche ON stories(niche_id, is_active, expires_at);
CREATE INDEX idx_niche_follows_user ON niche_follows(user_id);
```

### 11.2 Query Optimization

```typescript
// Use materialized views for expensive queries
CREATE MATERIALIZED VIEW niche_stats AS
SELECT 
  niche_id,
  COUNT(DISTINCT id) as total_papers,
  SUM(citation_count) as total_citations,
  COUNT(DISTINCT user_id) as total_followers
FROM feed_items
GROUP BY niche_id;

// Refresh periodically
REFRESH MATERIALIZED VIEW niche_stats;
```

### 11.3 Caching Layers

1. **Redis** - User feeds, trending data, niche info
2. **CDN** - Static assets, paper PDFs, thumbnails
3. **In-memory** - Hot niches, featured stories
4. **Database** - Materialized views, indexes

---

## 12. Monitoring & Analytics

### 12.1 Key Metrics

**User Engagement:**
- Daily Active Users (DAU)
- Session duration
- Posts viewed per session
- Interaction rate (likes/views)
- Feed refresh rate

**Niche Performance:**
- Follower growth rate
- Engagement rate per niche
- Top performing niches
- Niche churn rate

**Algorithm Performance:**
- Click-through rate (CTR)
- Dwell time on papers
- Skip rate (scrolled past without interaction)
- Diversity score (niche distribution in feed)

**Business Metrics:**
- User retention (D1, D7, D30)
- Time to first follow
- Onboarding completion rate
- Papers read per user

### 12.2 A/B Testing Framework

```typescript
// Test different algorithm weights
const experiments = {
  'feed_v1': { engagement: 0.35, quality: 0.25, trending: 0.20 },
  'feed_v2': { engagement: 0.40, quality: 0.20, trending: 0.25 },
};

async function getFeed(userId: string) {
  const variant = await getExperimentVariant(userId, 'feed_algorithm');
  const weights = experiments[variant];
  
  return generateFeedWithWeights(userId, weights);
}
```

---

## 13. Security & Privacy

### 13.1 Data Privacy

- User interactions are private (not visible to others)
- Aggregate data only for analytics
- GDPR-compliant data export/deletion
- No tracking without consent

### 13.2 Rate Limiting

```typescript
// Prevent abuse
const RATE_LIMITS = {
  FEED_FETCH: 100,        // per hour
  LIKE: 500,              // per hour
  COMMENT: 100,           // per hour
  FOLLOW: 50,             // per hour
  TRACK_EVENT: 1000       // per hour
};
```

---

## 14. Testing Strategy

### 14.1 Unit Tests
- Algorithm scoring functions
- Weight calculations
- Data transformations

### 14.2 Integration Tests
- API endpoints
- Database queries
- Background jobs

### 14.3 E2E Tests
- Onboarding flow
- Feed generation
- User interactions
- Story viewing

---

## 15. Launch Checklist

- [ ] Database migration completed
- [ ] All API endpoints tested
- [ ] Frontend UI updated
- [ ] Onboarding flow tested
- [ ] Algorithm validated with sample data
- [ ] Background jobs running
- [ ] Caching configured
- [ ] Monitoring setup
- [ ] Documentation updated
- [ ] Beta user testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Rollback plan ready

---

## 16. Future Enhancements

### 16.1 Phase 2 Features
- [ ] User profiles with reading history
- [ ] Direct messages between researchers
- [ ] Groups/Communities around niches
- [ ] Paper discussions/threads
- [ ] Saved collections
- [ ] Reading lists
- [ ] Annotations/highlights

### 16.2 Advanced ML
- [ ] Deep learning recommendation model
- [ ] Embedding-based similarity
- [ ] Transfer learning from similar platforms
- [ ] Multi-armed bandit for exploration
- [ ] Contextual recommendations (time, location)

### 16.3 Monetization
- [ ] Featured niches (sponsored)
- [ ] Promoted papers
- [ ] Premium features (unlimited bookmarks, etc.)
- [ ] Institution subscriptions
- [ ] API access for third parties

---

## 17. Recommended Libraries & Tools

### 17.1 Complete Recommendation Engines (All-in-One Solutions)

#### **1. Gorse (Go-based, RESTful API) ⭐ RECOMMENDED**
- **Language**: Go (with TypeScript/JavaScript SDK)
- **Repository**: https://github.com/gorse-io/gorse
- **What it does**: Full-featured recommendation system with AutoML
- **Key Features**:
  - Multiple algorithms: User-based, Item-based, Collaborative Filtering
  - RESTful APIs for easy integration
  - Auto-ML to find best model automatically
  - Supports Redis, MySQL, Postgres, MongoDB, ClickHouse
  - Built-in dashboard for monitoring
  - Horizontal scaling support
  - Real-time recommendations

**Integration Example:**
```typescript
import { Gorse } from "gorsejs";

const client = new Gorse({ 
  endpoint: "http://127.0.0.1:8087", 
  secret: "api_key" 
});

// Insert user interactions (likes, views, etc.)
await client.insertFeedbacks([
  { 
    FeedbackType: 'like', 
    UserId: 'user123', 
    ItemId: 'paper456', 
    Timestamp: '2025-12-07' 
  }
]);

// Get personalized recommendations
const recs = await client.getRecommend({ 
  userId: 'user123', 
  cursorOptions: { n: 10 } 
});
```

**Why Choose Gorse:**
- ✅ Production-ready with minimal setup
- ✅ Handles all algorithm complexity for you
- ✅ TypeScript SDK available
- ✅ Can run as separate service (microservice architecture)
- ✅ Built-in A/B testing support
- ✅ Great documentation

#### **2. Metarank (Scala-based, Real-time Ranking)**
- **Repository**: https://www.metarank.ai/
- **What it does**: Open-source reranking engine for feeds
- **Key Features**:
  - Designed specifically for feed ranking
  - Real-time personalization
  - Supports Two-Tower models
  - Easy configuration with YAML
  - REST API integration

**Integration Example:**
```yaml
# config.yaml
similar:
  type: als  # Alternating Least Squares
  interactions: [click, like, bookmark]
  factors: 100
  iterations: 100
```

#### **3. Superlinked (Python Framework)**
- **Repository**: https://github.com/superlinked/superlinked
- **What it does**: Framework for building vector-based recommendation systems
- **Key Features**:
  - Combines structured and unstructured data
  - Vector embeddings for papers (text + metadata)
  - High-performance search & recommendations
  - Great for academic content

### 17.2 ML Libraries for Custom Algorithms

#### **1. TensorFlow Recommenders (TFRS)**
- **Language**: Python
- **What it does**: Build Two-Tower models like Instagram/YouTube
- **Use Case**: Advanced ML-based recommendations (Phase 5)
- **Integration**: Via Python API service

**Two-Tower Model Example:**
```python
import tensorflow_recommenders as tfrs

# User Tower
user_model = tf.keras.Sequential([
  tf.keras.layers.Embedding(num_users, 64),
  tf.keras.layers.Dense(32, activation='relu')
])

# Item Tower
item_model = tf.keras.Sequential([
  tf.keras.layers.Embedding(num_papers, 64),
  tf.keras.layers.Dense(32, activation='relu')
])

# Combined model
model = tfrs.models.Model(
  user_model=user_model,
  item_model=item_model
)
```

#### **2. Microsoft UniRec**
- **Repository**: https://github.com/microsoft/UniRec
- **What it does**: Easy-to-use recommender system ecosystem
- **Key Features**:
  - Scalable and lightweight
  - Minimal code to get started
  - Production-ready models

#### **3. Cornac (Python)**
- **Repository**: https://cornac.readthedocs.io/
- **What it does**: Multimodal recommender systems framework
- **Great for**: Combining text, metadata, and user behavior
- **Compatible with**: TensorFlow, PyTorch

### 17.3 Personalization APIs (Managed Services)

#### **1. Shaped.ai**
- **Website**: https://www.shaped.ai/
- **What it does**: Managed ranking and recommendation API
- **Key Features**:
  - Real-time personalization
  - Two-Tower models built-in
  - Easy integration
  - Handles scaling automatically
- **Pricing**: Paid service (has free tier)

#### **2. GetStream.io**
- **Website**: https://getstream.io/activity-feeds/personalization/
- **What it does**: Activity feed API with ML-based ranking
- **Key Features**:
  - Feed ranking like Facebook/Twitter
  - Follow suggestions
  - Discovery algorithms
  - Real-time updates
- **Best for**: Fast implementation without ML expertise

#### **3. Algolia Recommend**
- **Website**: https://www.algolia.com/
- **What it does**: AI-powered recommendations
- **Key Features**:
  - Related items
  - Trending content
  - Personalized results
- **Integration**: JavaScript/React libraries available

### 17.4 Simple Libraries for Basic Algorithms

#### **1. Disco (Node.js)**
- **Repository**: https://github.com/ankane/disco-node
- **What it does**: Collaborative filtering in Node.js
- **Great for**: Simple user-item recommendations
- **Use Case**: MVP implementation

**Example:**
```javascript
const { Recommender } = require('disco-node');

const recommender = new Recommender();
recommender.fit([
  { userId: '1', itemId: 'paper123', rating: 5 },
  { userId: '1', itemId: 'paper456', rating: 4 },
]);

const recs = recommender.userRecs('1', 10);
```

#### **2. Raccoon (JavaScript)**
- **Repository**: https://github.com/guymorita/recommendationRaccoon
- **What it does**: Recommendation engine for Node.js
- **Uses**: Redis for storage
- **Simple API**: Like, dislike, recommend

### 17.5 Our Recommendation Stack

For Veritus, we recommend a **hybrid approach**:

#### **Phase 1-3: Use Gorse** ⭐ BEST CHOICE
**Why:**
- Production-ready out of the box
- TypeScript SDK available
- Handles all algorithm complexity
- Can run as Docker container
- RESTful API (easy to integrate with Next.js)
- AutoML finds best algorithm automatically
- Built-in A/B testing

**Architecture:**
```
┌─────────────┐
│   Next.js   │
│   Frontend  │
└──────┬──────┘
       │ REST API
       ▼
┌─────────────┐      ┌─────────────┐
│   Gorse     │◄────►│  PostgreSQL │
│   Server    │      │  (Neon DB)  │
└─────────────┘      └─────────────┘
```

**Implementation:**
1. Run Gorse as Docker container
2. Feed user interactions via REST API
3. Get recommendations on-demand
4. Gorse handles: scoring, ranking, model training

**Data Flow:**
```typescript
// Track user interaction
await gorse.insertFeedback({
  FeedbackType: 'like',
  UserId: user.id,
  ItemId: paper.id
});

// Get personalized feed
const feed = await gorse.getRecommend({
  userId: user.id,
  n: 20,
  offset: page * 20
});
```

#### **Phase 4-5: Add Custom Scoring**
- Use Gorse for base recommendations
- Apply custom scoring layer for:
  - Paper quality (citations, venue)
  - Temporal decay
  - Niche weights
- Combine Gorse scores with custom scores

#### **Phase 5+: Upgrade to TensorFlow Two-Tower (Optional)**
If you need Instagram-level sophistication:
- Build Python service with TensorFlow Recommenders
- Train Two-Tower model on interaction data
- Deploy as separate API
- Use for candidate generation, then rerank

### 17.6 Comparison Table

| Library | Language | Complexity | Setup Time | Best For |
|---------|----------|------------|------------|----------|
| **Gorse** | Go + JS SDK | Low | 1 hour | Production apps |
| Metarank | Scala | Medium | 2-3 hours | Feed ranking |
| Disco | Node.js | Low | 30 mins | Simple MVP |
| TFRS | Python | High | Days | Custom ML |
| Shaped.ai | API | Low | 1 hour | Managed solution |
| GetStream | API | Low | 2 hours | Activity feeds |

### 17.7 Implementation Timeline with Gorse

**Week 1:**
- [ ] Set up Gorse Docker container
- [ ] Install gorse-js SDK
- [ ] Create API wrapper for Gorse

**Week 2:**
- [ ] Track user interactions (likes, views, etc.)
- [ ] Implement recommendation endpoints
- [ ] Test basic recommendations

**Week 3:**
- [ ] Add niche-based filtering
- [ ] Implement custom scoring layer
- [ ] Tune Gorse parameters

**Week 4:**
- [ ] A/B testing different algorithms
- [ ] Monitor performance
- [ ] Optimize queries

### 17.8 Cost Comparison

**Self-Hosted (Gorse):**
- Free (open source)
- Infrastructure: ~$20-50/month (Docker container)
- Total: **~$50/month**

**Managed Services:**
- Shaped.ai: $99-499/month
- GetStream: $99-999/month
- Algolia: $1/1000 requests

**Recommendation**: Start with self-hosted Gorse, move to managed service if scaling becomes complex.

---

## 18. References & Research

### Key Findings from Research:

1. **Instagram Algorithm** (Buffer, Meta Transparency):
   - Uses two-tower neural networks for candidate generation
   - Ranking based on: relationship, interest, timeliness, frequency
   - Stories prioritize close connections and recent activity
   - Diversity injection prevents filter bubbles

2. **Recommendation Systems** (arXiv papers):
   - Hybrid approaches outperform single methods
   - Temporal decay is crucial for freshness
   - User behavior > explicit preferences
   - Cold-start solved with collaborative filtering

3. **Academic Paper Recommendations** (IEEE, arXiv):
   - Citation-based features are strong signals
   - Time-aware models perform better
   - Multi-dimensional features (content, metadata, context)
   - Collaborative filtering effective for paper discovery

4. **Engagement Metrics** (Snap Research):
   - Context (time, location) significantly improves predictions
   - Active engagement (likes) > passive (views)
   - Recency bias is important
   - Session duration indicates quality

---

## 19. Quick Start Guide (Using Gorse)

### Step 1: Set Up Gorse
```bash
# Using Docker
docker run -d \
  --name gorse \
  -p 8087:8087 \
  -e GORSE_CACHE_STORE=redis://redis:6379 \
  -e GORSE_DATA_STORE=postgres://user:pass@postgres/gorse \
  zhenghaoz/gorse-in-one

# Or using Docker Compose (see docker-compose.yml below)
docker-compose up -d
```

### Step 2: Install SDK
```bash
npm install gorsejs
```

### Step 3: Create Gorse Client
```typescript
// src/lib/gorse/client.ts
import { Gorse } from "gorsejs";

export const gorseClient = new Gorse({
  endpoint: process.env.GORSE_ENDPOINT || "http://localhost:8087",
  secret: process.env.GORSE_API_KEY || ""
});

// Helper functions
export async function trackInteraction(
  userId: string,
  itemId: string,
  type: 'view' | 'like' | 'bookmark' | 'comment' | 'share'
) {
  await gorseClient.insertFeedback({
    FeedbackType: type,
    UserId: userId,
    ItemId: itemId,
    Timestamp: new Date().toISOString()
  });
}

export async function getRecommendations(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  return await gorseClient.getRecommend({
    userId,
    cursorOptions: { n: limit, offset }
  });
}
```

### Step 4: Track User Actions
```typescript
// In your API routes or client components
import { trackInteraction } from '@/lib/gorse/client';

// When user likes a paper
await trackInteraction(userId, paperId, 'like');

// When user views a paper
await trackInteraction(userId, paperId, 'view');
```

### Step 5: Generate Feed
```typescript
// src/app/api/feed/personalized/route.ts
import { getRecommendations } from '@/lib/gorse/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const page = parseInt(searchParams.get('page') || '1');
  
  // Get recommendations from Gorse
  const gorsePapers = await getRecommendations(
    userId, 
    20, 
    (page - 1) * 20
  );
  
  // Fetch full paper details from database
  const papers = await db.select()
    .from(feedItems)
    .where(inArray(feedItems.id, gorsePapers.map(p => p.item)));
  
  return Response.json({ papers });
}
```

### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3'
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_DB: gorse
      POSTGRES_USER: gorse
      POSTGRES_PASSWORD: gorse_pass
    ports:
      - "5432:5432"
  
  gorse:
    image: zhenghaoz/gorse-in-one:latest
    ports:
      - "8087:8087"
      - "8088:8088"
    environment:
      GORSE_CACHE_STORE: redis://redis:6379
      GORSE_DATA_STORE: postgres://postgres:5432/gorse?sslmode=disable
    depends_on:
      - redis
      - postgres
    command: >
      gorse-in-one
      --cache-store redis://redis:6379
      --data-store postgres://gorse:gorse_pass@postgres/gorse?sslmode=disable
```

---

## Conclusion

This plan transforms Veritus into a research-focused social media platform where:
- **Niches** are the stars (like Instagram profiles)
- **Papers** are the posts (content within niches)
- **Users** are the audience (consume and engage)
- **Algorithm** personalizes everything based on behavior

**Key Technology Decisions:**
- **Recommendation Engine**: Gorse (open-source, production-ready)
- **Database**: PostgreSQL (existing Neon DB)
- **Caching**: Redis (for Gorse and feed caching)
- **Backend**: Next.js API routes with TypeScript
- **ML (Future)**: TensorFlow Recommenders for Two-Tower model

**Why This Approach Works:**
1. ✅ **Minimal custom algorithm code** - Gorse handles the complexity
2. ✅ **Production-ready** - Battle-tested recommendation engine
3. ✅ **Scalable** - Horizontal scaling built-in
4. ✅ **Fast to implement** - Can have basic recommendations in 1 week
5. ✅ **Flexible** - Can add custom scoring layers later
6. ✅ **Cost-effective** - Open source with low hosting costs

**Next Steps:**
1. Review and approve this plan
2. Set up Gorse infrastructure (1-2 hours)
3. Install gorse-js SDK
4. Implement interaction tracking
5. Create personalized feed endpoint
6. Test with sample data
7. Begin Phase 1 database migrations

**Estimated Time to Launch:**
- **Basic personalization**: 1 week
- **Full feature set (Phase 1-3)**: 4-6 weeks
- **Stories & advanced features**: 8 weeks

---

**Document Version:** 2.0  
**Last Updated:** December 7, 2025  
**Author:** GitHub Copilot  
**Status:** Ready for Implementation

**Libraries Added:**
- Gorse (recommendation engine)
- TensorFlow Recommenders (future ML upgrade)
- Various alternatives researched and documented
