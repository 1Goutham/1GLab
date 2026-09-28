import type { MonthSeed, WeekSeed } from "../../types";
import * as week01 from "./week-01";
import * as week02 from "./week-02";
import * as week03 from "./week-03";
import * as week04 from "./week-04";

const weeks: WeekSeed[] = [
  {
    week: 1,
    title: "How the web really works",
    focus: "Read real HTTP traffic fluently, understand what happens before the first byte, and reason about growth with Big-O.",
    goals: [
      "Dissect any request in DevTools or curl: method, URL, status, headers, body and timing phases",
      "Explain DNS, TCP and TLS round trips and why connection reuse matters for LLM calls",
      "State the time and space complexity of everyday loops, including hidden O(n) operations",
    ],
    dsaPattern: "arrays",
  },
  {
    week: 2,
    title: "Python for engineers",
    focus: "Translate your JavaScript instincts into idiomatic, typed, async Python with Pydantic at every boundary.",
    goals: [
      "Write idiomatic Python in a per-project virtual environment without JS-isms or mutable-default bugs",
      "Validate untrusted data (HTTP bodies, LLM outputs, files) with Pydantic v2 models",
      "Run I/O concurrently with asyncio.gather and a semaphore without ever blocking the event loop",
    ],
    dsaPattern: "hashing",
  },
  {
    week: 3,
    title: "APIs & data",
    focus: "Build production-shaped FastAPI services on Postgres with API contracts that survive real clients.",
    goals: [
      "Ship a FastAPI service with input/output models, dependencies, lifespan and correct status codes",
      "Design endpoints with consistent errors, cursor pagination and idempotency for unsafe operations",
      "Model relational data in Postgres and prove index choices with EXPLAIN ANALYZE",
    ],
    dsaPattern: "two-pointers",
  },
  {
    week: 4,
    title: "Caching, auth & tests",
    focus: "Make the backend fast, secure and safe to change, then assemble Cortex v0.1.",
    goals: [
      "Put Redis cache-aside in front of slow calls and measure the latency win with percentiles",
      "Implement Argon2 password hashing, revocable sessions and JWT bearer auth, and explain the trade-offs",
      "Cover an API with isolated pytest tests using fixtures and dependency overrides",
    ],
    dsaPattern: "stack",
  },
];

export const month1: MonthSeed = {
  month: 1,
  slug: "engineering-foundations",
  title: "Engineering Foundations",
  subtitle: "From Next.js developer to backend engineer: HTTP, Python, FastAPI, Postgres, Redis, auth and tests.",
  levelTitle: "Foundations Engineer",
  domain: "backend",
  outcomes: [
    "Debug any web or LLM API call from raw HTTP: status codes, headers, caching and connection timing",
    "Write typed, idiomatic async Python and validate every external input with Pydantic",
    "Build and test a FastAPI + Postgres CRUD service with correct status codes, cursor pagination and indexed queries",
    "Cut latency and cost with Redis cache-aside, and defend your key, TTL and stampede choices",
    "Implement secure authentication (Argon2id, HttpOnly session cookies, JWT) and explain sessions vs tokens in an interview",
    "Ship Cortex v0.1: a documented, tested backend with users, auth and a multi-tenant documents table",
  ],
  flagshipMilestone: {
    title: "Auth + database",
    detail:
      "Cortex, your personal AI research assistant that ingests your documents and answers with citations, starts here as a real backend. Month 1 lays the foundation every later feature stands on: a FastAPI service on Postgres with users, authentication and a documents table where every query is scoped to its owner. No AI yet, on purpose: ingestion, embeddings and cited answers in later months plug into this skeleton instead of forcing a rewrite.",
    deliverables: [
      "FastAPI app with config, db, auth and routes separated, running locally without Docker",
      "Postgres schema via SQL migrations: users, sessions and documents (owner FK, content hash, status, jsonb metadata, indexes)",
      "Register, login, logout and /v1/me with Argon2id hashing, HttpOnly session cookie and bearer JWT support",
      "Documents CRUD with cursor pagination, duplicate detection and strict per-user isolation",
      "pytest suite (12+ tests) including a cross-user isolation test",
      "README with setup, architecture, endpoint table and roadmap",
    ],
  },
  weeks,
  topics: [...week01.topics, ...week02.topics, ...week03.topics, ...week04.topics],
  labs: [...week01.labs, ...week02.labs, ...week03.labs, ...week04.labs],
};
