# Automated Feed Population System

## Overview

This system automatically populates research paper feeds for all 23 fields of study using Inngest workflows and the Veritus API. Papers are fetched, deduplicated, and assigned to their appropriate niches on automated schedules.

---

## Architecture

### Components

1. **Inngest Workflows** (`src/lib/inngest/niche-feeds.ts`)
   - Scheduled cron jobs
   - Event-driven feed population
   - Automatic retries and error handling
   - Idempotency guarantees

2. **Database Schema**
   - 23 niches (one per field of study)
   - Feed items with niche relationships
   - Duplicate prevention via unique constraints

3. **Veritus API Integration**
   - Combined search (phrases + query)
   - Field-specific filtering
   - Citation-based ranking
   - Quality filters (Q1/Q2 journals)

---

## Scheduled Workflows

### 1. Daily Feed Population
**Schedule:** Every day at 3 AM UTC  
**Purpose:** Maintain fresh content across all niches  
**Details:**
- Fetches 100 papers per field of study
- Uses combined search with field-specific phrases
- Sorts by citation count (descending)
- Fan-out pattern: triggers 23 separate jobs

```typescript
// Runs: 0 3 * * * (3 AM UTC daily)
dailyNicheFeedPopulation
```

**Flow:**
```
3 AM UTC
  ↓
Create/verify all 23 niches
  ↓
Trigger "niche/populate.field" events (23x)
  ↓
Each event → Veritus API job
  ↓
Poll for completion
  ↓
Insert papers (skip duplicates)
  ↓
Update niche stats
```

### 2. Weekly High-Quality Refresh
**Schedule:** Every Sunday at 2 AM UTC  
**Purpose:** Populate top niches with premium research  
**Details:**
- Targets top 10 most-followed niches
- Fetches 300 papers per niche
- Filters: minCitationCount=50, Q1/Q2 journals, open access
- Higher quality threshold

```typescript
// Runs: 0 2 * * 0 (2 AM UTC on Sundays)
weeklyHighQualityRefresh
```

**Flow:**
```
Sunday 2 AM UTC
  ↓
Query top 10 niches by follower count
  ↓
Trigger high-quality jobs
  ↓
Veritus API with strict filters
  ↓
Insert high-quality papers
```

### 3. Hourly Trending Refresh
**Schedule:** Every hour at :00  
**Purpose:** Keep trending content fresh  
**Details:**
- Selects 5 random fields each hour
- Fetches recent papers (last 12 months)
- Sorts by citation count
- Focuses on trending research

```typescript
// Runs: 0 * * * * (every hour)
hourlyTrendingRefresh
```

**Flow:**
```
Every hour
  ↓
Select 5 random fields
  ↓
Fetch recent papers (2024-2025)
  ↓
Sort by citations
  ↓
Insert trending content
```

---

## Event-Driven Workflow

### Populate Field Feed
**Event:** `niche/populate.field`  
**Purpose:** Worker that fetches and inserts papers  
**Idempotency:** Uses `fieldOfStudy + priority` as idempotency key

```typescript
{
  name: "niche/populate.field",
  data: {
    fieldOfStudy: "Computer Science",
    nicheId: "uuid-here",
    limit: 100,
    priority: "daily" | "high-quality" | "trending",
    filters: {
      minCitationCount?: number,
      quartileRanking?: string[],
      openAccessPdf?: boolean,
      year?: string,
      sort?: string
    }
  }
}
```

**Process:**
1. Create Veritus combinedSearch job
2. Poll for completion (exponential backoff)
3. Check each paper for duplicates
4. Insert new papers only
5. Update niche statistics

---

## Duplicate Prevention

### Strategy 1: Database-Level
```typescript
// Unique constraint on paperId
export const feedItems = pgTable("feed_items", {
  paperId: text("paper_id").notNull().unique(),
  // ...
});
```

