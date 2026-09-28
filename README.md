# 1G · AI Engineering OS

Goutham's personal operating system for becoming an advanced AI engineer in six months.

Not an LMS and not a dashboard. Every screen serves one loop:

```
OPEN APP → TODAY'S MISSION → LEARN → DO THE MINI TASK → COMPLETE → REFLECT
        → PROGRESS UPDATES → MENTOR RECOMMENDS NEXT → RETURN TOMORROW
```

## What's inside

| Area | What it does |
| --- | --- |
| **Home — Today's Mission** | Four missions built fresh every day: a DSA rep, the day's concept, a build, and review or reflection. Adapts to energy (low / normal / high), daily time budget, review backlog and watch-vs-build habits. Plus one evidence-backed insight ("You've learned RAG but haven't built retrieval evaluation yet"). |
| **Roadmap** | Six months, 24 weeks, drawn as one track that fills in as you go. Each month unlocks a level and a capability in the flagship project, **Cortex**. |
| **Learn** | 74 topics. Each opens progressively: *Why* → L1 explain simply → L2 mental model + diagram → L3 technical + runnable code → L4 under the hood → L5 interview question. Every topic ends in a **mini task** with a confirm-before-it-counts checklist, then a reflection. |
| **Labs** | 36 labs from 20 minutes to a weekend: objective, expected output, steps, hints, stretch goal and what you learned. Six are flagship milestones. |
| **DSA** | 118 real LeetCode problems across 18 patterns. It logs time vs estimate, hints, whether you viewed the solution, confidence and mistake type, then builds a weakness map and recommends problems *with a reason*. |
| **Review** | Spaced repetition as a ladder: day 3 quiz → day 7 explain it back → day 14 implement from memory → day 30 interview question. Failed DSA attempts come back as cold re-solves. |
| **Journal** | Seven questions a day with autosave. The mentor reads them for recurring patterns. |
| **Progress** | Every skill is scored on six dimensions: knowledge, implementation, projects, problem solving, explanation and retention. Includes an animated skill tree, an engineering map, activity, strengths and weaknesses, and "what to do next". A **career readiness** page links every band to its evidence. |
| **Projects** | FabricNest, ZtudyLock, Ideako, IdeaGuard AI, WebNav AI and Cortex. Each shows the skills it actually demonstrates, plus recommended improvements, bugs, decisions and milestones. |
| **AI Mentor** | Seven modes: Explain, Socratic, Interview, Debug, Review, Challenge and Career. It starts simple, tests you, and raises the difficulty when you pass. Replies stream and conversations persist. It knows your curriculum, scores, DSA history, mistakes, journal and projects. |
| **Tasks & Plan** | Tasks carry priority, time, skill, difficulty, deadline and an energy cost, so a bad day still moves you forward. **Plan my week** builds a realistic plan at ~85% of your time; the AI refines it when a key is set. |
| **Focus mode** | Full-screen countdown and mission, then *what did you learn / what went wrong / confidence*, which feeds progress and the journal. |
| **Weekly review · Level up** | Sunday review: concepts, problems, labs, deep work, weakest area, most improved, what you've forgotten, and next week's focus. Month-end level-up screen. |
| **Showcase** | "Here's what I can build": a public or private page with projects, shipped labs and evidence-backed skills. Never shows the journal. |
| **⌘K** | Command palette with global search across lessons, problems, labs, projects, notes, journal, tasks and videos. `g h`, `g d`, `g l`… navigation; `?` lists the shortcuts. |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), React 19, TypeScript
- **PostgreSQL + Drizzle ORM** (`postgres-js`), Zod validation everywhere
- **Tailwind CSS 4**, Motion, cmdk, lucide
- **AI**: provider abstraction in `lib/ai` covering Anthropic (official SDK), OpenAI and Gemini (REST streaming), plus an offline mentor

## Getting started

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL at minimum
npm run db:push                # create tables
npm run db:seed                # curriculum, DSA bank, projects, your profile
npm run dev                    # http://localhost:3000
```

`npm run db:setup` does push + seed in one step. Re-run `npm run db:seed` whenever `content/` changes. It upserts lessons in place and never touches your progress. `npm run db:reset` wipes learner progress and reseeds.

No local Postgres? Any hosted Postgres works (Neon has a free tier). With Docker:

```bash
docker run -d --name aios-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aios -p 5432:5432 postgres:16
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (engine unit tests).

