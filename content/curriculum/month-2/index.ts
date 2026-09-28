import type { MonthSeed, WeekSeed } from "../../types";
import * as week05 from "./week-05";
import * as week06 from "./week-06";
import * as week07 from "./week-07";
import * as week08 from "./week-08";

const weeks: WeekSeed[] = [
  {
    week: 5,
    title: "How machines learn",
    focus: "Loss functions, gradient descent, linear and logistic regression, and evaluating models honestly.",
    goals: [
      "Derive the MSE and cross-entropy gradients by hand and implement gradient descent from scratch",
      "Train and compare linear and logistic regression, from scratch and with scikit-learn",
      "Evaluate a classifier with a confusion matrix, precision, recall and PR-AUC, and spot data leakage",
    ],
    dsaPattern: "binary-search",
  },
  {
    week: 6,
    title: "Neural networks",
    focus: "Vectorised NumPy, the multi-layer perceptron and backpropagation written by hand.",
    goals: [
      "Write vectorised NumPy with shape comments and avoid broadcasting bugs",
      "Build an MLP forward pass with stable softmax and sensible initialisation",
      "Implement backprop by hand, verify it with a gradient check and train a digit classifier above 90%",
    ],
    dsaPattern: "sliding-window",
  },
  {
    week: 7,
    title: "PyTorch",
    focus: "Tensors, autograd and the canonical training loop, plus diagnosing and fixing overfitting.",
    goals: [
      "Use tensors and autograd confidently, and explain grad_fn, leaf tensors and gradient accumulation",
      "Write a correct training loop from memory with DataLoader, AdamW and a train/eval split",
      "Read learning curves and apply early stopping, weight decay and dropout to close a generalisation gap",
    ],
    dsaPattern: "linked-list",
  },
  {
    week: 8,
    title: "Advanced backend",
    focus: "Background jobs, Docker and rate limiting: the plumbing behind a production AI API.",
    goals: [
      "Move slow document processing onto a durable job queue with idempotent, retrying workers",
      "Containerise the stack with a cache-friendly Dockerfile and a Compose file with healthchecks",
      "Protect LLM endpoints with per-key token buckets, bounded concurrency and backoff with jitter",
    ],
    dsaPattern: "trees",
  },
];

export const month2: MonthSeed = {
  month: 2,
  slug: "deep-learning-backend",
  title: "Deep Learning + Advanced Backend",
  subtitle: "Build a neural network from the maths up, then ship an AI API that survives real traffic.",
  levelTitle: "Neural Network Engineer",
  domain: "ai",
  outcomes: [
    "Explain and implement gradient descent, logistic regression and backpropagation from first principles, with correct derivatives and shapes",
    "Train, evaluate and regularise a neural network classifier in both NumPy and PyTorch, with honest train/validation/test splits",
    "Choose the right metric for a model (precision, recall, PR-AUC) and catch data leakage before it reaches production",
    "Run slow AI work through a durable background job queue with retries, idempotency and dead-lettering",
    "Containerise a multi-service backend (API, worker, Postgres, Redis) with Docker Compose and healthchecks",
    "Protect LLM endpoints with Redis rate limiting, bounded concurrency and exponential backoff with jitter",
  ],
  flagshipMilestone: {
    title: "AI API",
    detail:
      "Cortex, your personal research assistant, becomes a real backend service. An /ask endpoint talks to an LLM through a provider abstraction, so switching between Gemini, OpenAI and Anthropic is a single environment variable. Uploaded documents are processed asynchronously by a background worker with retries, the API is rate-limited per key, and the whole stack runs with docker compose up.",
    deliverables: [
      "Provider-agnostic LLM layer (Gemini, OpenAI, Anthropic and a fake provider for tests) selected by LLM_PROVIDER",
      "POST /ask returning an answer with citations to chunk ids, plus the provider, model and latency",
      "POST /documents returning 202, with a Postgres SKIP LOCKED worker that chunks documents idempotently",
      "Redis token-bucket rate limiting per API key, with 429 and Retry-After",
      "Outbound resilience: semaphore-bounded concurrency, timeouts, and retries with backoff and jitter",
      "compose.yaml running api, worker, Postgres and Redis with healthchecks, plus a README with a curl walkthrough",
    ],
  },
  weeks,
  topics: [...week05.topics, ...week06.topics, ...week07.topics, ...week08.topics],
  labs: [...week05.labs, ...week06.labs, ...week07.labs, ...week08.labs],
};