### Strategy 2: Application-Level
```typescript
async function paperExists(paperId: string): Promise<boolean> {
  const existing = await db.query.feedItems.findFirst({
    where: eq(feedItems.paperId, paperId),
    columns: { id: true },
  });
  return !!existing;
}
```

### Strategy 3: Upsert with Conflict Handling
```typescript
await db
  .insert(feedItems)
  .values(paperData)
  .onConflictDoUpdate({
    target: feedItems.paperId,
    set: {
      citationCount: paperData.citationCount,
      updatedAt: new Date(),
    },
  });
```

### Strategy 4: Idempotency Keys
```typescript
// Prevents duplicate jobs within 30 minutes
{
  idempotency: "event.data.fieldOfStudy + event.data.priority"
}
```

---

## All 23 Fields of Study

| Field | Avatar Color | Category | Phrases |
|-------|--------------|----------|---------|
| Computer Science | #3B82F6 | Technology | machine learning, AI, algorithms |
| Medicine | #EF4444 | Health Sciences | clinical trials, healthcare |
| Chemistry | #F59E0B | Physical Sciences | reactions, synthesis |
| Biology | #10B981 | Life Sciences | genetics, cells |
| Materials Science | #6366F1 | Engineering | nanomaterials, composites |
| Physics | #8B5CF6 | Physical Sciences | quantum, particles |
| Geology | #78716C | Earth Sciences | earth, minerals |
| Psychology | #EC4899 | Social Sciences | cognition, behavior |
| Art | #F43F5E | Arts & Humanities | visual arts, culture |
| History | #92400E | Arts & Humanities | events, civilization |
| Geography | #059669 | Earth Sciences | spatial, maps |
| Sociology | #7C3AED | Social Sciences | society, groups |
| Business | #0891B2 | Business & Economics | strategy, management |
| Political Science | #DC2626 | Social Sciences | politics, governance |
| Economics | #16A34A | Business & Economics | markets, finance |
| Philosophy | #9333EA | Arts & Humanities | ethics, logic |
| Mathematics | #2563EB | Physical Sciences | algebra, statistics |
| Engineering | #EA580C | Engineering | design, systems |
| Environmental Science | #15803D | Earth Sciences | climate, sustainability |
| Agricultural and Food Sciences | #84CC16 | Life Sciences | agriculture, crops |
| Education | #0EA5E9 | Social Sciences | learning, pedagogy |
| Law | #475569 | Law & Politics | legal theory, justice |
| Linguistics | #DB2777 | Arts & Humanities | language, syntax |

---

## Setup Instructions

### 1. Seed All Niches
```bash
cd /Users/aman/Documents/Personal\ Projects/veritus
bun run scripts/seed-niches.ts
```

This will:
- Create all 23 niches
- Create 3 sample users
- Set up niche follows

### 2. Start Development Server
```bash
bun run dev
```

### 3. Access Inngest Dev Server
```bash
# In a separate terminal
bunx inngest-cli dev
```

Navigate to: http://localhost:8288

### 4. Manually Trigger a Workflow (Optional)
```bash
# Trigger feed population for a specific field
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "niche/populate.field",
    "data": {
      "fieldOfStudy": "Computer Science",
      "nicheId": "your-niche-id",
      "limit": 100,
      "priority": "manual"
    }
  }'
```

---

## Monitoring & Debugging

### Check Workflow Status
Visit Inngest dashboard: http://localhost:8288 (dev) or https://app.inngest.com (prod)

### View Function Runs
- See execution history
- Check step outputs
- View errors and retries
- Inspect event payloads

### Database Queries

**Check niche stats:**
```sql
SELECT slug, name, stats->>'totalPapers' as total_papers
FROM niches
ORDER BY (stats->>'totalPapers')::int DESC;
```

**Check for duplicates:**
```sql
SELECT paper_id, COUNT(*) as count
FROM feed_items
GROUP BY paper_id
HAVING COUNT(*) > 1;
```

