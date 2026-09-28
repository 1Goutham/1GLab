/**
 * The skill tree. Categories map to the progress dimensions on the Progress
 * page; groups are the branches of the visual tree; leaves are what topics,
 * labs, DSA problems and projects give evidence for.
 *
 * `baseline` is Goutham's self-reported starting point (0-100) from his
 * background — React, Next.js, Node, MongoDB, LLM APIs. It is shown as
 * "self-reported" and gets overwritten by real evidence as it accumulates.
 */
import type { Domain } from "./types";

export type SkillCategorySeed = {
  id: string;
  name: string;
  domain: Domain;
  description: string;
};

export const SKILL_CATEGORIES = [
  { id: "ai-depth", name: "AI Depth", domain: "ai", description: "How models actually learn, represent and generate." },
  { id: "ai-systems", name: "AI Systems", domain: "ai", description: "RAG, agents, MCP, evaluation and observability — AI as a system." },
  { id: "dsa", name: "DSA", domain: "dsa", description: "Patterns, problem solving and CS fundamentals." },
  { id: "advanced-dev", name: "Advanced Development", domain: "backend", description: "Backend engineering: APIs, data, caching, async, testing." },
  { id: "product-eng", name: "Product Engineering", domain: "frontend", description: "Frontend craft, AI UX and product judgement." },
  { id: "system-design", name: "System Design", domain: "systems", description: "Designing systems that scale and fail gracefully." },
  { id: "cloud-devops", name: "Cloud / DevOps", domain: "cloud", description: "Shipping, running and serving software and models." },
  { id: "security", name: "Security", domain: "security", description: "Web security and AI-specific threats." },
  { id: "communication", name: "Communication", domain: "product", description: "Explaining, writing and teaching what you know." },
] as const satisfies readonly SkillCategorySeed[];

type CategoryId = (typeof SKILL_CATEGORIES)[number]["id"];

export type SkillSeed = {
  id: string;
  name: string;
  category: CategoryId;
  /** Branch id (a group). Groups themselves have no parent. */
  parent?: string;
  group?: boolean;
  baseline?: number;
  description?: string;
};

