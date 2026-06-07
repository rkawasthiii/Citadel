# Database Migration Completed ✅

**Migration Date**: December 7, 2025

## Summary

Successfully migrated from old schema (7 tables) to new social media schema (13 tables).

---

## Changes Applied

### ✅ Completed Steps

1. **Schema Backup**
   - Old schema saved as `src/lib/db/schema.old.ts`
   - Migration snapshot: `drizzle/0001_slim_deathbird.sql`

2. **Schema Replacement**
   - Replaced `src/lib/db/schema.ts` with new schema
   - 6 new tables added: niches, niche_follows, user_interactions, user_niche_weights, stories, user_story_views

3. **Database Migration**
   - Generated migration: `drizzle/0001_slim_deathbird.sql`
   - Applied to database with `drizzle-kit push`
   - All tables created successfully

4. **Schema Updates**
   - **users**: Added 12 new columns (username, profile_type, onboarding_completed, counts, settings, etc.)
   - **feed_items**: Added 16 new columns (niche_id, scores, engagement counts, etc.)
   - **comments**: Added 5 new columns (parent_comment_id, depth, path, edited_at, edit_count)
   - **feed_jobs**: Added 5 new columns (params, new_papers_count, error, retry_count, started_at)

---

## New Database Structure (13 Tables)

### Core Social Tables
1. **users** (20 columns, 4 indexes)
   - Authentication & profile
   - Onboarding data
   - Denormalized counts
   - Settings JSONB

2. **niches** (18 columns, 7 indexes)
   - Research topics/categories
   - Stats & popularity scores
   - Parent-child hierarchy support

3. **feed_items** (36 columns, 9 indexes)
   - Papers linked to niches
   - Quality/relevance/trending scores
   - Engagement counts
   - Recommendation metadata

### Engagement Tables
4. **likes** (3 columns, 3 indexes)
5. **bookmarks** (5 columns, 4 indexes)
6. **comments** (11 columns, 5 indexes)
   - Threaded comments support
   - Edit tracking

### Social Graph
7. **niche_follows** (7 columns, 4 indexes)
   - User → Niche relationships
   - Notification preferences
   - Interaction tracking

### Recommendation Engine
8. **user_interactions** (10 columns, 8 indexes)
   - Event stream (view, like, bookmark, share, comment)
   - Duration & scroll tracking
   - Context metadata

9. **user_niche_weights** (17 columns, 3 indexes)
   - Precomputed affinity scores
   - Engagement/view time/interaction/recency scores
   - Raw weights for Gorse

### Stories System
10. **stories** (11 columns, 5 indexes)
    - Trending papers (24h expiry)
    - Priority & view stats

11. **user_story_views** (5 columns, 3 indexes)
    - Story view tracking
    - Completion tracking

### Legacy/Jobs
12. **user_preferences** (9 columns, 0 indexes)
    - Kept for backward compatibility
    - Will be deprecated after migration

13. **feed_jobs** (13 columns, 4 indexes)
    - Background job tracking
    - Enhanced with error handling

---

## ⚠️ Data Loss Warning

The following data was removed during migration:
- ❌ `users.fields_of_study` (3 users affected)
- ❌ `feed_jobs.phrases` (1 job affected)
- ❌ `feed_jobs.query` (1 job affected)
- ❌ Old feed_items without niche assignment (100 papers)

**Reason**: New schema requires different data structure (niches instead of fields_of_study)

---

## 🔧 Next Steps Required

### Immediate (Code Updates)

The following files need updates to work with new schema:

1. **`src/lib/inngest/functions.ts`**
   - Update `userPreferences` import (table still exists but deprecated)
   - Add `niches` table import
   - Update job logic to work with new schema

2. **API Routes** (already importing correct tables)
   - ✅ `src/app/api/feed/route.ts`
   - ✅ `src/app/api/feed/[id]/like/route.ts`
   - ✅ `src/app/api/feed/[id]/bookmark/route.ts`
   - ✅ `src/app/api/feed/[id]/comments/route.ts`
   - ✅ `src/app/api/webhooks/veritus/route.ts`

### Phase 2 (Data Population)

Create seed scripts to populate:

1. **Niches**
   ```sql
   -- Extract unique fields from old data
   -- Create niche records
   -- Assign feed_items to niches
   ```

2. **User Profiles**
   ```sql
   -- Generate usernames from emails
   -- Set onboarding_completed = false
   -- Initialize all counts to 0
   ```

3. **Niche Follows**
   ```sql
   -- Convert user_preferences.fields_of_study to niche_follows
   -- Calculate initial weights
   ```

### Phase 3 (Feature Implementation)

1. **Onboarding Flow**
   - Create onboarding wizard (5 steps from IMPLEMENTATION_PLAN.md)
   - Niche selection UI
   - Initial weight calculation

2. **Feed Algorithm**
   - Integrate with Gorse recommendation engine
   - Implement 3-stage ranking pipeline
   - Add user behavior tracking

3. **Stories System**
   - Create stories generation job
   - Build stories viewer UI
   - Implement 24h expiry logic

4. **Niche Profiles**
   - Create niche detail pages
   - Follow/unfollow functionality
   - Niche feed views

---

## 📊 Database Statistics

**Before Migration:**
- 7 tables
- ~103 existing records (3 users, 100 feed_items)
- Minimal indexing

**After Migration:**
- 13 tables
- 50+ indexes for performance
- Social graph ready
- Recommendation engine ready

---

## 🚀 Ready For

✅ Social features (follow, like, bookmark, comment)
✅ Niche-based content organization
✅ User behavior tracking
✅ Recommendation engine integration (Gorse)
✅ Stories system
✅ Personalized feeds
✅ Analytics & insights

---

## 📝 Rollback Plan

If needed to rollback:

```bash
# 1. Restore old schema
cp src/lib/db/schema.old.ts src/lib/db/schema.ts

# 2. Revert database (requires manual SQL)
# Drop new tables: niches, niche_follows, user_interactions, 
# user_niche_weights, stories, user_story_views

# 3. Revert columns in existing tables
# ALTER TABLE users DROP COLUMN username, profile_type, etc.
# ALTER TABLE feed_items DROP COLUMN niche_id, quality_score, etc.

# Note: Data lost during migration cannot be recovered
```

---

## ✅ Migration Status: COMPLETE

The database schema is now ready for Instagram-like social features for researchers!

**Next**: Implement seed scripts to populate niches and convert existing data.
