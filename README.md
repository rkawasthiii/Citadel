<div align="center">

### *Research, decanted.*

The endless scroll of human knowledge — poured one paper at a time.

<br />

<img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js" />&nbsp;
<img alt="React" src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white" />&nbsp;
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white" />&nbsp;
<img alt="Postgres" src="https://img.shields.io/badge/Neon%20%2B%20pgvector-336791?style=flat-square&logo=postgresql&logoColor=white" />&nbsp;
<img alt="Inngest" src="https://img.shields.io/badge/Inngest-6366f1?style=flat-square" />&nbsp;
<img alt="Gemini" src="https://img.shields.io/badge/Gemini-4285f4?style=flat-square&logo=google&logoColor=white" />

</div>

<br />

<div align="center">

[Overview](#-overview) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [The Feed](#-populating-the-feed) · [Scripts](#-scripts) · [Structure](#-project-structure) · [Docs](#-deeper-reading)

</div>

---

## 🍷 Overview

Academic discovery has long tasted of dusty cellars and clinical search bars. **Feeds** uncorks something different — the latest research across **23 fields of study**, served in the warm, familiar glass of an Instagram-style feed.

Stories at the top. Cards you can like, bookmark, comment on, and share. And when a paper leaves you curious, an AI persona is waiting on the other side to talk it through. It is scholarship with the formality loosened and the cork already pulled.

> **Pour a glass and scroll.**

---

## ✨ Features

| | Feature | Description |
|:--:|:--|:--|
| 📜 | **Personalized Feed** | Papers as elegant cards, ranked for *you* by a recommendation engine that learns from your likes, saves, and reads. |
| 🟣 | **Scholarly Stories** | Each field of study greets you as a Story at the top of the feed — a quick aperitif before the main pour. |
| 💬 | **Talk to the Niche** | Every field has its own AI persona with a human name and voice — *Maya Chen*, your Stanford CS researcher. Grounded in real papers via vector search. |
| 🧠 | **Semantic Recall** | Abstracts embedded into 768-dim vectors (`text-embedding-004`) and stored in **pgvector** — search by *meaning*, not keywords. |
| 🤖 | **Self-Refilling Cellar** | **Inngest** workflows restock the feed daily, weekly, and hourly from the **Veritus API**, deduplicated at four levels. |
| 🎯 | **Guided Onboarding** | A first-run flow that learns your fields, interests, and career stage to season the feed from the first sip. |
| 🔎 | **Search & Profiles** | Full-text and semantic search, a personal profile of liked and bookmarked work, plus an admin dashboard. |

---

## 🌍 The Terroir — 23 Fields

A broad estate, spanning every region of the academy:

<div align="center">

`Computer Science` · `Medicine` · `Chemistry` · `Biology` · `Materials Science` · `Physics` · `Geology` · `Psychology` · `Art` · `History` · `Geography` · `Sociology` · `Business` · `Political Science` · `Economics` · `Philosophy` · `Mathematics` · `Engineering` · `Environmental Science` · `Agricultural & Food Sciences` · `Education` · `Law` · `Linguistics`

</div>

---

## 🧪 Tech Stack

| Layer | Vintage |
|:--|:--|
| **Framework** | Next.js 16 (App Router) · React 19 · TypeScript |
| **Styling** | Tailwind CSS v4 · shadcn/ui (Radix) · Framer Motion · lucide-react |
| **Database** | Neon serverless Postgres · Drizzle ORM · pgvector |
| **Auth** | Stack Auth (`@stackframe/stack`) |
| **Background Jobs** | Inngest — workflows & realtime |
| **AI** | Vercel AI SDK · Google Gemini · `text-embedding-004` |
| **Data Source** | Veritus academic paper API |
| **Client Data** | SWR · Zod |

---

## 🚀 Getting Started

### 1 · Install dependencies

```bash
bun install        # or: npm install
```

### 2 · Configure environment

Create `.env.local` in the project root:

```env
# ── Database (Neon Postgres + pgvector) ──
DATABASE_URL=your-neon-postgres-url

# ── Stack Auth ──
NEXT_PUBLIC_STACK_PROJECT_ID=your-stack-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=your-stack-publishable-key
STACK_SECRET_SERVER_KEY=your-stack-secret-key

# ── Inngest (background workflows) ──
INNGEST_SIGNING_KEY=your-inngest-signing-key
INNGEST_EVENT_KEY=your-inngest-event-key

# ── AI & Data ──
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
VERITUS_API_KEY=your-veritus-api-key
```

### 3 · Prepare the database

```bash
bun run db:push                      # apply the Drizzle schema
bun run scripts/enable-pgvector.ts   # enable pgvector
bun run scripts/seed-niches.ts       # seed the 23 fields of study
```

### 4 · Run

```bash
bun run dev
```

Open **[localhost:3000](http://localhost:3000)** and let it breathe. For background workflows, run the Inngest dev server in a second terminal:

```bash
bunx inngest-cli dev    # dashboard → http://localhost:8288
```

---

## 🔄 Populating the Feed

The feed restocks itself automatically — but you can pour a fresh round anytime.

**Admin dashboard** → visit **[/admin](http://localhost:3000/admin)** to populate any field, or all 23 at once, with one click.

**API** → trigger population directly:

```bash
curl -X POST http://localhost:3000/api/trigger-feed                            # all fields
curl -X POST "http://localhost:3000/api/trigger-feed?field=Computer%20Science" # one field
```

### Automated schedule

| Cadence | When | What it pours |
|:--|:--|:--|
| **Daily** | 3 AM UTC | ~100 papers per field, all 23 fields |
| **Weekly** | Sun · 2 AM UTC | 300 high-quality papers (Q1/Q2, 50+ citations) for the top 10 fields |
| **Hourly** | Every hour | Trending recent papers from 5 rotating fields |

> Every pour is deduplicated through a unique constraint, an existence check, conflict-aware upserts, and Inngest idempotency keys — four guards against a repeated vintage.

---

## 📜 Scripts

| Command | Description |
|:--|:--|
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to the database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run seed` | Seed sample data |
| `bun run test:api` | Exercise the API |

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── (auth)/          # sign-in & sign-up
│   ├── (main)/          # feed · niche · profile · search · dm · onboarding · admin
│   └── api/             # feed · chat · niches · search · inngest · trigger-feed
├── components/
│   ├── feed/            # FeedCard · FeedList · Stories · CommentsDrawer
│   ├── chat/            # ChatInterface · DMSidebar · MarkdownRenderer
│   ├── navigation/      # Sidebar · TopHeader · BottomNav · RightSidebar
│   └── ui/              # shadcn/ui primitives
└── lib/
    ├── ai/              # personas · embeddings · vector search
    ├── algorithm/       # the recommendation engine
    ├── inngest/         # scheduled & event-driven workflows
    ├── veritus/         # academic paper API client
    └── db/              # Drizzle schema & client
```

---

## 📚 Deeper Reading

A well-stocked library lives in the project root:

| Document | What's inside |
|:--|:--|
| `AUTOMATED_FEED_SYSTEM.md` | Architecture of the self-refilling feed |
| `DATABASE_SCHEMA_DESIGN.md` | Schema design and rationale |
| `DM_CHAT_IMPLEMENTATION_PLAN.md` | The AI persona chat system |
| `IMPLEMENTATION_PLAN.md` | Overall implementation roadmap |
| `COMPLETE_SETUP.md` · `QUICKSTART.md` | Setup guides |

---

<div align="center">
<sub>Built with curiosity — and a healthy respect for the cork. 🍷</sub>
</div>