export const SKILLS = [
  // ── AI depth ────────────────────────────────────────────────────────────
  { id: "machine-learning", name: "Machine Learning", category: "ai-depth", group: true },
  { id: "ml-foundations", name: "Learning & Loss", category: "ai-depth", parent: "machine-learning", baseline: 25 },
  { id: "regression", name: "Regression", category: "ai-depth", parent: "machine-learning", baseline: 30 },
  { id: "classification", name: "Classification", category: "ai-depth", parent: "machine-learning", baseline: 30 },
  { id: "ml-evaluation", name: "Model Evaluation", category: "ai-depth", parent: "machine-learning", baseline: 20 },

  { id: "deep-learning", name: "Deep Learning", category: "ai-depth", group: true },
  { id: "neural-networks", name: "Neural Networks", category: "ai-depth", parent: "deep-learning", baseline: 20 },
  { id: "backpropagation", name: "Backpropagation", category: "ai-depth", parent: "deep-learning", baseline: 10 },
  { id: "pytorch", name: "PyTorch", category: "ai-depth", parent: "deep-learning", baseline: 5 },

  { id: "transformers", name: "Transformers", category: "ai-depth", group: true },
  { id: "tokenisation", name: "Tokenisation", category: "ai-depth", parent: "transformers", baseline: 15 },
  { id: "embeddings", name: "Embeddings", category: "ai-depth", parent: "transformers", baseline: 20 },
  { id: "attention", name: "Attention", category: "ai-depth", parent: "transformers", baseline: 5 },
  { id: "transformer-architecture", name: "Transformer Architecture", category: "ai-depth", parent: "transformers", baseline: 5 },
  { id: "kv-cache", name: "KV Cache", category: "ai-depth", parent: "transformers", baseline: 0 },

  { id: "llm-engineering", name: "LLM Engineering", category: "ai-depth", group: true },
  { id: "prompting", name: "Prompting", category: "ai-depth", parent: "llm-engineering", baseline: 55 },
  { id: "structured-outputs", name: "Structured Outputs", category: "ai-depth", parent: "llm-engineering", baseline: 35 },
  { id: "llm-apis", name: "LLM APIs", category: "ai-depth", parent: "llm-engineering", baseline: 60 },
  { id: "inference", name: "Inference & Sampling", category: "ai-depth", parent: "llm-engineering", baseline: 10 },
  { id: "fine-tuning", name: "Fine-tuning", category: "ai-depth", parent: "llm-engineering", baseline: 0 },

  // ── AI systems ──────────────────────────────────────────────────────────
  { id: "retrieval", name: "Retrieval", category: "ai-systems", group: true },
  { id: "vector-search", name: "Vector Search", category: "ai-systems", parent: "retrieval", baseline: 10 },
  { id: "chunking", name: "Chunking", category: "ai-systems", parent: "retrieval", baseline: 10 },
  { id: "rag", name: "RAG", category: "ai-systems", parent: "retrieval", baseline: 20 },
  { id: "reranking", name: "Hybrid Search & Reranking", category: "ai-systems", parent: "retrieval", baseline: 0 },

  { id: "agentic", name: "Agents", category: "ai-systems", group: true },
  { id: "tool-calling", name: "Tool Calling", category: "ai-systems", parent: "agentic", baseline: 25 },
  { id: "agents", name: "Agent Loops", category: "ai-systems", parent: "agentic", baseline: 20 },
  { id: "mcp", name: "MCP", category: "ai-systems", parent: "agentic", baseline: 5 },
  { id: "agent-memory", name: "Planning & Memory", category: "ai-systems", parent: "agentic", baseline: 5 },

  { id: "ai-quality", name: "AI Quality", category: "ai-systems", group: true },
  { id: "ai-evaluation", name: "AI Evaluation", category: "ai-systems", parent: "ai-quality", baseline: 5 },
  { id: "observability", name: "Observability", category: "ai-systems", parent: "ai-quality", baseline: 5 },
  { id: "streaming", name: "Streaming", category: "ai-systems", parent: "ai-quality", baseline: 25 },

  // ── DSA ─────────────────────────────────────────────────────────────────
  { id: "dsa-linear", name: "Linear Structures", category: "dsa", group: true },
  { id: "arrays", name: "Arrays", category: "dsa", parent: "dsa-linear", baseline: 35 },
  { id: "strings", name: "Strings", category: "dsa", parent: "dsa-linear", baseline: 30 },
  { id: "hashing", name: "Hashing", category: "dsa", parent: "dsa-linear", baseline: 30 },
  { id: "two-pointers", name: "Two Pointers", category: "dsa", parent: "dsa-linear", baseline: 20 },
  { id: "sliding-window", name: "Sliding Window", category: "dsa", parent: "dsa-linear", baseline: 10 },
  { id: "stack", name: "Stack", category: "dsa", parent: "dsa-linear", baseline: 20 },
  { id: "queue", name: "Queue", category: "dsa", parent: "dsa-linear", baseline: 20 },
  { id: "linked-list", name: "Linked List", category: "dsa", parent: "dsa-linear", baseline: 15 },
  { id: "binary-search", name: "Binary Search", category: "dsa", parent: "dsa-linear", baseline: 20 },

  { id: "dsa-nonlinear", name: "Trees & Graphs", category: "dsa", group: true },
  { id: "trees", name: "Trees", category: "dsa", parent: "dsa-nonlinear", baseline: 10 },
  { id: "bst", name: "BST", category: "dsa", parent: "dsa-nonlinear", baseline: 10 },
  { id: "heap", name: "Heap", category: "dsa", parent: "dsa-nonlinear", baseline: 5 },
  { id: "trie", name: "Trie", category: "dsa", parent: "dsa-nonlinear", baseline: 0 },
  { id: "graphs", name: "Graphs", category: "dsa", parent: "dsa-nonlinear", baseline: 5 },
  { id: "union-find", name: "Union Find", category: "dsa", parent: "dsa-nonlinear", baseline: 0 },

  { id: "dsa-techniques", name: "Techniques", category: "dsa", group: true },
  { id: "greedy", name: "Greedy", category: "dsa", parent: "dsa-techniques", baseline: 10 },
  { id: "backtracking", name: "Backtracking", category: "dsa", parent: "dsa-techniques", baseline: 5 },
  { id: "dynamic-programming", name: "Dynamic Programming", category: "dsa", parent: "dsa-techniques", baseline: 5 },
  { id: "complexity", name: "Complexity Analysis", category: "dsa", parent: "dsa-techniques", baseline: 30 },

  // ── Advanced development ────────────────────────────────────────────────
  { id: "web-fundamentals", name: "Web Fundamentals", category: "advanced-dev", group: true },
  { id: "http", name: "HTTP & Networking", category: "advanced-dev", parent: "web-fundamentals", baseline: 45 },
  { id: "api-design", name: "API Design", category: "advanced-dev", parent: "web-fundamentals", baseline: 45 },
  { id: "auth", name: "Authentication", category: "advanced-dev", parent: "web-fundamentals", baseline: 40 },

  { id: "backend-core", name: "Backend Core", category: "advanced-dev", group: true },
  { id: "node-express", name: "Node & Express", category: "advanced-dev", parent: "backend-core", baseline: 65 },
  { id: "python", name: "Python", category: "advanced-dev", parent: "backend-core", baseline: 30 },
  { id: "fastapi", name: "FastAPI", category: "advanced-dev", parent: "backend-core", baseline: 5 },
  { id: "async-concurrency", name: "Async & Concurrency", category: "advanced-dev", parent: "backend-core", baseline: 30 },
  { id: "testing", name: "Testing", category: "advanced-dev", parent: "backend-core", baseline: 15 },

  { id: "data-layer", name: "Data Layer", category: "advanced-dev", group: true },
  { id: "sql-postgres", name: "SQL & Postgres", category: "advanced-dev", parent: "data-layer", baseline: 15 },
  { id: "mongodb", name: "MongoDB", category: "advanced-dev", parent: "data-layer", baseline: 60 },
  { id: "data-modeling", name: "Data Modeling", category: "advanced-dev", parent: "data-layer", baseline: 35 },
  { id: "caching", name: "Caching & Redis", category: "advanced-dev", parent: "data-layer", baseline: 10 },
  { id: "queues", name: "Queues & Jobs", category: "advanced-dev", parent: "data-layer", baseline: 5 },

  // ── Product engineering ─────────────────────────────────────────────────
  { id: "frontend-craft", name: "Frontend Craft", category: "product-eng", group: true },
  { id: "react", name: "React", category: "product-eng", parent: "frontend-craft", baseline: 75 },
  { id: "nextjs", name: "Next.js", category: "product-eng", parent: "frontend-craft", baseline: 70 },
  { id: "typescript", name: "TypeScript", category: "product-eng", parent: "frontend-craft", baseline: 65 },
  { id: "web-performance", name: "Web Performance", category: "product-eng", parent: "frontend-craft", baseline: 30 },

  { id: "product-thinking", name: "Product", category: "product-eng", group: true },
  { id: "ui-ux", name: "UI / UX Design", category: "product-eng", parent: "product-thinking", baseline: 70 },
  { id: "ai-ux", name: "AI UX Patterns", category: "product-eng", parent: "product-thinking", baseline: 35 },
  { id: "product-metrics", name: "Product Metrics", category: "product-eng", parent: "product-thinking", baseline: 15 },

  // ── System design ───────────────────────────────────────────────────────
  { id: "sd-core", name: "Core", category: "system-design", group: true },
  { id: "scalability", name: "Scalability", category: "system-design", parent: "sd-core", baseline: 10 },
  { id: "distributed-data", name: "Distributed Data", category: "system-design", parent: "sd-core", baseline: 5 },
  { id: "event-driven", name: "Event-driven Systems", category: "system-design", parent: "sd-core", baseline: 5 },
  { id: "sd-practice", name: "Design Practice", category: "system-design", parent: "sd-core", baseline: 5 },
  { id: "ai-system-design", name: "AI System Design", category: "system-design", parent: "sd-core", baseline: 10 },

  // ── Cloud / DevOps ──────────────────────────────────────────────────────
  { id: "shipping", name: "Shipping", category: "cloud-devops", group: true },
  { id: "git", name: "Git & GitHub", category: "cloud-devops", parent: "shipping", baseline: 65 },
  { id: "docker", name: "Docker", category: "cloud-devops", parent: "shipping", baseline: 20 },
  { id: "ci-cd", name: "CI / CD", category: "cloud-devops", parent: "shipping", baseline: 20 },
  { id: "deployment", name: "Deployment", category: "cloud-devops", parent: "shipping", baseline: 55 },

  { id: "infra", name: "Infrastructure", category: "cloud-devops", group: true },
  { id: "cloud", name: "Cloud (AWS)", category: "cloud-devops", parent: "infra", baseline: 10 },
  { id: "kubernetes", name: "Containers at Scale", category: "cloud-devops", parent: "infra", baseline: 0 },
  { id: "ai-infra", name: "AI Infrastructure", category: "cloud-devops", parent: "infra", baseline: 5 },
  { id: "monitoring", name: "Monitoring", category: "cloud-devops", parent: "infra", baseline: 10 },

  // ── Security ────────────────────────────────────────────────────────────
  { id: "sec-core", name: "Security", category: "security", group: true },
  { id: "web-security", name: "Web Security", category: "security", parent: "sec-core", baseline: 20 },
  { id: "prompt-injection", name: "Prompt Injection", category: "security", parent: "sec-core", baseline: 10 },
  { id: "ai-guardrails", name: "Guardrails & Red-teaming", category: "security", parent: "sec-core", baseline: 5 },
  { id: "secrets", name: "Secrets & Access", category: "security", parent: "sec-core", baseline: 30 },

  // ── Communication ───────────────────────────────────────────────────────
  { id: "comms", name: "Communication", category: "communication", group: true },
  { id: "explaining", name: "Explaining Concepts", category: "communication", parent: "comms", baseline: 40 },
  { id: "technical-writing", name: "Technical Writing", category: "communication", parent: "comms", baseline: 30 },
  { id: "interviewing", name: "Interview Performance", category: "communication", parent: "comms", baseline: 20 },
] as const satisfies readonly SkillSeed[];

export type SkillId = (typeof SKILLS)[number]["id"];
