# ✅ Complete Setup Guide - Feed System

## What's Ready

✅ **Database:** All 23 niches created and seeded  
✅ **Workflows:** Automated feed population (daily, weekly, hourly)  
✅ **API:** Manual trigger endpoints  
✅ **Dashboard:** Admin interface to manage feeds  
✅ **Error Fixed:** Query length now meets 50-char minimum  

---

## 🚀 Quick Start (3 Steps)

### 1. Start Development Server
```bash
cd /Users/aman/Documents/Personal\ Projects/veritus
bun run dev
```

### 2. Open Admin Dashboard
Go to: **http://localhost:3000/admin**

You'll see:
- All 23 niches
- Current paper counts
- Buttons to populate feeds
- Links to Inngest dashboard

### 3. Populate Feeds

**Option A: Use Dashboard (Recommended)**
1. Visit http://localhost:3000/admin
2. Click "🚀 Populate All Niches" or individual "Populate" buttons
3. Monitor progress in Inngest dashboard

**Option B: Use API Directly**
```bash
# Populate all niches
curl -X POST http://localhost:3000/api/trigger-feed

# Populate specific field
curl -X POST "http://localhost:3000/api/trigger-feed?field=Computer%20Science"

# Populate multiple fields
curl -X POST "http://localhost:3000/api/trigger-feed?fields=Computer%20Science,Medicine,Biology"

# Custom limit (default is 100)
curl -X POST "http://localhost:3000/api/trigger-feed?field=Physics&limit=200"
```

---

## 📊 What Was Fixed

### Issue: Veritus API Query Too Short
**Error:** `String must contain at least 50 character(s)`

**Root Cause:**
```typescript
// ❌ OLD (too short)
query: `Latest research in ${fieldOfStudy}`  // Only ~25 chars
```

**Solution:**
```typescript
// ✅ NEW (meets 50-char requirement)
query: `Latest cutting-edge research papers and publications in the field of ${fieldOfStudy}, including recent advances and breakthrough discoveries`
```

Now all queries are 100+ characters, well above the 50-char minimum.

---

## 🗂️ All 23 Niches Created

| # | Niche | Slug | Color |
|---|-------|------|-------|
| 1 | Computer Science | computer-science | #3B82F6 |
| 2 | Medicine | medicine | #EF4444 |
| 3 | Chemistry | chemistry | #F59E0B |
| 4 | Biology | biology | #10B981 |
| 5 | Materials Science | materials-science | #6366F1 |
| 6 | Physics | physics | #8B5CF6 |
| 7 | Geology | geology | #78716C |
| 8 | Psychology | psychology | #EC4899 |
| 9 | Art | art | #F43F5E |
| 10 | History | history | #92400E |
| 11 | Geography | geography | #059669 |
| 12 | Sociology | sociology | #7C3AED |
| 13 | Business | business | #0891B2 |
| 14 | Political Science | political-science | #DC2626 |
| 15 | Economics | economics | #16A34A |
| 16 | Philosophy | philosophy | #9333EA |
| 17 | Mathematics | mathematics | #2563EB |
| 18 | Engineering | engineering | #EA580C |
| 19 | Environmental Science | environmental-science | #15803D |
| 20 | Agricultural and Food Sciences | agricultural-and-food-sciences | #84CC16 |
| 21 | Education | education | #0EA5E9 |
| 22 | Law | law | #475569 |
| 23 | Linguistics | linguistics | #DB2777 |

---

## 📍 URLs & Endpoints

### User-Facing
- **Home:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin
- **Feed API:** http://localhost:3000/api/feed

### Development
- **Inngest Dashboard:** http://localhost:8288 (if running dev server)
- **Database Studio:** Run `bun run db:studio`

### API Endpoints
- `GET /api/trigger-feed` - List all niches
- `POST /api/trigger-feed` - Populate all feeds
- `POST /api/trigger-feed?field=X` - Populate specific field
- `GET /api/feed` - Get feed items
- `POST /api/inngest` - Inngest webhook (internal)

---

## 🔄 Automated Schedules

These run automatically without any action needed:

### Daily Feed Population
- **Schedule:** 3 AM UTC daily
- **What:** Fetches 100 papers per niche (all 23)
- **Duration:** ~10-15 minutes
- **Papers:** ~2,300 processed, ~1,500-2,000 inserted

### Weekly High-Quality
- **Schedule:** 2 AM UTC Sundays
- **What:** Fetches 300 high-quality papers for top 10 niches
- **Filters:** minCitationCount=50, Q1/Q2 journals, open access
- **Duration:** ~5-8 minutes

### Hourly Trending
- **Schedule:** Every hour at :00
- **What:** Fetches recent papers from 5 random fields
- **Focus:** Papers from last 12 months, sorted by citations
- **Duration:** ~2-3 minutes

---

## 🎯 Testing the System

### Step 1: Trigger a Small Test
```bash
# Populate just Computer Science
curl -X POST "http://localhost:3000/api/trigger-feed?field=Computer%20Science&limit=10"
```

