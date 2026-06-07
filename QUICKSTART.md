# 🚀 Quick Start - Feeds for Researchers

## What was built?

An **Instagram-like feed for research papers** powered by:
- **Veritus API** - Fetches real research papers
- **Inngest** - Background jobs & scheduling
- **Neon PostgreSQL** - Database storage
- **Next.js + React** - Beautiful UI

## 🎯 To see papers in your feed, run these commands:

### 1. Test API Connection (Optional but recommended)
```bash
bun run test:api
```
This verifies your Veritus API key works and shows your credit balance.

### 2. Seed the Database
```bash
bun run seed
```
This will:
- ✅ Create 3 sample researcher users
- ✅ Fetch 100 real research papers from Veritus API
- ✅ Add likes, bookmarks, and comments
- ⚡ Takes 1-2 minutes (it polls the Veritus API)

### 3. View Your Feed
Make sure both servers are running:

**Terminal 1** (if not already running):
```bash
npx inngest-cli@latest dev
```

**Terminal 2** (if not already running):
```bash
bun run dev
```

Then visit: **http://localhost:3000** 🎉

## 📊 What You'll See

The feed displays papers with:
- 📄 **Title** in a colored gradient (based on field)
- 👥 **Authors** and journal info
- 📖 **TLDR** summary (if available)
- 📈 **Citation count** and influential citations
- 🎯 **Field tags** (Computer Science, Biology, etc.)
- ❤️ **Like** and bookmark buttons
- 💬 **Comment** section
- 🔗 **Links** to full paper and PDF

## 🔧 How It Works

```
┌─────────────┐
│   Seed      │  Creates users & preferences
│   Script    │  ↓
└─────────────┘  Calls Veritus API
                 ↓
           ┌──────────────┐
           │ Veritus API  │  Creates search job
           └──────────────┘  ↓
                 Processes papers
                 ↓
           ┌──────────────┐
           │ Neon DB      │  Stores 100 papers
           └──────────────┘  ↓
                 ↓
           ┌──────────────┐
           │ Next.js App  │  Displays feed
           └──────────────┘
```

## 🐛 Troubleshooting

### Feed is empty?
1. Run `bun run seed` to populate data
2. Check console logs for errors
3. Verify you have Veritus credits: `bun run test:api`

### Seed script fails?
- Check `.env` has correct `DATABASE_URL` and `VERITUS_API_KEY`
- Make sure database migrations ran: `bun run db:push`
- Verify you have at least 1 Veritus credit

### Errors about missing tables?
```bash
bun run db:push
```

## 🎨 Features

- ✅ Instagram-like infinite scroll feed
- ✅ Like and bookmark papers
- ✅ Comment on papers
- ✅ Beautiful gradient cards
- ✅ Field-based color coding
- ✅ Citation metrics
- ✅ Open access badges
- ✅ Q1/Q2/Q3/Q4 quartile rankings
- ✅ Direct links to papers and PDFs
- ✅ Mobile-responsive design
- ✅ Dark mode support

## 📁 Key Files

- `scripts/seed.ts` - Database seeding script
- `src/app/api/webhooks/veritus/route.ts` - Webhook handler
- `src/lib/veritus/client.ts` - Veritus API client
- `src/components/feed/FeedCard.tsx` - Instagram-style card
- `src/lib/inngest/functions.ts` - Background jobs

## 🔄 Refresh Feed

Click the **"Refresh Feed"** button in the app to fetch new papers based on user preferences!

## 📚 Documentation

- Full setup guide: `SETUP.md`
- Veritus API docs: `veritusApidocs.md`
- Database schema: `src/lib/db/schema.ts`

---

**Need help?** Check the console logs in both terminals for detailed error messages.
