# 🚀 Quick Start: Automated Feed System

## What Was Built

An Instagram-like automated content system that:
- ✅ Populates feeds with research papers from 23 fields automatically
- ✅ Runs on schedules (daily, weekly, hourly)
- ✅ Prevents duplicates at multiple levels
- ✅ Uses Veritus API with smart filtering
- ✅ Built with Inngest for reliable background jobs

---

## Step-by-Step Setup

### 1️⃣ Initialize All Niches (First Time Only)

```bash
cd /Users/aman/Documents/Personal\ Projects/veritus
bun run scripts/seed-niches.ts
```

**What this does:**
- Creates 23 niches (Computer Science, Medicine, etc.)
- Creates 3 sample users
- Sets up sample niche follows

**Expected output:**
```
🌱 Starting niche seeding process...

📚 Creating all 23 niches...

  ✅ Created: Computer Science (computer-science)
  ✅ Created: Medicine (medicine)
  ✅ Created: Chemistry (chemistry)
  ...

✨ Total niches: 23

👥 Creating sample users...
  ✅ Created user: Dr. Alice Johnson
  ...

📊 SEEDING SUMMARY
Total Niches Created: 23
```

### 2️⃣ Start Development Server

```bash
bun run dev
```

Server starts at: http://localhost:3000

### 3️⃣ Start Inngest Dev Server (Separate Terminal)

```bash
bunx inngest-cli dev
```

Dashboard opens at: http://localhost:8288

---

## Automated Schedules

Once running, these workflows execute automatically:

| Workflow | Schedule | Purpose | Papers/Run |
|----------|----------|---------|------------|
| **Daily Population** | 3 AM UTC daily | Fresh content for all niches | ~2,300 |
| **Weekly High-Quality** | 2 AM UTC Sundays | Premium papers for top niches | ~3,000 |
| **Hourly Trending** | Every hour | Recent trending papers | ~500 |

**No manual intervention needed!** The system runs 24/7.

---

## Manual Testing (Optional)

### Test a Single Field

```bash
# Trigger Computer Science feed population
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "niche/populate.field",
    "data": {
      "fieldOfStudy": "Computer Science",
      "nicheId": "get-from-db",
      "limit": 100,
      "priority": "manual"
    }
  }'
```

### View Results in Database

```bash
bun run db:studio
```

Navigate to: https://local.drizzle.studio

Check:
- `niches` table - should have 23 rows
- `feed_items` table - will populate as jobs run
- `feed_jobs` table - tracks all Veritus API jobs

---

## Monitoring

### Inngest Dashboard (http://localhost:8288)

You can see:
- ✅ All scheduled workflows
- ✅ Execution history
- ✅ Success/failure rates
- ✅ Step-by-step execution logs
- ✅ Retry attempts
- ✅ Event payloads

### Database Queries

**Check papers per niche:**
```sql
SELECT 
  n.name,
  COUNT(f.id) as paper_count,
  n.stats->>'totalPapers' as stat_count
FROM niches n
LEFT JOIN feed_items f ON f.niche_id = n.id
GROUP BY n.id, n.name
ORDER BY paper_count DESC;
```

**Check for duplicates (should be 0):**
```sql
SELECT paper_id, COUNT(*) as count
FROM feed_items
GROUP BY paper_id
HAVING COUNT(*) > 1;
```

**Recent additions (last 24h):**
```sql
SELECT 
  n.name as niche,
  COUNT(f.id) as new_papers
FROM feed_items f
JOIN niches n ON f.niche_id = n.id
WHERE f.created_at > NOW() - INTERVAL '24 hours'
GROUP BY n.name
ORDER BY new_papers DESC;
```

---

## How It Works

### 1. Scheduled Job Triggers
```
Every day at 3 AM UTC
  ↓
dailyNicheFeedPopulation runs
  ↓
Creates 23 events (one per field)
```

### 2. Event Processing
```
Event: niche/populate.field
  ↓
populateFieldFeed function executes
  ↓
Calls Veritus API with combinedSearch
```

### 3. Paper Insertion
```
Veritus returns ~100 papers
  ↓
Check each paper: paperExists(paperId)?
  ↓
If new → insert
If duplicate → skip
  ↓
Update niche stats
```

### 4. Duplicate Prevention

**4 layers of protection:**
1. ✅ Check before insert (`paperExists()`)
2. ✅ Database unique constraint on `paperId`
3. ✅ `onConflictDoUpdate` (upsert)
4. ✅ Idempotency keys prevent duplicate jobs

---

## Expected Results

### After First Daily Run (3 AM UTC)
- **Niches populated:** All 23
- **Papers added:** ~1,500-2,000 (some duplicates skipped)
- **Time taken:** ~10-15 minutes
- **Veritus credits used:** 23

### After One Week
- **Total papers:** ~12,000-15,000
- **Papers per niche:** ~500-650
- **Duplicates:** 0 (handled automatically)

### After One Month
- **Total papers:** ~50,000-60,000
- **Papers per niche:** ~2,000-2,500
- **Quality distribution:** Mix of daily + weekly high-quality

---

## File Structure

```
src/lib/inngest/
  ├── client.ts                 # Inngest client
  ├── functions.ts             # Original user-specific functions
  ├── niche-feeds.ts           # NEW: Automated niche population
  └── index.ts                 # Exports all functions

scripts/
  ├── seed.ts                  # Original seed (deprecated)
  └── seed-niches.ts          # NEW: Initialize all niches

docs/
  ├── AUTOMATED_FEED_SYSTEM.md # Full documentation
  └── QUICKSTART_FEEDS.md      # This file
```

---

## Troubleshooting

### Issue: Niches not created
**Solution:** Run `bun run scripts/seed-niches.ts`

### Issue: No papers appearing
**Check:**
1. Is dev server running? (`bun run dev`)
2. Is Inngest dev running? (`bunx inngest-cli dev`)
3. Wait for scheduled time (or trigger manually)
4. Check Inngest dashboard for errors

### Issue: Duplicate papers
**This should never happen!** But if it does:
1. Check database for duplicates (query above)
2. Review `paperExists()` logic
3. Check unique constraint on `feed_items.paper_id`

### Issue: Veritus API errors
**Check:**
1. Valid API key in `.env`
2. Sufficient credits (check Veritus dashboard)
3. Rate limits (10 req/min)

---

## Next Steps

### 1. Let It Run
The system is fully automated. Just keep servers running:
- `bun run dev` (Next.js app)
- `bunx inngest-cli dev` (Inngest)

### 2. Deploy to Production
```bash
# Deploy to Vercel
vercel deploy --prod

# Inngest will auto-discover at:
# https://your-domain.com/api/inngest
```

### 3. Monitor
- Check Inngest dashboard daily
- Review credit usage
- Adjust schedules if needed

### 4. Customize
Edit `src/lib/inngest/niche-feeds.ts` to:
- Change schedules
- Adjust paper limits
- Modify quality filters
- Add new fields

---

## Summary

✅ **Setup:** Run seed script once  
✅ **Operation:** Fully automated  
✅ **Monitoring:** Inngest dashboard  
✅ **Maintenance:** None required  
✅ **Duplicates:** Prevented at 4 levels  
✅ **Reliability:** Auto-retry on failures  

Your research feed is now Instagram-like with fresh content 24/7! 🎉
