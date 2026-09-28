import type { MonthSeed } from "../../types";
import * as w13 from "./week-13";
import * as w14 from "./week-14";
import * as w15 from "./week-15";
import * as w16 from "./week-16";

export const month4: MonthSeed = {
  month: 4,
  slug: "rag-agents-mcp",
  title: "RAG + Agents + MCP",
  subtitle: "Make models answer from your data with citations, act through tools, and plug into any AI host.",
  levelTitle: "Retrieval & Agents Engineer",
  domain: "ai",
  outcomes: [
    "Store and query embeddings in Postgres with pgvector, and choose and tune HNSW or IVFFlat indexes with a clear view of the recall/latency trade-off",
    "Build a production-shaped RAG pipeline: structure-aware chunking, hybrid BM25 + vector retrieval with reciprocal rank fusion, cross-encoder reranking and answers with verified citations",
    "Measure retrieval with a golden set, recall@k and MRR, and make chunking and search decisions from numbers rather than vibes",
    "Write an agent loop from scratch with tool calling, planning, memory, parallel calls and step/budget guards, and explain every decision it makes",
    "Design and ship MCP servers with the official SDK and connect them to Claude Desktop and Claude Code",
    "Guard agents against prompt injection and runaway behaviour with least privilege, validation, approvals and red-team evals",
  ],
  flagshipMilestone: {
    title: "RAG",
    detail:
      "Cortex, your personal AI research assistant, learns to read. Documents are ingested into Postgres, chunked with page and heading metadata, embedded into pgvector, retrieved with hybrid search plus reranking, and answered with citations you can click and verify. A retrieval eval set keeps quality honest in CI, and Cortex is exposed as an MCP server so Claude Desktop and Claude Code can search and query your library directly.",
    deliverables: [
      "Idempotent ingestion for PDF and markdown into Postgres + pgvector (page and heading metadata, sha256 dedupe)",
      "Hybrid retrieval: vector + full-text search fused with RRF, then cross-encoder reranking",
      "POST /ask API returning answers with [n] citations, a citation check and an \"I don't know\" path",
      "Retrieval eval: 40+ question golden set, recall@k and MRR for three configs in EVAL.md, run in GitHub Actions",
      "Cortex MCP server (search_documents, ask_cortex, add_document) used from Claude Desktop or Claude Code",
      "Tagged v0.4 release with README, architecture diagram and a 2-minute demo",
    ],
  },
  weeks: [
    {
      week: 13,
      title: "Retrieval",
      focus: "Embeddings in Postgres: pgvector, ANN indexes, chunking and semantic search from scratch.",
      goals: [
        "Run pgvector locally, store embeddings next to relational data, and prove with EXPLAIN that queries use an HNSW index",
        "Implement and compare fixed, recursive and token-based chunkers on a real document",
        "Build a numpy semantic search engine with batched, cached, normalised embeddings",
      ],
      dsaPattern: "graphs",
    },
    {
      week: 14,
      title: "RAG",
      focus: "The full retrieve-augment-generate loop with citations, hybrid search, reranking and retrieval evals.",
      goals: [
        "Ship a PDF assistant that answers with page-level citations and refuses when evidence is missing",
        "Add BM25/full-text search fused with vectors via RRF, plus a cross-encoder reranker",
        "Measure recall@5 and MRR on a 30-question golden set across three chunking configs",
      ],
      dsaPattern: "graphs",
    },
    {
      week: 15,
      title: "Agents",
      focus: "Tool calling, the observe-think-act loop, planning and memory beyond the context window.",
      goals: [
        "Implement tool calling end to end with correct message shapes, parallel calls and error results",
        "Write a three-tool agent loop that logs why it chose each tool and stops safely under step, budget and loop guards",
        "Add an explicit plan and long-term remember/recall memory to the agent",
      ],
      dsaPattern: "union-find",
    },
    {
      week: 16,
      title: "MCP",
      focus: "The Model Context Protocol, building servers with FastMCP, agent guardrails and the Cortex v0.4 release.",
      goals: [
        "Explain MCP's hosts, clients, servers, primitives and transports, and speak it raw over stdio",
        "Build and ship an MCP server with two useful tools, tested in the Inspector and used from a real host",
        "Put guardrails around agent tools and measure prompt-injection success with a red-team eval",
      ],
      dsaPattern: "greedy",
    },
  ],
  topics: [...w13.topics, ...w14.topics, ...w15.topics, ...w16.topics],
  labs: [...w13.labs, ...w14.labs, ...w15.labs, ...w16.labs],
};
