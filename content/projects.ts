/**
 * Goutham's projects. Descriptions come from 1goutham.space. `skillEvidence`
 * is an initial self-assessment (0-100) of what each project actually
 * demonstrates — edit it on the project page as the projects evolve.
 */
import type { SkillId } from "./skills";

export type ProjectSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: "shipped" | "building" | "concept" | "planned";
  flagship?: boolean;
  year?: number;
  technologies: string[];
  github?: string;
  live?: string;
  architecture: string;
  features: string[];
  skillEvidence: Partial<Record<SkillId, number>>;
  learningOutcomes: string[];
  decisions: string[];
  bugs: string[];
  improvements: { title: string; why: string; skill: SkillId }[];
  milestones: { title: string; month?: number; done?: boolean }[];
};

export const PROJECTS: ProjectSeed[] = [
  {
    slug: "cortex",
    name: "Cortex",
    tagline: "Flagship — a personal AI research assistant",
    description:
      "Ingests your documents and answers with citations. Built month by month: a real backend, then an AI API, streaming, RAG, agents with evaluation, and finally production observability. The one project that proves every capability in the roadmap.",
    status: "planned",
    flagship: true,
    technologies: ["Python", "FastAPI", "PostgreSQL", "pgvector", "Redis", "Next.js", "TypeScript", "Docker", "GitHub Actions"],
    architecture:
      "Next.js UI → FastAPI API → Postgres (+pgvector) for users, documents and chunks → Redis for cache and job queue → worker for ingestion → provider-agnostic LLM layer → eval + tracing pipeline.",
    features: ["Document ingestion", "Cited answers", "Streaming", "Hybrid retrieval", "Research agent", "Eval suite in CI", "Tracing", "MCP server"],
    skillEvidence: {},
    learningOutcomes: [],
    decisions: [
      "Python + FastAPI for the AI backend so the ML ecosystem is first-class; Next.js stays the UI he already ships fast with.",
      "Postgres with pgvector instead of a separate vector DB until scale proves otherwise — one database, transactions, joins.",
    ],
    bugs: [],
    improvements: [],
    milestones: [
      { title: "Auth + database", month: 1 },
      { title: "AI API behind a provider abstraction", month: 2 },
      { title: "Streaming + structured citations", month: 3 },
      { title: "RAG with an eval set + MCP server", month: 4 },
      { title: "Research agent + evals in CI + tracing", month: 5 },
      { title: "Production: observability, deployment, design doc", month: 6 },
    ],
  },
  {
    slug: "ideaguard-ai",
    name: "IdeaGuard AI",
    tagline: "AI Product Intelligence",
    description:
      "An AI product intelligence workspace that researches, stress-tests, and turns early-stage ideas into evidence-backed product strategy.",
    status: "shipped",
    technologies: ["Next.js", "TypeScript", "LLM APIs", "Tailwind CSS", "Vercel"],
    github: "https://github.com/1Goutham/IdeaGuardAI",
    live: "https://ideaguard-ai-zeta.vercel.app/",
    architecture:
      "Next.js app → server routes orchestrating multi-step LLM calls (research, competition, feasibility, risk, MVP planning) → structured sections rendered as a strategy workspace.",
    features: ["Market research", "Competitive analysis", "Feasibility assessment", "Risk analysis", "Assumption stress testing", "MVP planning", "Experiments", "PRD & technical blueprint"],
    skillEvidence: { rag: 0, agents: 70, "llm-apis": 80, "ui-ux": 70, "ai-evaluation": 20, deployment: 40, "structured-outputs": 55, prompting: 70 },
    learningOutcomes: ["Chaining several LLM calls into one product flow", "Designing dense AI output so it stays readable"],
    decisions: ["Multi-step analysis instead of one giant prompt, so each section can be regenerated on its own."],
    bugs: [],
    improvements: [
      { title: "Ground research in real sources (RAG + citations)", why: "Market claims without sources can't be trusted — this is the gap between a demo and a tool.", skill: "rag" },
      { title: "Add an eval set for analysis quality", why: "You can't improve the prompts safely without measuring them.", skill: "ai-evaluation" },
      { title: "Trace every LLM step with cost and latency", why: "Multi-step flows get slow and expensive quietly.", skill: "observability" },
    ],
    milestones: [],
  },
  {
    slug: "ztudylock",
    name: "ZtudyLock",
    tagline: "Adaptive AI Study Workspace",
    description:
      "An AI study workspace that turns your own learning material into a personalised study system — helping you understand concepts, practise, identify weaknesses, and revise what actually needs attention.",
    status: "shipped",
    year: 2025,
    technologies: ["Next.js", "OpenAI API", "MongoDB", "Tailwind CSS", "Vercel"],
    github: "https://github.com/1Goutham/ZtudyLock",
    live: "https://ztudylock.vercel.app/",
    architecture: "Next.js app → API routes → OpenAI for tutoring, extraction and quiz generation → MongoDB for material, progress and mastery.",
    features: ["Material-aware AI tutor", "Concept extraction", "Adaptive study plans", "Quizzes & flashcards", "Weakness detection", "Revision passes", "Mastery tracking", "Exam mode"],
    skillEvidence: { "llm-apis": 75, prompting: 70, mongodb: 70, rag: 30, "ai-ux": 55, "structured-outputs": 45, nextjs: 75 },
    learningOutcomes: ["Keeping a tutor on-topic with system prompts", "Turning unstructured material into study structure"],
    decisions: ["Refuse off-topic questions and redirect instead of answering everything."],
    bugs: [],
    improvements: [
      { title: "Replace whole-document prompting with chunked retrieval", why: "Long material overflows context and costs more per question.", skill: "chunking" },
      { title: "Spaced-repetition scheduling from quiz results", why: "Mastery tracking is stronger when reviews are scheduled, not ad hoc.", skill: "data-modeling" },
    ],
    milestones: [],
  },
  {
    slug: "ideako",
    name: "Ideako",
    tagline: "AI Creative Partner",
    description:
      "An AI creative workspace that learns your voice, understands your references, and helps turn rough ideas into original social content.",
    status: "shipped",
    year: 2024,
    technologies: ["Next.js", "Gemini API", "Multi-model AI", "Tailwind CSS", "Vercel"],
    github: "https://github.com/1Goutham/Ideako",
    live: "https://ideako.vercel.app/",
    architecture: "Next.js UI → server routes → multiple model providers → voice profile and reference library feeding the generation prompt.",
    features: ["Personal voice profile", "Reference library", "AI content generation", "Post refinement", "AI insights", "Smart hashtags", "Content history", "Multi-model AI"],
    skillEvidence: { "llm-apis": 75, prompting: 75, "ui-ux": 75, embeddings: 10, "ai-ux": 60, react: 80 },
    learningOutcomes: ["Prompting for a consistent voice", "Multi-provider model calls"],
    decisions: ["Multi-model support so output quality isn't tied to one vendor."],
    bugs: [],
    improvements: [
      { title: "Retrieve references by embedding similarity", why: "A voice profile gets sharper when the most relevant past posts are retrieved, not all of them.", skill: "vector-search" },
      { title: "A/B test generations with lightweight evals", why: "Know which prompt or model actually writes better in his voice.", skill: "ai-evaluation" },
    ],
    milestones: [],
  },
  {
    slug: "fabricnest",
    name: "FabricNest",
    tagline: "Intelligent Commerce Platform",
    description:
      "A full-stack commerce platform built around discovery, personalisation, and real purchasing — a premium storefront with intelligent product discovery, recommendations, secure checkout, and progressive personalisation.",
    status: "shipped",
    year: 2024,
    technologies: ["Next.js", "TypeScript", "MongoDB", "Stripe", "Tailwind CSS"],
    github: "https://github.com/1Goutham/fabric-store",
    live: "https://aiecommerce-site.vercel.app/",
    architecture: "Next.js storefront + admin → API routes → MongoDB (products, carts, orders, users) → Stripe checkout → AI assistant for discovery.",
    features: ["Intent-based discovery", "AI shopping assistant", "Personalised recommendations", "Product search & filters", "Cart & wishlist", "Stripe checkout", "Order management", "Admin system"],
    skillEvidence: { nextjs: 80, typescript: 70, mongodb: 75, auth: 60, "api-design": 55, "data-modeling": 55, "llm-apis": 50, "web-security": 30 },
    learningOutcomes: ["End-to-end commerce flows: auth, cart, checkout, orders", "Role-based admin"],
    decisions: ["Stripe-hosted checkout to keep card data out of the app."],
    bugs: [],
    improvements: [
      { title: "Cache product listings in Redis", why: "Catalogue reads dominate traffic; the database shouldn't answer the same query every time.", skill: "caching" },
      { title: "Semantic product search", why: "Intent-based discovery is exactly what embeddings are for.", skill: "vector-search" },
      { title: "Idempotent webhook handling", why: "Payment webhooks retry; double-processing an order is a real bug class.", skill: "api-design" },
    ],
    milestones: [],
  },
  {
    slug: "webnav-ai",
    name: "WebNav AI",
    tagline: "Concept — an agent that navigates the web for you",
    description:
      "A browsing agent concept: give it a goal, it plans, clicks through real pages, extracts what matters and reports back with the path it took.",
    status: "concept",
    technologies: ["Agents", "Tool calling", "Playwright", "LLM APIs"],
    architecture: "Planner LLM → tool layer (navigate, click, read, extract) over a headless browser → memory of visited pages → final report with trace.",
    features: ["Goal-driven navigation", "Tool use", "Step trace", "Extraction"],
    skillEvidence: { agents: 25, "tool-calling": 25, "llm-apis": 40 },
    learningOutcomes: [],
    decisions: [],
    bugs: [],
    improvements: [
      { title: "Build it as the Month 4 agent lab", why: "The concept is the perfect vehicle for the agent loop, tools and guardrails topics.", skill: "agents" },
      { title: "Harden against prompt injection from web pages", why: "Every page the agent reads is untrusted input.", skill: "prompt-injection" },
    ],
    milestones: [
      { title: "Planner + 3 tools prototype", month: 4 },
      { title: "Injection defences + eval of task success", month: 5 },
    ],
  },
];
