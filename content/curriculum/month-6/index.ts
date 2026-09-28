import type { MonthSeed } from "../../types";
import * as week21 from "./week-21";
import * as week22 from "./week-22";
import * as week23 from "./week-23";
import * as week24 from "./week-24";

export const month6: MonthSeed = {
  month: 6,
  slug: "ai-product-system-design",
  title: "Advanced AI Product + System Design",
  subtitle: "Design systems that scale, products people trust, and ship Cortex v1.0 to production.",
  levelTitle: "Advanced AI Engineer",
  domain: "systems",
  outcomes: [
    "Scale a stateless AI backend horizontally and explain load balancing, replication, partitioning and CAP trade-offs with numbers.",
    "Run a structured system design (requirements, estimates, API, data model, deep dives, trade-offs) for classic and AI-specific systems such as a chat system and an LLM gateway.",
    "Build and operate an LLM gateway with provider fallback, per-key rate limits, caching, streaming passthrough and a per-request cost ledger.",
    "Design AI interfaces that feel fast and trustworthy, and keep them fast: staged streaming, citations, graceful failure, and good Core Web Vitals under token streams.",
    "Reason about unit economics per answer and per user, choose a north-star metric, and evaluate AI changes with experiments and guardrails.",
    "Take a system to production with SLOs, burn-rate alerts, runbooks, tested backups and rollbacks, load tests, an architecture doc with ADRs, and a public case study.",
  ],
  flagshipMilestone: {
    title: "Observability + deployment + system design",
    detail:
      "Cortex, the personal AI research assistant that ingests your documents and answers with citations, becomes v1.0: a production product rather than a project. It gets a real deploy pipeline with staging and production, all LLM traffic through your own gateway with fallbacks and a cost ledger, dashboards and SLOs with alerts and runbooks, a load test that finds and fixes the first bottleneck, an architecture doc with ADRs that explains every major decision, and a public case study on 1goutham.space that turns six months of work into interview material.",
    deliverables: [
      "Production deployment with staging, CI/CD, eval gate, health checks and a rehearsed rollback",
      "LLM gateway in front of all model calls: routing, fallback, per-key limits, cache, streaming, cost ledger",
      "Dashboard covering SLOs, RED metrics, TTFT, tokens, spend, cache hits and ingestion backlog",
      "docs/slo.md with 3 SLIs and error budgets, a burn-rate alert, and 3 runbooks",
      "LOADTEST.md with before/after results and the max request rate within SLO",
      "docs/architecture.md with C4 context and container diagrams, plus at least 5 ADRs",
      "Public case study on 1goutham.space with real metrics and a demo",
    ],
  },
  weeks: [
    {
      week: 21,
      title: "Scaling foundations",
      focus: "How systems grow past one machine: load balancing, replicated and partitioned data, and asynchronous work through queues.",
      goals: [
        "Explain L4 vs L7 load balancing and choose an algorithm for long-lived LLM streams",
        "Scale Postgres in the right order: indexes, pooling, replicas with read-your-writes, partitioning, then sharding",
        "Build an idempotent, at-least-once ingestion consumer and a Redis-backed token bucket rate limiter",
      ],
      dsaPattern: "binary-search",
    },
    {
      week: 22,
      title: "System design practice",
      focus: "A repeatable design method applied to a classic system (real-time chat) and an AI system (LLM gateway), then built for real.",
      goals: [
        "Run the seven-step design method with estimates that drive decisions",
        "Write a reviewable design doc for a chat system with API, schema, diagram and trade-offs",
        "Build an LLM gateway with fallback, per-key limits, caching, streaming and cost logging",
      ],
      dsaPattern: "graphs",
    },
    {
      week: 23,
      title: "AI product engineering",
      focus: "The product layer of AI: interfaces that earn trust, pages that stay fast while tokens stream, and economics that make the product viable.",
      goals: [
        "Apply AI UX patterns (staged streaming, citations, graceful failure, undo) to one of your own products",
        "Diagnose and fix INP problems caused by token streaming, and keep client bundles small with Server Components",
        "Compute cost per answer and per user, define a north-star metric and size an A/B test",
      ],
      dsaPattern: "dynamic-programming",
    },
    {
      week: 24,
      title: "Capstone",
      focus: "Ship Cortex v1.0: production readiness, documentation of decisions, and a story you can tell in any interview.",
      goals: [
        "Define SLOs, alerts and runbooks, and rehearse a restore and a rollback",
        "Write an architecture doc and at least five ADRs for Cortex",
        "Publish the Cortex case study on 1goutham.space and rehearse a 2-minute walkthrough",
      ],
      dsaPattern: "arrays",
    },
  ],
  topics: [...week21.topics, ...week22.topics, ...week23.topics, ...week24.topics],
  labs: [...week21.labs, ...week22.labs, ...week23.labs, ...week24.labs],
};
