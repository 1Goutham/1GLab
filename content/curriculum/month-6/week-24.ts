import type { LabSeed, TopicSeed } from "../../types";

const p = (...parts: string[]) => parts.join("\n\n");

export const topics: TopicSeed[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "architecture-docs-adrs",
    title: "Architecture docs & ADRs",
    week: 24,
    domain: "product",
    skills: ["technical-writing", "ai-system-design"],
    difficulty: "medium",
    minutes: 60,
    summary: "C4-style diagrams at the right zoom level, a lean architecture doc, and Architecture Decision Records that explain why.",
    tags: ["adr", "c4-model", "architecture", "docs-as-code", "mermaid"],
    lesson: {
      hook: p(
        "Six months from now someone (probably you) opens the Cortex repo and asks: why pgvector and not Pinecone? Why a separate gateway service? Why does ingestion go through Redis Streams instead of a Vercel background function?",
        "The code shows *what* you built. It never shows *why*, what you rejected, or what would make you change your mind. That knowledge lives in your head, then in a Slack thread, then nowhere.",
        "An architecture doc plus a folder of short Architecture Decision Records fixes this for the cost of an hour. For Cortex it is also the most convincing artefact you can show an interviewer: evidence that you make decisions deliberately.",
      ),
      whyItMatters:
        "Senior engineers are judged on decisions, and decisions only compound if they are written down. ADRs and a clear architecture doc are how your reasoning survives, scales to a team, and becomes interview material.",
      levels: {
        l1: "An architecture doc is a short guide to how a system is built: the main pieces, how they talk, and where data lives, with a few diagrams. An ADR is a one-page note about a single important decision: what the situation was, what you decided, and what it will cost you. Together they let someone new understand the system and the reasons behind it.",
        l2: {
          text: p(
            "The C4 model zooms like a map app: **Context** (Cortex and the people and systems around it), **Containers** (the deployable pieces: Next.js app, FastAPI API, workers, Postgres, Redis, LLM gateway), **Components** (the modules inside one container), and **Code**. Most docs only need the first two levels; a component diagram only for the one container that is complex.",
            "ADRs are the ship's log. You never rewrite old entries; when a decision changes, you add a new ADR that supersedes the old one. The history of *why* is the value.",
          ),
          analogy: "Diagrams are the map at different zoom levels; ADRs are the log of why the roads go where they go.",
          diagram: {
            type: "stack",
            title: "C4 zoom levels for Cortex",
            layers: [
              { label: "1. System context", note: "User, Cortex, LLM providers, object storage, email" },
              { label: "2. Containers", note: "Next.js web, FastAPI API, ingestion workers, LLM gateway, Postgres+pgvector, Redis", accent: true },
              { label: "3. Components", note: "inside the API: auth, retrieval, answer pipeline, citations" },
              { label: "4. Code", note: "usually skip: the code is the diagram" },
            ],
          },
        },
        l3: {
          text: p(
            "**A lean architecture doc (4-6 pages):** purpose and scope; quality goals as measurable targets (p95 answer latency, availability SLO, cost per answer); context and container diagrams; the two or three key runtime flows (ingest a document, answer a question); data model and data lifecycle (retention, deletion); deployment view (where each container runs, environments); cross-cutting concerns (auth, observability, security, cost); risks and technical debt; and a link to the ADR index.",
            "**ADR format** (Michael Nygard's original, still the best): Title, Status (Proposed, Accepted, Superseded by ADR-NNNN), Context (forces at play, with numbers), Decision (one active sentence: \"We will...\"), Consequences (positive, negative, and what would make us revisit). Add 'Alternatives considered' if the decision was contested.",
            "**Docs as code.** Keep them in the repo (`docs/architecture.md`, `docs/adr/0001-*.md`), review them in pull requests, and write diagrams in Mermaid so they are diffable and render on GitHub.",
          ),
          code: [
            {
              title: "docs/adr/0003-use-pgvector-not-dedicated-vector-db.md",
              lang: "text",
              code: `# ADR 0003: Store embeddings in Postgres with pgvector

Date: 2026-09-20
Status: Accepted
Deciders: Goutham G

## Context
Cortex stores ~400k chunks today (40 users x ~10k chunks) and plans for ~20M.
Every retrieval query filters by user_id and often by document tags and dates.
We already run Postgres for users, documents and the cost ledger.
Target: p95 retrieval under 150 ms; one engineer operates everything.

## Decision
We will store embeddings in the chunks table using pgvector with an HNSW index,
and query with SQL filters plus vector similarity in one statement.

## Consequences
+ One database to back up, secure and monitor; transactional ingest (chunk + embedding together).
+ Metadata filters and joins are plain SQL.
- HNSW index must fit in RAM for good latency: ~20M x 1536-dim needs a large instance
  or halfvec / smaller embeddings.
- Filtered ANN search can lose recall with very selective filters; we must test recall@k.
Revisit if: p95 retrieval exceeds 300 ms at our scale, or index memory exceeds 50% of RAM.

## Alternatives considered
- Pinecone / managed vector DB: faster to scale, but a second data store to sync
  and weaker joins with our relational metadata.
- Elasticsearch / OpenSearch: strong hybrid search, but heavy to operate solo.`,
            },
            {
              title: "scripts/new-adr.sh: create the next numbered ADR from a template",
              lang: "bash",
              code: `#!/usr/bin/env bash
set -euo pipefail

title="$*"
[ -n "$title" ] || { echo "usage: new-adr.sh <title>"; exit 1; }
dir="docs/adr"
mkdir -p "$dir"

last=$(ls "$dir" | grep -Eo '^[0-9]{4}' | sort -n | tail -1 || true)
[ -n "$last" ] || last="0000"
next=$(printf "%04d" $((10#$last + 1)))
slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')
file="$dir/$next-$slug.md"

cat > "$file" <<EOF
# ADR $next: $title

Date: $(date +%F)
Status: Proposed

## Context

## Decision
We will ...

## Consequences

## Alternatives considered
EOF
echo "created $file"`,
            },
          ],
        },
        l4: {
          text: p(
            "**What makes an ADR good.** Context carries *numbers and constraints*, not opinions (\"400k chunks, p95 150 ms target, one operator\"). The decision is falsifiable: the 'revisit if' line names the measurement that would reverse it. Negative consequences are listed honestly; an ADR with only pluses is marketing.",
            "**Which decisions deserve an ADR?** Ones that are expensive to reverse or that someone will question: data stores, sync vs async boundaries, build vs buy (your own gateway vs a hosted one), auth model, hosting, the chunking strategy, the eval gate in CI. Not: which date library you picked.",
            "**Diagrams as code.** Mermaid flowcharts are enough for a container diagram. Label edges with protocol and purpose (\"REST + SSE\", \"XADD ingest\"), keep one diagram per zoom level, and make the doc's text walk through the diagram in the order a request flows.",
          ),
          code: [
            {
              title: "Container diagram for Cortex in Mermaid",
              lang: "text",
              code: `flowchart LR
  user([User browser])
  subgraph Vercel
    web[Next.js app<br/>RSC + streaming UI]
  end
  subgraph Backend
    api[FastAPI API<br/>auth, retrieval, answers]
    worker[Ingestion workers<br/>parse, chunk, embed]
    gw[LLM gateway<br/>routing, limits, cost ledger]
  end
  pg[(Postgres + pgvector)]
  redis[(Redis<br/>streams, cache, rate limits)]
  store[(Object storage<br/>original files)]
  llm[(LLM providers)]

  user -->|HTTPS| web
  web -->|REST + SSE| api
  api -->|SQL + ANN search| pg
  api -->|XADD ingest| redis
  redis -->|XREADGROUP| worker
  worker --> pg
  worker --> store
  api --> gw
  worker --> gw
  gw -->|OpenAI-compatible| llm`,
            },
          ],
        },
        l5: {
          question:
            "You join a team whose AI service has no documentation and three engineers who disagree about why things are built the way they are. What would you write first, and how would you keep it from going stale?",
          hint: "Think smallest useful artefact first, and ownership.",
          answer: p(
            "I would start with a one-page container diagram and a short list of the key runtime flows, because it is the fastest artefact that creates shared vocabulary; I would draft it from the code and deployment config and then review it with the three engineers, since disagreements usually surface exactly where the diagram is ambiguous.",
            "Next I would capture the contested decisions as ADRs, written retroactively with Status: Accepted and honest consequences, and for anything genuinely undecided write a Proposed ADR and use it to drive the discussion to a decision.",
            "To keep it alive: docs live in the repo next to the code, diagrams are Mermaid so they are diffable, PRs that change architecture must add or supersede an ADR (a line in the PR template), and each ADR has a 'revisit if' condition tied to a metric we already monitor. I would not attempt a big-bang 40-page document; nobody reads or maintains it.",
          ),
        },
      },
      commonMistakes: [
        "Writing ADRs without numbers in the context, so the decision cannot be re-evaluated when the numbers change.",
        "Editing old ADRs when a decision changes, instead of superseding them and keeping the history.",
        "One giant diagram mixing context, containers and code-level detail, which nobody can read.",
        "Documentation outside the repo (Notion, Google Docs) that drifts away from the code within weeks.",
      ],
      tryThis:
        "Paste the Mermaid diagram into a GitHub Markdown file or mermaid.live and change it to match Cortex as it really is today. Every box you hesitate over is a missing ADR.",
      miniTask: {
        title: "Write three ADRs for Cortex",
        kind: "explain",
        minutes: 40,
        steps: [
          "Add `scripts/new-adr.sh` to the Cortex repo and make it executable.",
          "List every significant decision you made in months 3-6; circle the three most expensive to reverse.",
          "Create one ADR for each with context numbers, a one-sentence decision, honest negatives and a 'revisit if' line.",
          "Add `docs/adr/README.md` with an index table (number, title, status).",
        ],
        checklist: [
          "Three ADRs exist with sequential numbers",
          "Each context section contains at least one number or hard constraint",
          "Each ADR lists at least one negative consequence",
          "Each ADR has a measurable 'revisit if' condition",
        ],
        deliverable: "A PR to the Cortex repo adding docs/adr/ with three ADRs and an index.",
      },
      quiz: [
        {
          q: "A decision recorded in ADR 0004 is reversed. What is the conventional way to record that?",
          options: [
            "Edit ADR 0004 to the new decision",
            "Delete ADR 0004",
            "Write a new ADR that supersedes 0004 and mark 0004 as 'Superseded by ADR-00NN'",
            "Add a comment in the code",
          ],
          answer: 2,
          explain: "ADRs are an immutable log. The history of why you once chose differently is part of the value.",
        },
        {
          q: "In the C4 model, which level shows the deployable units (web app, API, workers, databases)?",
          options: ["System context", "Container", "Component", "Code"],
          answer: 1,
          explain: "A C4 'container' is any separately deployable or runnable thing, including databases, not a Docker container specifically.",
        },
        {
          q: "Which is the strongest 'Context' sentence for an ADR?",
          options: [
            "Vector databases are the modern best practice",
            "We want something scalable",
            "400k chunks today, 20M planned; every query filters by user_id; p95 target 150 ms; one operator",
            "The team likes Postgres",
          ],
          answer: 2,
          explain: "Numbers and constraints make the decision reviewable and tell future readers when it stops being valid.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, what an ADR is, what goes into each section, and why you never edit an accepted one.",
      implementPrompt:
        "From memory, write an ADR for 'Use Redis Streams for ingestion jobs' with context numbers, decision, consequences and a revisit condition.",
      videos: [
        {
          title: "The C4 model for visualising software architecture (Simon Brown)",
          channel: "Simon Brown",
          url: "https://www.youtube.com/results?search_query=simon+brown+c4+model+visualising+software+architecture",
          kind: "search",
          reason: "Watch this for the C4 model from its creator, including common diagram mistakes.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "production-readiness",
    title: "Production readiness",
    week: 24,
    domain: "cloud",
    skills: ["deployment", "monitoring"],
    difficulty: "hard",
    minutes: 90,
    summary: "SLIs, SLOs and error budgets, burn-rate alerts, runbooks, tested backups, safe rollbacks, load tests and incident basics.",
    tags: ["slo", "error-budget", "runbooks", "backups", "rollbacks", "load-testing", "k6"],
    lesson: {
      hook: p(
        "It is Sunday night. Cortex's error rate is 8%. Is that bad? Compared with what? Who gets woken up, and what do they do first? When did you last check that last night's database backup actually restores?",
        "\"It works on my machine and on Vercel\" is not production readiness. Readiness is being able to answer, before anything breaks: what does 'working' mean in numbers, how will I know it stopped, what do I do then, and how do I undo the last change in under five minutes?",
        "This is the checklist that separates a portfolio demo from a product someone can depend on, and it is exactly what the month-6 flagship milestone asks for.",
      ),
      whyItMatters:
        "AI systems fail in more ways than normal web apps (provider outages, rate limits, cost spikes, silent quality regressions). SLOs, runbooks and rehearsed rollbacks turn those failures from panics into procedures.",
      levels: {
        l1: "Before calling a system production-ready, you decide in numbers what 'good enough' means (for example, 99.5% of answers succeed and most start within 2 seconds), watch those numbers, and get alerted when they are at risk. You write down what to do for the common failures, make sure backups can really be restored, can undo a bad release quickly, and have tested how much traffic the system can take.",
        l2: {
          text: p(
            "An SLO is a speed limit you set for yourself; the error budget is the number of mistakes you are allowed per month under it. While there is budget left you ship fast. When you are burning through it, you slow down and fix reliability.",
            "A runbook is the fire-drill card on the wall: when this alarm rings, do these steps. You write it calmly on a Tuesday so you don't have to think on a Sunday night.",
          ),
          analogy: "The error budget is a monthly data allowance for failure: spend it on shipping, not on surprises.",
          diagram: {
            type: "cycle",
            title: "The reliability loop",
            center: "Error budget",
            steps: [
              { label: "Define SLIs + SLOs", note: "availability, latency, TTFT" },
              { label: "Measure + alert on burn rate" },
              { label: "Respond with runbook", accent: true },
              { label: "Rollback / mitigate" },
              { label: "Blameless postmortem" },
              { label: "Fix + adjust SLO or alert" },
            ],
          },
        },
        l3: {
          text: p(
            "**SLI, SLO, SLA.** An SLI is a measurement (fraction of `/ask` requests that return 2xx in under 10 s). An SLO is the target for it over a window (99.5% over 30 days). An SLA is a contract with penalties; as a solo product you have SLOs, not SLAs. For AI endpoints, add TTFT (p95 under 2 s) as a latency SLI, and track cost per answer as a guardrail even though it is not reliability.",
            "**Error budget.** 99.9% over 30 days allows 43.2 minutes of full failure; 99.5% allows 3.6 hours. Choose the lowest target users will not notice, not the highest you can imagine. Your LLM provider's own availability caps yours unless you have a fallback.",
            "**Backups and rollbacks.** A backup you have not restored is a hope. Managed Postgres gives point-in-time recovery; test it by restoring into a scratch database monthly and running a row count. For code, Vercel and most platforms offer instant rollback to the previous deployment; the hard part is the database. Use expand-and-contract migrations (add the new column, deploy code that writes both, backfill, switch reads, remove the old column later) so any app version can be rolled back without a schema rollback.",
            "**Load testing** answers 'how much traffic before the SLO breaks, and what breaks first?'. Run it with the LLM stubbed (a fake provider that sleeps and streams canned tokens), otherwise you are load-testing OpenAI's rate limiter and paying for it.",
          ),
          code: [
            {
              title: "Error budget and burn rate arithmetic",
              lang: "python",
              code: `MIN_PER_30D = 30 * 24 * 60

for slo in (0.99, 0.995, 0.999, 0.9999):
    budget_min = (1 - slo) * MIN_PER_30D
    print(f"SLO {slo:.2%}: {budget_min:7.1f} min of full outage per 30 days")

def burn_rate(error_ratio: float, slo: float) -> float:
    return error_ratio / (1 - slo)          # 1.0 = spending budget exactly on schedule

def budget_spent(burn: float, window_hours: float, period_hours: float = 720) -> float:
    return burn * window_hours / period_hours

# Sunday night: 8% of requests failing against a 99.5% SLO
b = burn_rate(0.08, 0.995)
print(f"burn rate {b:.0f}x; one hour of this spends {budget_spent(b, 1):.0%} of the month's budget")`,
            },
            {
              title: "k6 load test with thresholds that encode the SLO",
              lang: "javascript",
              code: `import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-arrival-rate",       // fixed request rate, independent of latency
      startRate: 2, timeUnit: "1s", preAllocatedVUs: 50, maxVUs: 300,
      stages: [
        { target: 10, duration: "1m" },
        { target: 40, duration: "3m" },
        { target: 40, duration: "2m" },
        { target: 0, duration: "30s" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.005"],                        // 99.5% success
    "http_req_duration{endpoint:search}": ["p(95)<500"],
    "http_req_duration{endpoint:ask}": ["p(95)<8000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8000";
const params = (endpoint) => ({
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + (__ENV.TOKEN || "dev") },
  tags: { endpoint },
});

export default function () {
  const q = { query: "what did I write about HNSW?" };
  const res = Math.random() < 0.8
    ? http.post(BASE + "/api/search", JSON.stringify(q), params("search"))
    : http.post(BASE + "/api/ask", JSON.stringify({ question: q.query }), params("ask"));
  check(res, { "status is 200": (r) => r.status === 200 });
}`,
              note: "Run with `k6 run -e BASE_URL=https://staging.example -e TOKEN=... load.js`. k6 exits non-zero when a threshold fails, so it can gate CI.",
            },
          ],
        },
        l4: {
          text: p(
            "**Alert on burn rate, not on raw error spikes.** A static 'error rate > 1%' alert either pages for harmless blips or misses slow leaks. The Google SRE Workbook's multi-window approach pages when the budget is burning fast over a long window *and* is still burning over a short window: for a 30-day SLO, a 14.4x burn over 1 hour (2% of the budget gone) confirmed over 5 minutes pages; a 6x burn over 6 hours pages; slower burns open a ticket instead.",
            "**Runbooks** are short and executable: symptom, dashboards to open, likely causes ranked by frequency, exact commands to diagnose, mitigation (rollback, disable a feature flag, switch the gateway alias to the fallback provider), and when to escalate. Link the runbook from the alert itself.",
            "**Incident basics** for a solo developer: declare it (even to yourself, write the start time), mitigate before you diagnose (rollback first, understand later), keep a timeline, communicate on a status page if users are affected, then write a blameless postmortem: what happened, impact in numbers, why it was possible, and action items with owners. The goal is fixing the system, not the person.",
          ),
          code: [
            {
              title: "Prometheus multi-window burn-rate alert for a 99.5% availability SLO",
              lang: "yaml",
              code: `groups:
  - name: cortex-slo
    rules:
      - record: cortex:error_ratio:rate1h
        expr: |
          sum(rate(http_requests_total{job="cortex-api",code=~"5.."}[1h]))
          / sum(rate(http_requests_total{job="cortex-api"}[1h]))
      - record: cortex:error_ratio:rate5m
        expr: |
          sum(rate(http_requests_total{job="cortex-api",code=~"5.."}[5m]))
          / sum(rate(http_requests_total{job="cortex-api"}[5m]))
      - alert: CortexErrorBudgetFastBurn
        # 14.4x burn over 1h (2% of the monthly budget) and still burning over 5m
        expr: |
          cortex:error_ratio:rate1h > (14.4 * 0.005)
          and
          cortex:error_ratio:rate5m > (14.4 * 0.005)
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "Cortex API is burning its error budget 14x faster than sustainable"
          runbook_url: "https://github.com/goutham/cortex/blob/main/docs/runbooks/high-error-rate.md"`,
            },
          ],
        },
        l5: {
          question:
            "You are about to launch an AI product publicly. What does 'production ready' mean to you, concretely? Walk me through your checklist.",
          hint: "Cover: defining healthy, knowing it is unhealthy, reacting, recovering, and capacity.",
          answer: p(
            "First, define healthy: SLIs and SLOs for availability and latency of the core user journey, including time-to-first-token for AI endpoints, plus cost per answer as a guardrail. Then, knowing when it is not: dashboards for request rate, errors and duration per endpoint, LLM-specific metrics (TTFT, tokens, provider errors, cache hit rate, spend per day), structured logs with request ids, traces across API, gateway and provider, and burn-rate alerts that link to runbooks.",
            "Reacting and recovering: runbooks for the top failure modes (provider outage, rate limiting, database saturation, cost spike, bad deploy); instant rollback for code; expand-and-contract migrations so rollbacks never need a schema rollback; point-in-time backups with a restore I have actually rehearsed; feature flags to disable expensive features; and a provider fallback in the gateway.",
            "Capacity: a load test with the LLM stubbed to find the first bottleneck and the request rate where the SLO breaks, plus per-user rate limits and spend caps so a single user or a bot cannot take the system or the bill down. Finally, basic security hygiene (secrets in a manager, least-privilege keys, prompt-injection defences on tool use) and a written incident process, even if the incident team is just me.",
          ),
        },
      },
      commonMistakes: [
        "Setting a 99.99% SLO on a product that depends on an LLM provider with lower availability and no fallback.",
        "Alerting on every error spike instead of burn rate, which trains you to ignore pages.",
        "Having automated backups but never testing a restore, and discovering the gap during an incident.",
        "Load testing against the real LLM provider, measuring their rate limits and paying for the privilege.",
      ],
      tryThis:
        "Run the burn-rate script with an error ratio of 1% against a 99.5% SLO. Would that page under the 14.4x rule? How long until the monthly budget is gone?",
      miniTask: {
        title: "Write Cortex's SLOs and first runbook",
        kind: "explain",
        minutes: 40,
        steps: [
          "Pick 3 SLIs for Cortex (e.g. /ask success, /ask TTFT, /search latency) and write the exact measurement for each.",
          "Set an SLO for each over 30 days and compute the error budget in minutes or requests.",
          "Write `docs/runbooks/llm-provider-outage.md`: symptom, dashboard links, diagnosis commands, mitigation (switch gateway alias to fallback), escalation.",
          "Do a restore drill: restore last night's backup (or a pg_dump) into a scratch database and compare row counts of two tables.",
        ],
        checklist: [
          "Three SLIs with precise definitions and SLO targets",
          "Error budgets computed with arithmetic",
          "One runbook that someone else could follow without asking you",
          "A restore drill completed with row counts recorded",
        ],
        deliverable: "docs/slo.md, one runbook, and a note with the restore drill result.",
      },
      quiz: [
        {
          q: "How much full downtime does a 99.9% availability SLO allow over 30 days?",
          options: ["4.3 minutes", "43.2 minutes", "7.2 hours", "3.6 hours"],
          answer: 1,
          explain: "0.1% of 43,200 minutes is 43.2 minutes. 99.5% allows 216 minutes (3.6 hours).",
        },
        {
          q: "Why use expand-and-contract migrations?",
          options: [
            "They run faster",
            "So that both the old and new app versions work against the schema, making code rollbacks safe",
            "They avoid the need for backups",
            "Postgres requires them",
          ],
          answer: 1,
          explain: "Additive changes first, destructive changes only after the new code is proven, means you can always roll the app back without touching the schema.",
        },
        {
          q: "During an incident caused by a deploy an hour ago, what should you do first?",
          options: [
            "Find the root cause in the code",
            "Write the postmortem",
            "Mitigate: roll back the deploy, then investigate",
            "Increase the SLO",
          ],
          answer: 2,
          explain: "Mitigate before you diagnose. Rollback restores service; the root cause can be found calmly afterwards.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, what an error budget is and why burn-rate alerts are better than static error thresholds.",
      implementPrompt:
        "From memory, write a k6 script with a ramping arrival rate and thresholds for 99.5% success and p95 latency on one endpoint.",
      videos: [
        {
          title: "SLIs, SLOs and SLAs explained (Google Cloud Tech)",
          channel: "Google Cloud Tech",
          url: "https://www.youtube.com/results?search_query=google+cloud+tech+sli+slo+sla+error+budget",
          kind: "search",
          reason: "Watch this for the SRE framing of SLOs and error budgets from the people who coined it.",
        },
        {
          title: "Load testing with k6",
          channel: "Grafana",
          url: "https://www.youtube.com/results?search_query=grafana+k6+load+testing+tutorial+thresholds",
          kind: "search",
          reason: "Watch this before the load-testing lab if you have never used k6 scenarios and thresholds.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "explaining-your-system",
    title: "Explaining your system (interviews & case studies)",
    week: 24,
    domain: "product",
    skills: ["explaining", "interviewing"],
    difficulty: "medium",
    minutes: 60,
    summary: "Turn Cortex into a 2-minute walkthrough, a 20-minute deep dive and a public case study that shows judgement, not just features.",
    tags: ["interviews", "case-study", "storytelling", "portfolio"],
    lesson: {
      hook: p(
        "\"Tell me about a system you built.\" Most engineers answer with a feature list: \"It's a RAG app with Next.js, FastAPI, pgvector, Redis, it has streaming and citations...\" The interviewer nods and learns nothing about how they think.",
        "The engineers who get senior offers answer differently: a problem, a constraint, one hard decision with the alternatives they rejected, a number that proves it worked, and what broke. Same project, completely different signal.",
        "You have spent six months building Cortex. This topic turns it into the story you tell in interviews and the case study on 1goutham.space.",
      ),
      whyItMatters:
        "Your ability to explain a system is how others judge your ability to build one. A clear walkthrough and a strong case study convert six months of work into interviews and offers.",
      levels: {
        l1: "Explaining a system well means starting with the problem it solves, then showing the main parts in one simple picture, then zooming into one hard decision and why you made it. Always include numbers and what went wrong. Adjust the depth to the listener: two minutes for a recruiter, twenty for an engineer.",
        l2: {
          text: p(
            "Think of it as a documentary, not a catalogue. A catalogue lists every part. A documentary has a problem, stakes, a turning point, evidence and an ending.",
            "Your explanation should also zoom like a map: a one-sentence summary, a one-diagram overview, then one street-level deep dive. Let the listener pull you deeper; don't push every detail at once.",
          ),
          analogy: "A feature list is a parts catalogue; a good system story is a documentary with a turning point.",
          diagram: {
            type: "flow",
            title: "The walkthrough arc",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "Problem", note: "who, what pain, why now" },
                  { label: "Constraints", note: "scale, budget, latency, team of one" },
                  { label: "Architecture", note: "one diagram, one request's path" },
                  { label: "Hard decision", note: "options, trade-off, why", accent: true },
                  { label: "Evidence", note: "numbers: evals, latency, cost" },
                  { label: "What broke + next", note: "honest, specific" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**The 2-minute version** follows the arc above with one sentence each and one number per claim. Rehearse it out loud with a timer until it fits; written answers are always longer than you think when spoken.",
            "**The 20-minute deep dive** (a 'project deep dive' interview round) adds: the data model, one request's path through the system, the deep dive the interviewer chooses, and trade-offs. Prepare three deep dives in advance for Cortex: retrieval quality (chunking, hybrid search, reranking, evals), the LLM gateway (fallbacks, streaming, cost), and production (SLOs, load test result, an incident).",
            "**Use 'I' and be precise about ownership.** On a solo project that is easy; on team projects, say exactly which part was yours. Quantify: 'recall@5 went from 0.62 to 0.81 after adding a reranker' beats 'improved search a lot'.",
          ),
          code: [
            {
              title: "The 2-minute Cortex walkthrough (fill in your real numbers)",
              lang: "text",
              code: `PROBLEM      I kept losing track of what I'd read: papers, notes, docs. I built Cortex,
             a research assistant that answers questions over my own documents with citations.
CONSTRAINTS  One engineer, under USD 30/month to run, answers must be traceable to a source,
             first token in under 2 s.
ARCHITECTURE Next.js streaming UI on Vercel; FastAPI API; ingestion workers on Redis Streams
             that parse, chunk and embed into Postgres with pgvector; every LLM call goes
             through my own gateway for fallback, rate limits and cost tracking.
DECISION     Hardest call: pgvector vs a dedicated vector DB. I chose pgvector because every
             query filters by user and metadata and I wanted one store to operate; the cost is
             index memory, which I cut with half-precision vectors.
EVIDENCE     Eval set of 120 questions: faithfulness 0.__ -> 0.__ after reranking;
             p95 TTFT __ s; cost USD 0.00__ per answer; load test held __ req/s at 99.5% success.
BROKE / NEXT A PDF with 900 pages blew the embedding rate limit and stalled the queue; I added
             per-worker concurrency caps and a dead-letter stream. Next: multi-user workspaces.`,
            },
            {
              title: "Case study outline for 1goutham.space (MDX frontmatter + sections)",
              lang: "text",
              code: `---
title: "Cortex: a research assistant that cites its sources"
role: "Solo: design, backend, frontend, infra"
stack: ["Next.js", "FastAPI", "Postgres + pgvector", "Redis Streams", "LLM gateway"]
metrics: ["faithfulness 0.__", "p95 TTFT __ s", "USD 0.00__ per answer", "__ req/s at 99.5%"]
links: { demo: "", repo: "", architecture: "" }
---

1. The problem (3 sentences, with a screenshot of the answer + citations)
2. Constraints and goals (the numbers you designed for)
3. Architecture (container diagram + one request's journey)
4. Three decisions (each: options, choice, trade-off, link to the ADR)
5. Quality: how I evaluate answers (eval set, metrics, before/after)
6. Production: SLOs, dashboards, load test, one incident and what I changed
7. What I'd do differently
8. What's next`,
            },
          ],
        },
        l4: {
          text: p(
            "**What interviewers are actually scoring** in a project deep dive: scope and ownership (did you drive decisions?), technical depth (can you go two or three 'why' levels down on one component?), trade-off reasoning (do you know what you gave up?), results orientation (numbers, not adjectives), and self-awareness (what failed, what you would change). A feature list scores on none of them.",
            "**Handling the drill-down.** When asked 'why not X?', do not defend reflexively. Restate the constraint that drove your choice, acknowledge when X would be better ('at 100x the data, or with a team to operate it, I'd move to a dedicated vector store'), and name the signal that would trigger the change. That is exactly the 'revisit if' line from your ADRs, so your docs double as interview prep.",
            "**When you don't know**, say what you would do to find out: 'I haven't measured that; I'd check pg_stat_statements for the query and compare an EXPLAIN with and without the filter.' Precise uncertainty reads as seniority; bluffing is detected quickly.",
          ),
        },
        l5: {
          question: "Tell me about the most technically challenging thing you have built. Go as deep as you like.",
          hint: "Use the arc: problem, constraints, architecture in one breath, one hard decision in depth, evidence, what broke.",
          answer: p(
            "\"The most challenging was Cortex, a research assistant I built that answers questions over my own documents with citations. The constraints were a team of one, a budget under 30 dollars a month, and answers that must be traceable to a source with first token under two seconds.",
            "Architecturally it is a streaming Next.js front end, a FastAPI API, Redis Streams workers that parse, chunk and embed documents into Postgres with pgvector, and my own LLM gateway for fallback and cost tracking. The hardest problem was retrieval quality: my first version had recall@5 of about 0.6 on a 120-question eval set, and answers cited the wrong passages. I tested three chunking strategies, added hybrid BM25 plus vector search and a reranker, and got recall@5 to about 0.8, while trimming context from eight chunks to four, which also cut cost per answer by roughly 40%.",
            "In production I set SLOs on success rate and time to first token, load tested with the LLM stubbed, and found the bottleneck was the database connection pool, not the model. What I'd do differently is build the eval set on day one; I wasted weeks tuning by eyeballing answers.\" (Replace every number with your real ones: made-up metrics collapse under one follow-up question.)",
          ),
        },
      },
      commonMistakes: [
        "Answering with a stack list instead of a problem, a decision and evidence.",
        "Going deep on everything at once instead of offering one deep dive and letting the interviewer choose.",
        "Using adjectives ('much faster', 'very scalable') where a number belongs.",
        "Hiding failures; a specific failure and what you changed is one of the strongest signals you can give.",
      ],
      tryThis:
        "Record yourself giving the 2-minute walkthrough on your phone. Count the numbers you mention and the times you say 'basically'.",
      miniTask: {
        title: "Record and tighten your Cortex walkthrough",
        kind: "explain",
        minutes: 45,
        steps: [
          "Fill in the 2-minute template with your real Cortex numbers (use the ledger, eval runs and load test results).",
          "Record yourself delivering it with a timer; note where you exceeded 2 minutes or used vague words.",
          "Rewrite, cutting every sentence that has no decision or number, and record again.",
          "Write answers to three drill-down questions: 'why not a dedicated vector DB?', 'what happens when the LLM provider is down?', 'how do you know answers are good?'.",
        ],
        checklist: [
          "The final recording is under 2 minutes 15 seconds",
          "It contains at least four real numbers",
          "It includes one decision with the alternative you rejected",
          "It includes something that broke and what you changed",
          "Three drill-down answers are written, each naming a trade-off",
        ],
        deliverable: "Two recordings (first and final) and the written drill-down answers.",
      },
      quiz: [
        {
          q: "Which opening best signals senior-level thinking in a project deep dive?",
          options: [
            "Listing the full tech stack",
            "Describing the problem and the constraints that shaped the design",
            "Showing the UI",
            "Explaining which tutorials you followed",
          ],
          answer: 1,
          explain: "Constraints explain every later decision. Without them, choices look arbitrary.",
        },
        {
          q: "The interviewer asks 'Why didn't you use Kafka?'. What is the strongest response?",
          options: [
            "Kafka is overkill for everything",
            "I didn't know Kafka",
            "State the constraint (scale, one operator, Redis already present), acknowledge when Kafka would win, and name the signal that would trigger a switch",
            "Change the subject to the frontend",
          ],
          answer: 2,
          explain: "Trade-off reasoning plus a concrete revisit condition shows judgement rather than defensiveness.",
        },
        {
          q: "Why include a failure in your case study?",
          options: [
            "To appear humble",
            "It is required by portfolio sites",
            "A specific failure plus the change it caused demonstrates ownership, debugging depth and learning",
            "It makes the page longer",
          ],
          answer: 2,
          explain: "Everyone's systems break. Showing how you detected, fixed and prevented it is evidence of production experience.",
        },
      ],
      explainPrompt:
        "Explain Cortex to a non-technical friend in 5 sentences, then to a staff engineer in 5 sentences. Note what changed between the two.",
      implementPrompt:
        "From memory, write the six-part walkthrough arc and fill it in for a different project of yours (IdeaGuard, ZtudyLock or FabricNest).",
      videos: [
        {
          title: "How to talk about your projects in a system design / behavioural interview",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+how+to+present+past+project+interview",
          kind: "search",
          reason: "Watch this for more examples of how to frame past projects around decisions and trade-offs.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "load-test-your-api",
    title: "Load test Cortex, find the bottleneck, fix one thing",
    week: 24,
    duration: "90m",
    minutes: 90,
    difficulty: "hard",
    domain: "cloud",
    skills: ["monitoring", "deployment", "scalability", "sql-postgres"],
    prerequisites: ["Production readiness", "Scaling: load balancers & horizontal scale"],
    topicSlugs: ["production-readiness", "scaling-load-balancing", "databases-at-scale"],
    objective:
      "Run a realistic load test against Cortex (staging, LLM stubbed), find the first resource that saturates, change one thing, and prove the improvement with a second run.",
    expectedOutput:
      "A `loadtest/` folder with the test script, two result summaries (before and after), and a `LOADTEST.md` stating: max request rate at which SLOs held, the bottleneck with evidence, the fix, and the new numbers.",
    steps: [
      {
        title: "Stub the LLM",
        detail:
          "Add an `LLM_MODE=fake` setting to your gateway or API: a fake provider that waits 300 ms, then streams 150 canned tokens at 20 ms intervals. Embedding calls return a fixed random vector. Now the test measures your system, costs nothing and cannot trip provider rate limits.",
      },
      {
        title: "Write the scenario",
        detail:
          "Model real traffic with the starter (Locust) or the k6 script from the topic: about 70% search, 20% document list, 10% ask with streaming. Use several test users so per-user rate limits do not dominate, or raise their limits in staging.",
      },
      {
        title: "Baseline and ramp",
        detail:
          "Run a 2-minute baseline at low load and record p50/p95 and error rate per endpoint. Then ramp users in steps (10, 25, 50, 100, 200) holding each for 2 minutes. Note the step where p95 or errors breach your SLO.",
      },
      {
        title: "Find the bottleneck with evidence",
        detail:
          "While at the breaking step, check: API CPU and event-loop lag (py-spy top), DB connections in use vs pool size (`SELECT count(*) FROM pg_stat_activity`), slowest queries (`pg_stat_statements` ordered by total_exec_time), Redis latency, and whether requests queue in front of workers. Write down the first resource that saturates and the evidence.",
      },
      {
        title: "Fix one thing",
        detail:
          "Change exactly one thing: common wins are a missing index on the filter used with vector search, increasing the DB pool (or adding PgBouncer), more Uvicorn workers, caching the document list, or removing a sync call from an async route. One change, so the second run tells you what it did.",
      },
      {
        title: "Re-measure and write up",
        detail:
          "Repeat the exact same ramp. Put before/after in a table (max rate within SLO, p95 per endpoint, error rate) and write three sentences: what broke, why, and what the next bottleneck is now.",
      },
    ],
    hints: [
      "Load test from a different machine or region than the server, or your laptop's CPU becomes the bottleneck and you measure the load generator.",
      "With stream=True, Locust records time to response headers, which is close to TTFT; read the whole stream inside the task if you want total duration.",
      "A single blocking call (requests.get, a sync DB driver) inside an async FastAPI route stalls every request on that worker: it shows up as p95 climbing with low CPU.",
    ],
    stretch:
      "Add the load test to CI against a preview environment with thresholds, so a PR that regresses p95 search latency by more than 20% fails.",
    learned: [
      "How to design a load test that measures your system rather than your provider",
      "How to locate a bottleneck with evidence instead of guessing",
      "Why you change one variable at a time and re-measure",
      "Where Cortex's capacity ceiling actually is",
    ],
    starter: {
      title: "loadtest/locustfile.py",
      lang: "python",
      code: `import os
import random
from locust import HttpUser, between, task

QUESTIONS = [
    "What did I write about HNSW parameters?",
    "Summarise my notes on the CAP theorem",
    "Which paper introduced retrieval-augmented generation?",
    "How does my gateway handle provider fallbacks?",
]

class CortexUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        token = os.environ.get("CORTEX_TOKEN", "dev")
        self.client.headers.update({"Authorization": "Bearer " + token})

    @task(7)
    def search(self):
        self.client.post("/api/search", json={"query": random.choice(QUESTIONS), "k": 8}, name="search")

    @task(2)
    def documents(self):
        self.client.get("/api/documents?limit=20", name="documents")

    @task(1)
    def ask(self):
        # server must run with LLM_MODE=fake
        with self.client.post("/api/ask", json={"question": random.choice(QUESTIONS)},
                              stream=True, name="ask", catch_response=True) as r:
            chunks = sum(1 for _ in r.iter_lines())
            if r.status_code != 200 or chunks == 0:
                r.failure("status " + str(r.status_code) + ", " + str(chunks) + " lines")

# run: locust -f loadtest/locustfile.py --host https://staging.your-cortex.app
#      --users 100 --spawn-rate 5 --run-time 10m --headless --csv loadtest/before`,
    },
  },
  {
    slug: "flagship-v6-production",
    title: "Cortex v1.0: production launch",
    week: 24,
    duration: "weekend",
    minutes: 960,
    difficulty: "hard",
    domain: "cloud",
    skills: ["deployment", "monitoring", "observability", "technical-writing", "ai-system-design", "explaining"],
    prerequisites: [
      "Production readiness",
      "Architecture docs & ADRs",
      "Explaining your system (interviews & case studies)",
      "Build a small LLM gateway",
      "Load test Cortex, find the bottleneck, fix one thing",
    ],
    topicSlugs: ["production-readiness", "architecture-docs-adrs", "explaining-your-system", "design-llm-gateway", "cost-aware-ai-products"],
    objective:
      "Ship Cortex v1.0 as a real product: deployed to production with a repeatable pipeline, observable through dashboards, protected by SLOs and alerts with runbooks, documented with an architecture doc and ADRs, load tested, and presented in a public case study on 1goutham.space.",
    expectedOutput:
      "A live Cortex URL; a GitHub repo with CI/CD, `docs/architecture.md`, `docs/adr/` (at least 5 ADRs), `docs/slo.md`, `docs/runbooks/` (at least 3), `LOADTEST.md`; a dashboard screenshot; a tagged v1.0.0 release; and a published case study page on 1goutham.space linking all of it.",
    steps: [
      {
        title: "Production deploy with a pipeline",
        detail:
          "Separate staging and production environments with their own databases and secrets (in the platform's secret manager, never in the repo). CI runs lint, tests and your eval gate on every PR; merging to main deploys to staging; a tagged release promotes to production. Run DB migrations as a separate, idempotent step before the app deploy, following expand-and-contract. Add /healthz (process up) and /readyz (DB and Redis reachable).",
      },
      {
        title: "Dashboards",
        detail:
          "One dashboard, top to bottom in the order you debug: SLO status and error budget remaining; RED metrics per endpoint (rate, errors, p50/p95 duration); AI metrics from the gateway ledger (TTFT p95, tokens/min, provider error rate, cache hit rate, fallback count, spend per day and per feature); ingestion (queue depth, oldest pending message age, dead-letter count); infrastructure (DB connections, CPU, memory). Grafana, your platform's metrics, or Langfuse plus a SQL dashboard over the ledger are all fine.",
      },
      {
        title: "SLOs, alerts and runbooks",
        detail:
          "Write docs/slo.md with 3 SLIs and targets. Configure at least one burn-rate or equivalent alert that pages you (email or phone) and links to a runbook. Write runbooks for: LLM provider outage, cost spike, ingestion backlog. Add a daily spend cap in the gateway that disables non-essential AI features when exceeded.",
      },
      {
        title: "Backups and a rollback drill",
        detail:
          "Confirm point-in-time recovery or nightly dumps are enabled, then restore into a scratch database and verify row counts. Deploy a deliberately broken build to staging and time how long a rollback takes. Record both results in docs/slo.md.",
      },
      {
        title: "Architecture doc and ADRs",
        detail:
          "Write docs/architecture.md (4-6 pages): purpose, quality goals as numbers, context and container diagrams in Mermaid, the ingest and answer flows, data model and lifecycle, deployment view, cross-cutting concerns, risks. Bring the ADR folder to at least 5 records covering the vector store, the gateway, the ingestion queue, hosting, and your eval gate.",
      },
      {
        title: "Load test",
        detail:
          "Run the load-test lab against staging with the LLM stubbed, fix the first bottleneck, and include the before/after table in LOADTEST.md. State the max request rate at which SLOs held.",
      },
      {
        title: "Public case study",
        detail:
          "Write the case study for 1goutham.space using the outline from 'Explaining your system': problem, constraints, architecture diagram, three decisions linked to ADRs, quality evidence from your evals, production evidence (SLOs, dashboard, load test, one incident or drill), what you'd change, what's next. Every metric must be real. Add a 60-90 second demo video or GIF of an answer streaming with citations.",
      },
    ],
    hints: [
      "Timebox: Saturday for deploy, dashboards, SLOs and drills; Sunday for docs, load test and the case study. Docs written after a drill are better docs.",
      "If a dashboard panel has never helped you answer a question, delete it. Five useful panels beat thirty decorative ones.",
      "Write the case study for a hiring manager with 3 minutes: the first screen should show the problem, a screenshot, the diagram and four numbers.",
      "Tag the release (git tag v1.0.0) only after the rollback drill passes; you want v1.0.0 to be something you know how to undo.",
    ],
    stretch:
      "Invite five real users, run a one-week beta, and add a 'Launch week' section to the case study with real usage numbers, the north-star metric, cost per active user and one change you made from feedback.",
    learned: [
      "What it takes to move an AI project from demo to operable product",
      "How SLOs, dashboards, alerts and runbooks fit together into one reliability system",
      "How to document architecture and decisions so they survive and persuade",
      "How to present six months of engineering as a credible public case study",
    ],
    starter: {
      title: "docs/launch-checklist.md",
      lang: "text",
      code: `# Cortex v1.0 launch checklist

## Deploy
[ ] staging + production environments, separate DBs and secrets
[ ] CI: lint, tests, eval gate on every PR
[ ] migrations run as a separate step; expand-and-contract only
[ ] /healthz and /readyz endpoints wired to the platform health checks

## Observe
[ ] dashboard: SLOs, RED per endpoint, TTFT, tokens, spend/day, cache hits, fallbacks
[ ] dashboard: ingestion queue depth, oldest pending age, dead letters
[ ] structured logs with request_id propagated web -> API -> gateway

## Protect
[ ] docs/slo.md with 3 SLIs, targets, error budgets
[ ] burn-rate alert -> phone/email, links to runbook
[ ] runbooks: provider outage, cost spike, ingestion backlog
[ ] per-user rate limits and a daily spend cap in the gateway

## Recover
[ ] backup restore drill done: date ____ rows match: ____
[ ] rollback drill done: time to rollback ____ s

## Explain
[ ] docs/architecture.md with context + container diagrams
[ ] >= 5 ADRs with 'revisit if' lines
[ ] LOADTEST.md with before/after table
[ ] case study live on 1goutham.space with real numbers + demo
[ ] git tag v1.0.0`,
    },
  },
];
