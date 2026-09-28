import type { MonthSeed, WeekSeed } from "../../types";
import * as week17 from "./week-17";
import * as week18 from "./week-18";
import * as week19 from "./week-19";
import * as week20 from "./week-20";

const weeks: WeekSeed[] = [
  {
    week: 17,
    title: "Evaluation",
    focus: "Replace vibes with numbers: golden sets, calibrated LLM judges and an eval gate that runs on every change.",
    goals: [
      "Build a tagged 25-case golden set for Cortex and a runner that scores it with deterministic checks",
      "Calibrate an LLM judge against 30 hand labels and reach Cohen's kappa of at least 0.6",
      "Make the eval runner produce results.json and a gate script that fails on regressions and critical cases",
    ],
    dsaPattern: "dynamic-programming",
  },
  {
    week: 18,
    title: "Observability",
    focus: "See inside every agent run: span-level traces, cost and latency percentiles, structured logs, metrics and SLO-based alerts.",
    goals: [
      "Trace an agent end to end with nested spans carrying model, tokens and tool arguments",
      "Measure TTFT, p95 latency and cost per question, and cut one of them without lowering eval scores",
      "Define an SLO and error budget for /api/ask with one paging alert and structured JSON logs",
    ],
    dsaPattern: "dynamic-programming",
  },
  {
    week: 19,
    title: "AI security",
    focus: "Attack your own app: prompt injection, classic OWASP bugs in AI features, and guardrails measured by attack success rate.",
    goals: [
      "Map Cortex's lethal trifecta and close the markdown image/link exfiltration channel",
      "Find and fix IDOR, SQL injection and SSRF in a small FastAPI app",
      "Run a categorised red-team suite with a canary and report attack success and false-refusal rates",
    ],
    dsaPattern: "dynamic-programming",
  },
  {
    week: 20,
    title: "AI infrastructure",
    focus: "Ship and serve: GitHub Actions gates, AWS building blocks, GPU serving with vLLM, and when LoRA fine-tuning beats RAG.",
    goals: [
      "Make tests and evals a required GitHub Actions check on Cortex's main branch",
      "Size a GPU for an open model from its config (weights + KV cache) and explain continuous batching and PagedAttention",
      "Ship Cortex v0.5 with research-agent mode, tracing, injection defences and the eval gate",
    ],
    dsaPattern: "queue",
  },
];

export const month5: MonthSeed = {
  month: 5,
  slug: "ai-systems-infra",
  title: "AI Systems + Evaluation + Infrastructure",
  subtitle: "Measure it, trace it, attack it, ship it: the engineering around the model.",
  levelTitle: "AI Systems Engineer",
  domain: "ai",
  outcomes: [
    "Build golden sets and calibrated LLM judges, and run them as a regression gate in CI",
    "Trace multi-step agents and use traces to cut p95 latency and cost per request",
    "Threat-model an LLM app for prompt injection and OWASP bugs, and measure defences with a red-team suite",
    "Set SLOs, structured logs, metrics and burn-rate alerts for an AI endpoint",
    "Do GPU memory maths, serve an open model with vLLM, and decide between hosted, self-hosted and fine-tuned",
    "Explain when LoRA fine-tuning beats RAG and implement a LoRA layer from scratch",
  ],
  flagshipMilestone: {
    title: "Agents + evaluation",
    detail:
      "Cortex grows from a RAG chat into a research assistant that plans and uses tools over your documents. Every run is traced, retrieved text is treated as untrusted, and a golden set plus calibrated LLM judge and red-team cases run in GitHub Actions, blocking any PR that makes answers less grounded or re-opens an injection.",
    deliverables: [
      "Research-agent mode with search_docs and read_chunk tools, a step cap and a tool-less, cited answer step",
      "Eval suite: 40+ golden cases, deterministic scorers, a calibrated groundedness judge (kappa recorded) and red-team critical cases",
      "GitHub Actions workflow running tests + evals as a required check, with a job summary table",
      "Span-level tracing of every agent run with tokens, latency and tool arguments, plus a trace tree view",
      "Prompt-injection defences: spotlighted untrusted content, output link/image sanitiser, canary, documented threat model",
      "README v0.5 metrics: groundedness, citation accuracy, attack success rate, p95 latency and cost per question",
    ],
  },
  weeks,
  topics: [...week17.topics, ...week18.topics, ...week19.topics, ...week20.topics],
  labs: [...week17.labs, ...week18.labs, ...week19.labs, ...week20.labs],
};