On first launch you'll see a short onboarding screen, prefilled with what the OS already knows about you. Confirm it, and week 1 is generated.

## AI providers

The app is never built around one vendor. Set any one key in `.env.local`:

| Provider | Key | Default model | Override |
| --- | --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-opus-5` | `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` |
| OpenAI | `OPENAI_API_KEY` | `gpt-5-mini` | `OPENAI_MODEL`, `OPENAI_BASE_URL` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` | `GEMINI_MODEL` |

Use `AI_PROVIDER=anthropic|openai|gemini|offline` to choose explicitly; otherwise the first key found wins. With **no key**, everything still works:

- The mentor answers from the curriculum. It gives layered explanations, asks quiz questions and grades them, and falls back to DSA challenges and debugging checklists.
- Week planning, journal insights and review grading fall back to the deterministic engine.

All model calls go through `lib/ai/*` on the server, behind authentication and a per-user rate limit. Keys never reach the client.

## YouTube

Each topic ships with curated resources, and each one says *why* you'd watch it. Where a precise video isn't pinned, the resource is a targeted search on a trusted channel. Set `YOUTUBE_API_KEY` to resolve those searches into concrete embeddable videos, cached in the database. Your feedback (watched, useful, not useful) re-ranks recommendations, and channels you found useful rise across topics.

## Deploying to Vercel

1. **Database.** Create a Postgres database (Neon via the Vercel Marketplace is simplest) and copy the *pooled* connection string.
2. **Schema and seed happen automatically.** Vercel runs `npm run vercel-build`, which creates or updates the tables, seeds the curriculum (idempotent: your progress is never touched), then builds. `DATABASE_URL` just has to be set before deploying.
3. **Import the repo** in Vercel and set these environment variables:
   - `DATABASE_URL`
   - `OWNER_EMAIL`
   - `OWNER_PASSWORD`
   - `AUTH_SECRET` (`openssl rand -base64 48`)
   - optionally, one AI key and `YOUTUBE_API_KEY`
4. **Deploy.** Every route renders per request; the mentor route streams, with a 60s max duration.

`OWNER_PASSWORD` and `AUTH_SECRET` are required in production. Without them, sign-in shows a configuration message rather than opening the app.

## Architecture

```
app/
  (os)/            the authenticated shell: Home, Learn, Labs, DSA, Review, Journal, Progress, Projects, Mentor, Tasks…
  focus/           full-screen focus mode (outside the shell)
  showcase/        public/private portfolio view
  api/mentor       streaming mentor (text/plain stream)
  api/ai           plan-week · journal-insight · grade-review
  api/search       global search
content/           the curriculum as typed data (never imported by UI)
  curriculum/      month-1 … month-6: topics (5 levels + mini task + quiz + videos) and labs
  skills.ts        skill tree + self-reported baselines
  dsa.ts           problem bank and patterns
lib/
  engine/          pure, tested logic: mission, SRS, DSA recommender, skill scoring, insights, planner, weekly review
  data/            request-scoped state loader + derived views; side effects (snapshots, milestones)
  actions/         server actions (auth + Zod on every mutation)
  ai/              provider.ts, providers/*, mentor.ts, context.ts, offline.ts, recommendations.ts, summarisation.ts, evaluation.ts, quiz.ts, youtube.ts, rate-limit.ts
  db/              Drizzle schema + client
proxy.ts           optimistic auth redirect + security headers (verification happens server-side)
```

**Content is data.** Lessons, labs, problems and videos live in Postgres, seeded from `content/`. To add or edit a topic, change the typed files (see `content/AUTHORING.md` for the voice and rules) and re-seed. Topics and labs have a `status` column (`draft | published | archived`) for archiving without deletion.

**Progress is evidence.** Nothing stores a "percent complete". Scores are recomputed from topic levels, mini tasks, labs, DSA attempts, reviews and project evidence, and snapshotted daily so growth can be charted.

## Security

- Single-owner auth: an HS256-signed, httpOnly, `SameSite=Lax` session cookie. Every page, action and route handler verifies it server-side.
- Zod validation on every server action and API body. All queries are scoped to the owner.
- Rate limits on sign-in and every AI endpoint.
- Markdown is rendered without raw HTML and with a restricted URL allow-list.
- Security headers are set in `proxy.ts`.
- Secrets are read only on the server.

Built for one person, for six months: *I can actually build things I couldn't build six months ago.*