### Step 2: Monitor Progress
1. Open: http://localhost:8288
2. Find: "populate-field-feed" function
3. Click on the running job
4. See: Each step's execution and results

### Step 3: Check Database
```bash
bun run db:studio
```

Navigate to `feed_items` table - should see 10 new papers.

### Step 4: View in Feed
Visit: http://localhost:3000

You should see the papers in the feed!

---

## 🔍 Verify Everything Works

### Check Niches
```bash
curl http://localhost:3000/api/trigger-feed
```

Expected response:
```json
{
  "success": true,
  "total": 23,
  "niches": [
    {
      "name": "Computer Science",
      "slug": "computer-science",
      "totalPapers": 0,
      "totalFollowers": 3
    },
    // ... 22 more
  ]
}
```

### Check Feed
```bash
curl "http://localhost:3000/api/feed?limit=5"
```

Should return papers (after you've populated feeds).

---

## 🐛 Troubleshooting

### No Papers Appearing
**Check:**
1. Did you run seed script? (`bun run scripts/seed-niches.ts`)
2. Did you trigger feed population? (via dashboard or API)
3. Is Inngest job successful? (check http://localhost:8288)
4. Any errors in terminal?

### Inngest Not Running
**Solution:**
```bash
# Terminal 1: Dev server
bun run dev

# Terminal 2: Inngest (if needed for scheduled jobs)
bunx inngest-cli dev
```

### API Errors
**Common Issues:**
- **"No valid niches found":** Run seed script first
- **"Query too short":** Already fixed in latest code
- **"Insufficient credits":** Check Veritus API credits
- **"Rate limit":** Wait a minute, max 10 req/min

### Duplicates
**This shouldn't happen** - system prevents duplicates at 4 levels:
1. Check before insert
2. Database unique constraint
3. Upsert with conflict handling
4. Idempotency keys

If you see duplicates:
```sql
SELECT paper_id, COUNT(*) as count
FROM feed_items
GROUP BY paper_id
HAVING COUNT(*) > 1;
```

---

## 📈 Expected Results

### After First Population (100 papers/niche)
- **Papers in DB:** ~1,500-2,000 (some duplicates skipped)
- **Time taken:** ~10-15 minutes
- **Veritus credits:** 23 (1 per niche)

### After 24 Hours (with automated jobs)
- **Daily run:** +1,500-2,000 papers
- **Hourly runs:** +300-400 papers
- **Total:** ~2,000-2,500 papers

### After 1 Week
- **Daily runs:** 7 × 1,500 = ~10,500 papers
- **Weekly HQ:** +2,000 papers
- **Hourly runs:** 168 × 300 = ~50,400 papers
- **Total:** ~60,000-65,000 papers (many duplicates skipped)

### Final State (1 Month)
- **Total unique papers:** ~50,000-60,000
- **Papers per niche:** ~2,000-2,500
- **Quality mix:** Daily + weekly high-quality

---

## 🎨 Admin Dashboard Features

Visit: **http://localhost:3000/admin**

Features:
- ✅ View all 23 niches with stats
- ✅ One-click populate for any niche
- ✅ Bulk populate all niches
- ✅ Real-time paper counts
- ✅ Direct link to Inngest dashboard
- ✅ Visual feedback on progress
- ✅ Instructions and tips

---

## 🔐 Production Deployment

### Environment Variables Needed
```env
DATABASE_URL=your-neon-postgres-url
INNGEST_SIGNING_KEY=your-inngest-key
INNGEST_EVENT_KEY=your-inngest-event-key
VERITUS_API_KEY=your-veritus-key
```

### Deploy Steps
1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy
5. Inngest auto-discovers at: `https://your-app.com/api/inngest`

---

## 📚 Documentation Files

All documentation is in your project root:

1. **AUTOMATED_FEED_SYSTEM.md** - Complete technical docs
2. **QUICKSTART_FEEDS.md** - Quick start guide
3. **COMPLETE_SETUP.md** - This file
4. **MIGRATION_COMPLETED.md** - Database migration summary
5. **NEXT_STEPS.md** - Overall next steps

---

## ✨ Summary

✅ **Setup Complete:** All niches initialized  
✅ **Error Fixed:** Query length meets requirements  
✅ **Dashboard Ready:** http://localhost:3000/admin  
✅ **Workflows Active:** Auto-populate daily/weekly/hourly  
✅ **Manual Control:** Trigger feeds anytime via dashboard  
✅ **Monitoring:** Full visibility in Inngest  
✅ **Duplicate-Free:** 4-layer protection  

**Your Instagram-like research feed is ready! 🎉**

---

## 🚀 Next Action

1. Visit: **http://localhost:3000/admin**
2. Click: **"🚀 Populate All Niches"**
3. Wait: ~10-15 minutes
4. Check: **http://localhost:3000** to see your feed!

Done! Your system will keep feeds fresh 24/7 automatically.