**Check recent additions:**
```sql
SELECT n.name as niche, COUNT(f.id) as papers
FROM feed_items f
JOIN niches n ON f.niche_id = n.id
WHERE f.created_at > NOW() - INTERVAL '24 hours'
GROUP BY n.name
ORDER BY papers DESC;
```

---

## Error Handling

### Automatic Retries
All workflows have automatic retry logic:
- **Daily/Weekly/Hourly:** 3 retries with exponential backoff
- **populateFieldFeed:** 3 retries with exponential backoff
- **Veritus API polling:** 30 attempts with 2s → 30s backoff

### Common Issues

**Issue:** Veritus job timeout
**Solution:** Increase `maxAttempts` in polling logic

**Issue:** Rate limit exceeded
**Solution:** Add delay between job creations (implemented in fan-out)

**Issue:** Duplicate papers
**Solution:** Already handled via `paperExists()` check + DB constraints

**Issue:** Failed niche creation
**Solution:** Workflow continues, logs error, retries on next run

---

## Performance Metrics

### Daily Population
- **Duration:** ~10-15 minutes
- **Papers Processed:** ~2,300 (100 per field × 23)
- **Actual Inserts:** ~1,500-2,000 (after deduplication)
- **Veritus API Calls:** 23 jobs
- **Credits Used:** 23 credits (100 papers/job)

### Weekly High-Quality
- **Duration:** ~5-8 minutes
- **Papers Processed:** ~3,000 (300 per top 10 niches)
- **Actual Inserts:** ~2,000-2,500
- **Credits Used:** 30 credits (3 per 300-paper job)

### Hourly Trending
- **Duration:** ~2-3 minutes
- **Papers Processed:** ~500 (100 × 5 fields)
- **Actual Inserts:** ~300-400
- **Credits Used:** 5 credits

### Total Monthly
- **Daily:** 23 credits/day × 30 = 690 credits
- **Weekly:** 30 credits/week × 4 = 120 credits
- **Hourly:** 5 credits/hour × 24 × 30 = 3,600 credits
- **TOTAL:** ~4,410 credits/month

---

## Advanced Configuration

### Adjust Schedule
Edit `src/lib/inngest/niche-feeds.ts`:

```typescript
// Change from daily to every 12 hours
{ cron: "0 */12 * * *" }

// Change timezone
{ cron: "TZ=America/New_York 0 9 * * *" }
```

### Adjust Limits
```typescript
// Fetch more papers daily
limit: 200  // default: 100

// Stricter quality filters
filters: {
  minCitationCount: 100,  // default: none
  quartileRanking: ["Q1"],  // default: all
}
```

### Add New Fields
Edit `ALL_FIELDS_OF_STUDY` array and `FIELD_CONFIG` object.

---

## Production Deployment

### Environment Variables
```env
DATABASE_URL=your-neon-postgres-url
INNGEST_SIGNING_KEY=your-inngest-signing-key
INNGEST_EVENT_KEY=your-inngest-event-key
VERITUS_API_KEY=your-veritus-api-key
```

### Deploy to Vercel
```bash
vercel deploy --prod
```

### Register Inngest Functions
Inngest will automatically discover functions at:
```
https://your-domain.com/api/inngest
```

### Monitor in Production
- Inngest Dashboard: https://app.inngest.com
- Set up alerts for failed workflows
- Monitor credit usage

---

## Summary

✅ **Automated:** No manual intervention required  
✅ **Intelligent:** Smart scheduling (daily/weekly/hourly)  
✅ **Reliable:** Automatic retries, idempotency, duplicate prevention  
✅ **Scalable:** Handles 23 fields × multiple schedules  
✅ **Observable:** Full visibility in Inngest dashboard  
✅ **Cost-Effective:** ~4,400 credits/month for comprehensive coverage

Your research paper feed will stay fresh with the latest papers from all 23 fields of study!
