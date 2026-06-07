# 🔧 Setup and Development Guide

## Prerequisites

Before running the seed script, make sure you have:

1. ✅ Neon database created and `DATABASE_URL` in `.env`
2. ✅ Veritus API key (`VERITUS_API_KEY` in `.env`)
3. ✅ Database tables created (run migrations)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Your `.env` should have:
```
DATABASE_URL=postgresql://...
VERITUS_API_KEY=sk_live_...
VERITUS_API_URL=https://discover.veritus.ai/api
```

### 3. Run Database Migrations

```bash
# Generate migration files
bun run db:generate

# Push to database
bun run db:push
```

### 4. Seed the Database

This script will:
- Create 3 sample researcher users
- Set up their research preferences
- Call the Veritus API to fetch real research papers
- Save papers to your feed
- Create sample likes and bookmarks

```bash
bun run seed
```

**Note:** This will use 1 credit from your Veritus account.

### 5. Start Development

In **separate terminals**:

```bash
# Terminal 1: Start Inngest Dev Server
npx inngest-cli@latest dev

# Terminal 2: Start Next.js
bun run dev
```

Visit `http://localhost:3000` to see your feed! 🎉

## 📡 Webhook Setup (Optional)

For production, you'll want Veritus to notify you when jobs complete:

### Using ngrok (for local development)

1. Install ngrok: `brew install ngrok`
2. Start ngrok: `ngrok http 3000`
3. Add to `.env`:
   ```
   VERITUS_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/webhooks/veritus
   ```
4. Re-run the seed script

### Using Vercel (production)

1. Deploy to Vercel
2. Add to your Vercel environment variables:
   ```
   VERITUS_CALLBACK_URL=https://your-app.vercel.app/api/webhooks/veritus
   ```

## 🔍 Troubleshooting

### No papers showing in feed?

1. Check your Veritus credits: The seed script will show your balance
2. Make sure the database has data: Run `bun run db:studio` to inspect
3. Check the console logs when running the seed script

### Seed script fails?

- Make sure your `DATABASE_URL` is correct
- Verify your Veritus API key is valid
- Check you have at least 1 credit available

### Inngest functions not running?

- Make sure `npx inngest-cli@latest dev` is running
- Check the Inngest dashboard at `http://localhost:8288`
- Verify the Inngest endpoint is accessible at `http://localhost:3000/api/inngest`

## 📝 Available Scripts

```bash
bun run dev          # Start Next.js development server
bun run seed         # Seed database with sample data
bun run db:generate  # Generate Drizzle migrations
bun run db:push      # Push schema to database
bun run db:studio    # Open Drizzle Studio (database GUI)
```

## 🎯 Next Steps

After seeding, you can:

1. **Explore the feed** at `http://localhost:3000`
2. **Like and bookmark** papers (uses temporary user ID)
3. **Refresh feed** to fetch more papers
4. **View Inngest jobs** at `http://localhost:8288`

## 🏗️ Architecture

```
User → Next.js App → Veritus API (create job)
                  ↓
            Neon Database (save job)
                  ↓
Veritus API polls → Job completes
                  ↓
Webhook → /api/webhooks/veritus
                  ↓
        Save papers to database
                  ↓
            User sees feed ✨
```

## 💡 Tips

- The seed script can be run multiple times
- Papers are deduplicated by their `paperId`
- Jobs are tracked in the `feed_jobs` table
- Check Inngest Dev Server for background job execution

## Need Help?

Check the logs:
- Next.js console for API errors
- Inngest Dev Server for job execution
- Network tab for API calls
