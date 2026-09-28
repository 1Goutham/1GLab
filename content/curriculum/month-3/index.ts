import type { MonthSeed, WeekSeed } from "../../types";
import * as week09 from "./week-09";
import * as week10 from "./week-10";
import * as week11 from "./week-11";
import * as week12 from "./week-12";

const weeks: WeekSeed[] = [
  {
    week: 9,
    title: "Tokens & embeddings",
    focus: "How text becomes numbers: BPE tokenisation, embeddings as meaning, and fast similarity search.",
    goals: [
      "Measure token counts and cost for real prompts across English, code and non-English text",
      "Train a byte-level BPE tokenizer and prove a lossless encode/decode round-trip",
      "Embed sentences, compute cosine similarity and retrieve the top-k with a heap",
    ],
    dsaPattern: "heap",
  },
  {
    week: 10,
    title: "Attention",
    focus: "Self-attention from first principles: Q, K, V, scaling, causal masks, multiple heads and position.",
    goals: [
      "Implement scaled dot-product attention with a causal mask in NumPy and verify it",
      "Build multi-head attention in PyTorch and match it against the fused kernel",
      "Explain why attention needs positional information and how RoPE encodes relative position",
    ],
    dsaPattern: "bst",
  },
  {
    week: 11,
    title: "The transformer",
    focus: "Stack blocks into a GPT, train it on next-token prediction and control how it generates.",
    goals: [
      "Write a pre-norm transformer block and derive a GPT's parameter count from its config",
      "Train a character-level GPT whose loss starts near ln(V) and falls well below the bigram baseline",
      "Implement temperature, top-k and top-p sampling and choose settings per use case",
    ],
    dsaPattern: "backtracking",
  },
  {
    week: 12,
    title: "LLM engineering",
    focus: "Engineering around the model: tested prompts, typed outputs, end-to-end streaming and inference cost.",
    goals: [
      "Put a real prompt under an eval harness and improve it with measured, single-variable changes",
      "Extract typed, validated data with strict JSON schemas and retry on invalid output",
      "Stream Cortex answers FastAPI → Next.js with cancellation, citations and per-request cost logging",
    ],
    dsaPattern: "trie",
  },
];

export const month3: MonthSeed = {
  month: 3,
  slug: "transformers-llms",
  title: "Transformers + LLM Foundations",
  subtitle: "Open the black box: from tokens and attention to a GPT you trained yourself, then engineer real LLM features on top.",
  levelTitle: "Transformer Engineer",
  domain: "ai",
  outcomes: [
    "Explain and implement tokenisation, embeddings and self-attention with correct shapes and math",
    "Build and train a small GPT in PyTorch and control its output with temperature, top-k and top-p",
    "Estimate a model's parameters, KV-cache memory and per-request cost from its config and usage data",
    "Design prompts with eval sets and get schema-valid, validated structured outputs from any LLM API",
    "Stream LLM responses end-to-end from FastAPI to a Next.js UI with working cancellation",
  ],
  flagshipMilestone: {
    title: "Streaming",
    detail:
      "Cortex v0.3 stops making users wait. Answers stream token by token from FastAPI over Server-Sent Events into the Next.js UI, arrive with structured citations validated against the retrieved chunks, and every request records input, cached and output tokens with its cost and latency — so from now on quality, speed and spend are all visible.",
    deliverables: [
      "FastAPI SSE endpoint emitting typed token, citations, usage, error and done events",
      "Next.js route handler proxy and React hook with a Stop button that cancels generation end-to-end",
      "Citation chips linked to source chunks, with hallucinated citation IDs detected and logged",
      "Per-request log of tokens, cost, time to first token and total latency, viewable in the app",
    ],
  },
  weeks,
  topics: [...week09.topics, ...week10.topics, ...week11.topics, ...week12.topics],
  labs: [...week09.labs, ...week10.labs, ...week11.labs, ...week12.labs],
};
