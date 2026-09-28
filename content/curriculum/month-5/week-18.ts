import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "llm-tracing",
    title: "Tracing LLM applications",
    week: 18,
    domain: "ai",
    skills: ["observability"],
    difficulty: "medium",
    minutes: 70,
    summary: "Record every step of an agent run as a tree of timed spans so you can see where time, tokens and errors actually go.",
    tags: ["tracing", "opentelemetry", "agents", "observability"],
    lesson: {
      hook: `A user says Cortex "took forever and then gave a weird answer". Your logs show one line: \`POST /api/ask 200 11.4s\`.

Was it retrieval? The second LLM call? A tool that timed out and retried three times? Did the agent loop six times because the planner kept calling the same search? From that log line, you cannot know.

An agent run is not one request — it is a tree of steps. Tracing records that tree: every LLM call, retrieval, tool call and retry as a timed span with its inputs, outputs and token counts, nested under the step that caused it.`,
      whyItMatters: "Tracing is how you debug agents, find latency and cost hot spots, and turn production failures into eval cases. Every serious LLM platform (LangSmith, Langfuse, Phoenix, Braintrust) is built on this model.",
      levels: {
        l1: "A trace is a detailed receipt for one request. Each line on the receipt is a step — \"searched documents: 300ms\", \"asked the model: 1.8s, 2,100 tokens\" — and steps can contain smaller steps. When something is slow or wrong, you read the receipt instead of guessing.",
        l2: {
          text: `A **trace** is one end-to-end operation (one user question). It is made of **spans**. Each span has a name, start and end time, attributes (model, token counts, document ids), a status, and a **parent span id** — which is what turns a flat list of events into a tree.

For agents the tree shape itself is information: a healthy run is shallow and short; a looping agent shows the same \`tool.search\` span eight times under one parent.`,
          analogy: "The React DevTools Profiler flame graph, but for your backend: each bar is a step, nested bars are the work it caused, and the widest bar is where your time went.",
          diagram: {
            type: "stack",
            title: "One Cortex agent trace (a tree of spans)",
            layers: [
              { label: "agent.run", note: "4.9s total · trace_id 4bf9…", accent: true },
              { label: "├─ llm.plan", note: "0.9s · 1,850 in / 120 out tokens" },
              { label: "├─ tool.search_docs", note: "0.3s · top_k=8 · 8 chunk ids" },
              { label: "├─ tool.fetch_url", note: "2.6s · retried once · slowest span" },
              { label: "└─ llm.answer", note: "1.1s · 5,900 in / 410 out tokens" },
            ],
          },
        },
        l3: {
          text: `**OpenTelemetry** (OTel) is the vendor-neutral standard: you instrument once with its API and choose where spans go (console, Jaeger, Honeycomb, Langfuse, Phoenix) by swapping the exporter. OTel also defines \`gen_ai.*\` semantic conventions for LLM spans — attributes such as \`gen_ai.request.model\`, \`gen_ai.usage.input_tokens\` and \`gen_ai.usage.output_tokens\` — so tools can render LLM spans consistently. The conventions are still evolving, so treat names as a guide and keep them consistent in your own code.

What to put on an LLM span: model, parameters, input/output token counts, latency, finish reason, and (subject to privacy) the prompt and completion. On a retrieval span: query, top_k, returned chunk ids and scores. On a tool span: arguments, result size, error.`,
          code: [
            {
              title: "Nested spans with the OpenTelemetry Python SDK",
              lang: "python",
              code: `# pip install opentelemetry-api opentelemetry-sdk
import time
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("cortex")

def search_docs(query: str) -> list[str]:
    with tracer.start_as_current_span("tool.search_docs") as span:
        span.set_attribute("retrieval.query", query)
        time.sleep(0.2)
        ids = ["doc-3#12", "doc-7#4"]
        span.set_attribute("retrieval.chunk_ids", ids)
        return ids

def answer(query: str) -> str:
    with tracer.start_as_current_span("agent.run") as root:
        root.set_attribute("user.query", query)
        chunks = search_docs(query)
        with tracer.start_as_current_span("llm.answer") as span:
            span.set_attribute("gen_ai.request.model", "gpt-4o-mini")
            time.sleep(0.5)
            span.set_attribute("gen_ai.usage.input_tokens", 1840)
            span.set_attribute("gen_ai.usage.output_tokens", 212)
        return "answer citing " + ", ".join(chunks)

print(answer("What is the refund window?"))`,
              note: "Each exported span prints its trace_id, span_id and parent_id. Exceptions inside start_as_current_span are recorded and the span status set to ERROR by default.",
            },
          ],
        },
        l4: {
          text: `How does a child span know its parent without you passing it around? **Context propagation.** In Python, OTel stores the current span in a \`contextvars.ContextVar\`, which is per-thread and per-asyncio-task — like React context, but for the call stack. Starting a span reads the current one as parent, sets itself as current, and restores the old value when it ends.

Across process boundaries (Next.js frontend calling a FastAPI backend), context travels in the W3C \`traceparent\` HTTP header: \`00-<32 hex trace id>-<16 hex parent span id>-<flags>\`, for example \`00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\`. The receiving service continues the same trace.

Export is **batched and asynchronous** in production (\`BatchSpanProcessor\`) so tracing never blocks the request. At high volume you **sample**; for LLM apps, keeping all errored and slow traces (tail-based sampling) is worth far more than a random 1%.

You do not need a vendor to understand this. The tracer below is the whole idea in 25 lines.`,
          code: [
            {
              title: "A tiny JSONL tracer built on contextvars",
              lang: "python",
              code: `import contextvars
import json
import time
import uuid
from contextlib import contextmanager

_current = contextvars.ContextVar("current_span", default=None)

@contextmanager
def span(name: str, **attrs):
    parent = _current.get()
    s = {
        "trace_id": parent["trace_id"] if parent else uuid.uuid4().hex,
        "span_id": uuid.uuid4().hex[:16],
        "parent_id": parent["span_id"] if parent else None,
        "name": name, "attrs": attrs, "start": time.time(), "status": "ok",
    }
    token = _current.set(s)
    t0 = time.perf_counter()
    try:
        yield s
    except Exception as e:
        s["status"] = "error"
        s["error"] = repr(e)
        raise
    finally:
        s["duration_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        _current.reset(token)
        with open("traces.jsonl", "a") as f:
            f.write(json.dumps(s, default=str) + "\\n")

with span("agent.run", query="refund window?"):
    with span("tool.search_docs", top_k=8):
        time.sleep(0.1)
    with span("llm.answer", model="gpt-4o-mini") as s:
        time.sleep(0.3)
        s["attrs"]["output_tokens"] = 212`,
              note: "Children finish (and are written) before their parent, so the root is the last line. Rebuild the tree by grouping on parent_id.",
            },
          ],
        },
        l5: {
          question: "You are adding tracing to a multi-step research agent in production. What do you record on each span, and how do you handle volume and sensitive data?",
          hint: "Think span attributes per step type, sampling strategy, and where prompts containing user documents end up.",
          answer: `I would create a root span per user request and child spans for each LLM call, retrieval, tool call and retry, using OpenTelemetry so the backend is swappable. LLM spans get model, parameters, token counts, latency, finish reason and prompt/template version; retrieval spans get query, top_k and chunk ids with scores; tool spans get arguments, result size and errors; the root gets user id (hashed), session id and final outcome, plus a link to any user feedback. For volume I would export asynchronously in batches and use tail-based sampling: keep 100% of errored, slow or thumbs-down traces and a small percentage of the rest. Prompts and completions contain users' documents, so I would redact obvious PII before export, send traces only to a backend with appropriate access control and retention, and make full-content capture configurable per environment. Finally, I would make traces the source of new eval cases — a bad trace should be one click from becoming a golden-set entry.`,
        },
      },
      commonMistakes: [
        "Logging only the final request duration, so you cannot tell whether retrieval, the model or a tool is slow.",
        "Creating spans but losing the parent link across threads, async tasks or HTTP calls, which produces many disconnected one-span traces.",
        "Exporting spans synchronously inside the request path, adding latency to every call.",
        "Shipping full prompts with users' private documents to a third-party tracing vendor without redaction or a retention policy.",
      ],
      tryThis: "Run the tiny tracer above, then print the spans from traces.jsonl sorted by duration_ms. Now add a time.sleep(1) inside one child and watch it jump to the top.",
      miniTask: {
        title: "Trace one Cortex question end to end",
        kind: "code",
        minutes: 30,
        steps: [
          "Copy the tiny JSONL tracer into your Cortex backend as tracing.py.",
          "Wrap the request handler, the retrieval call and each LLM call in span(...).",
          "Record model, input_tokens and output_tokens on LLM spans (from the API response usage field).",
          "Ask three questions, then write a 10-line script that prints each trace as an indented tree with durations.",
        ],
        checklist: [
          "All spans from one question share a trace_id",
          "Every non-root span has a parent_id that exists in the same trace",
          "LLM spans carry real token counts from the API response",
          "You can name the slowest span for each of the three questions",
        ],
        deliverable: "tracing.py, print_trace.py and a pasted tree for one question.",
      },
      quiz: [
        {
          q: "What turns a list of spans into a tree?",
          options: [
            "Their start timestamps",
            "Each span's parent span id",
            "The span names",
            "The order they were exported",
          ],
          answer: 1,
          explain: "Timestamps overlap and export order is reversed (children end first). The parent id is the explicit edge.",
        },
        {
          q: "How does trace context cross from a Next.js API route to a FastAPI service?",
          options: [
            "Through a shared database table",
            "It cannot; each service has separate traces",
            "Through the W3C traceparent HTTP header",
            "Through cookies",
          ],
          answer: 2,
          explain: "The caller injects traceparent (trace id + parent span id + flags) and the callee extracts it to continue the same trace.",
        },
        {
          q: "For an LLM app at high traffic, which sampling strategy keeps the most useful traces?",
          options: [
            "Random 1% head sampling",
            "Keep only successful traces",
            "Tail-based: keep all errored, slow or negatively-rated traces plus a small random share",
            "No tracing in production",
          ],
          answer: 2,
          explain: "Debugging and eval-building need the bad runs. Head sampling decides before you know whether the run will be interesting.",
        },
      ],
      explainPrompt: "Explain traces, spans and parent ids to a junior engineer using one Cortex agent run as the example, in five sentences.",
      implementPrompt: "From memory, implement a span() context manager with contextvars that records trace_id, span_id, parent_id, duration and errors, and writes JSON lines.",
      videos: [
        {
          title: "OpenTelemetry explained",
          channel: "TechWorld with Nana",
          url: "https://www.youtube.com/results?search_query=opentelemetry+explained+traces+spans+techworld+with+nana",
          kind: "search",
          reason: "Watch this if traces, spans, exporters and collectors still feel like four names for the same thing.",
        },
        {
          title: "Tracing and observability for LLM agents",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+llm+observability+tracing+agents",
          kind: "search",
          reason: "Watch this to see real agent traces in tools like Phoenix or Langfuse and how teams turn them into evals.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "cost-latency-engineering",
    title: "Cost & latency engineering",
    week: 18,
    domain: "ai",
    skills: ["observability", "inference"],
    difficulty: "medium",
    minutes: 75,
    summary: "Measure TTFT, tokens/sec and p95, then cut cost and latency with prompt caching, smaller contexts, routing and streaming.",
    prerequisites: ["llm-tracing"],
    tags: ["latency", "cost", "prompt-caching", "routing", "percentiles"],
    lesson: {
      hook: `Cortex works. Then you do the maths: every question sends 6,000 tokens of retrieved context to a large model. At 10,000 questions a day, that is thousands of dollars a month — for a side project.

And users say it feels slow, even though your average latency is "only" 1.6 seconds. The average is lying: one request in twenty takes seven seconds, and those are the ones people remember.

LLM cost and latency are not fixed properties of the model. They are engineering outcomes of how many tokens you send, how many you generate, which model you route to, and what you reuse.`,
      whyItMatters: "Unit economics decide whether an AI feature can exist. Engineers who can halve cost and p95 latency without hurting eval scores are exactly who AI teams want to hire.",
      levels: {
        l1: "You pay per token in and per token out, and output tokens are both pricier and slower. Latency has two parts: how long until the first word appears, and how fast the rest streams. Make prompts shorter, reuse what you can, and send easy questions to cheaper models.",
        l2: {
          text: `Four numbers describe an LLM call:

- **TTFT** (time to first token): network + queueing + **prefill** (the model reading your whole prompt in parallel). Grows with input length.
- **Output speed** (tokens/sec, or time per output token): **decode**, one token at a time. Total latency is roughly TTFT + output_tokens / speed.
- **Cost**: input_tokens x input price + output_tokens x output price, minus discounts for cached input.
- **p95 / p99**: the latency that 95% / 99% of requests beat. Users feel tails, not means.`,
          analogy: "TTFT is how long the kitchen takes to read your order; tokens/sec is how fast dishes then come out. A 40-item order (huge prompt) delays the first dish; a 12-course meal (long output) keeps you waiting at the end.",
          diagram: {
            type: "compare",
            title: "Where the levers act",
            left: {
              label: "Input side (TTFT + input cost)",
              points: [
                "Fewer, better chunks (rerank, top 5 not top 20)",
                "Prompt caching: static prefix first",
                "Trim chat history, summarise old turns",
                "Smaller model for easy queries",
              ],
            },
            right: {
              label: "Output side (total latency + output cost)",
              points: [
                "Ask for concise answers, set max_tokens",
                "Structured outputs instead of prose",
                "Stream so perceived latency is TTFT",
                "Parallelise independent tool calls",
              ],
            },
          },
        },
        l3: {
          text: `Measure before optimising. Streaming lets you capture TTFT and output speed separately; with the OpenAI SDK, \`stream_options={"include_usage": True}\` adds a final chunk (with an empty \`choices\` list) carrying token usage.

Then apply the levers in order of payoff:

1. **Send fewer input tokens.** Retrieval sending 20 chunks when 5 reranked ones score the same on your evals is the single most common waste.
2. **Prompt caching.** Providers cache the processed prefix of recent prompts and bill cached input tokens at a large discount while also cutting TTFT. It only works on an **exact prefix match** — put the system prompt, tool definitions and stable documents first, and the user's question last. Some providers cache automatically above a minimum length; others need explicit cache markers.
3. **Model routing.** A small model handles classification, query rewriting and easy questions; escalate to the large model only when needed. Verify each route on your eval set.
4. **Response caching.** Exact-match cache for repeated questions (Redis, keyed by normalised question + doc version); semantic caching only with a strict similarity threshold and evals, because a near-miss returns a confidently wrong answer.`,
          code: [
            {
              title: "Measure TTFT, total latency and tokens/sec",
              lang: "python",
              code: `import time
from openai import OpenAI

client = OpenAI()

def measure(prompt: str, model: str = "gpt-4o-mini") -> dict:
    t0 = time.perf_counter()
    ttft = None
    usage = None
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        stream_options={"include_usage": True},
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content and ttft is None:
            ttft = time.perf_counter() - t0
        if chunk.usage:
            usage = chunk.usage
    total = time.perf_counter() - t0
    out_tokens = usage.completion_tokens
    return {
        "ttft_s": round(ttft, 3),
        "total_s": round(total, 3),
        "input_tokens": usage.prompt_tokens,
        "output_tokens": out_tokens,
        "tokens_per_s": round(out_tokens / max(total - ttft, 1e-6), 1),
    }

print(measure("Explain prompt caching in 3 sentences."))
print(measure("Explain prompt caching in 300 words."))`,
              note: "Compare the two runs: TTFT barely moves, total latency scales with output tokens.",
            },
          ],
        },
        l4: {
          text: `**Why output is slow and input is fast.** Prefill processes all prompt tokens in one parallel pass — GPUs love that. Decode generates one token per forward pass, and each pass must read all model weights from GPU memory, so it is **memory-bandwidth bound**. That is why output tokens cost several times more than input tokens and why "be concise" is a latency optimisation.

**Why prompt caching works.** During prefill the model computes keys and values for every token (the KV cache). If the next request starts with the identical token prefix, the provider reuses those tensors instead of recomputing them. Change one token early in the prompt — a timestamp in the system prompt, a re-ordered tool list — and everything after it misses the cache.

**Why you report percentiles.** Latency distributions are long-tailed: retries, cold starts, long outputs. In the sample below the mean is 1.56s, but no request actually took 1.56s — most took about 1s and two took 6–7s. p95 exposes the tail; the mean hides it. Never average percentiles across servers either; compute them from the merged raw data or histograms.`,
          code: [
            {
              title: "Percentiles and a per-request cost model",
              lang: "python",
              code: `import math

def percentile(xs: list[float], p: float) -> float:
    s = sorted(xs)
    return s[max(0, math.ceil(p / 100 * len(s)) - 1)]   # nearest-rank

lat = [0.8, 0.9, 1.1, 1.0, 0.95, 1.2, 0.85, 1.05, 6.5, 0.9,
       1.0, 1.1, 0.9, 0.8, 7.2, 1.0, 0.95, 1.1, 1.0, 0.9]
print(f"mean={sum(lat)/len(lat):.2f} p50={percentile(lat, 50)} p95={percentile(lat, 95)}")
# mean=1.56 p50=1.0 p95=6.5

# Illustrative USD prices per 1M tokens - always check your provider's pricing page.
PRICES = {
    "small": {"in": 0.15, "cached_in": 0.075, "out": 0.60},
    "large": {"in": 2.50, "cached_in": 1.25, "out": 10.00},
}

def cost(model: str, in_tok: int, out_tok: int, cached: int = 0) -> float:
    p = PRICES[model]
    return ((in_tok - cached) * p["in"] + cached * p["cached_in"] + out_tok * p["out"]) / 1e6

for m in PRICES:
    per_q = cost(m, 6000, 400)
    print(f"{m}: per question={per_q:.5f} per month at 10k/day={per_q * 10_000 * 30:,.0f}")
# small: 0.00114 -> 342 / month; large: 0.01900 -> 5,700 / month`,
            },
          ],
        },
        l5: {
          question: "Cortex costs too much and p95 latency is 9 seconds. You are asked to halve both without lowering answer quality. Walk through your approach.",
          hint: "Measure first, then input tokens, output tokens, model choice and reuse — and prove quality held.",
          answer: `I would start with traces to get a breakdown per span: tokens in and out per LLM call, retrieval time, tool time, and which requests make up the p95 tail. Typically input context dominates cost, so I would test reducing retrieved chunks from, say, 20 to 5 with a reranker and check the eval suite still passes. I would restructure prompts for prompt caching — system prompt, tool schemas and stable instructions first, dynamic content last — and confirm cache hits in the usage data. For output I would ask for concise, structured answers and set max_tokens, since decode time is linear in output length. Then routing: a small model for query rewriting and easy questions, with the large model only for multi-document synthesis, validated per route on the golden set. For the tail I would parallelise independent tool calls, add timeouts with fallbacks, and stream the answer so perceived latency becomes TTFT. Every change goes through the eval gate, and I would report cost per question and p95 before and after, not averages.`,
        },
      },
      commonMistakes: [
        "Optimising average latency while the p95 tail — the requests users complain about — stays untouched.",
        "Putting a timestamp, request id or user name at the top of the system prompt, which breaks prompt caching for every request.",
        "Routing to a cheaper model without re-running evals on that route.",
        "Semantic caching with a loose similarity threshold, returning a cached answer to a question that only looks similar.",
      ],
      tryThis: "Call the same 3,000-token prompt twice in a row with a provider that supports automatic prompt caching and compare TTFT and the cached-token field in the usage object. Then change the first word and call again.",
      miniTask: {
        title: "Build Cortex's cost and latency sheet",
        kind: "observe",
        minutes: 40,
        steps: [
          "Run 20 real questions through Cortex with the measure() approach (streaming + usage).",
          "Record TTFT, total latency, input tokens and output tokens per question in a CSV.",
          "Compute p50, p95, mean latency and average cost per question with the cost model.",
          "Halve the number of retrieved chunks, re-run the 20 questions and your golden set.",
          "Write down cost and p95 before/after, and whether the eval score changed.",
        ],
        checklist: [
          "A CSV with 20 rows and real token counts from the API",
          "p50 and p95 computed and different from the mean",
          "A before/after comparison for the chunk-count change",
          "Eval score recorded for both configurations",
        ],
        deliverable: "latency_cost.csv and a 5-line summary with the recommendation.",
      },
      quiz: [
        {
          q: "Which change most directly reduces time to first token for a long RAG prompt?",
          options: [
            "Lowering max_tokens",
            "Sending fewer input tokens or hitting the prompt cache",
            "Raising temperature",
            "Asking for a shorter answer",
          ],
          answer: 1,
          explain: "TTFT is dominated by prefill over the input. Output-length changes affect total latency, not the first token.",
        },
        {
          q: "Why do most providers charge more for output tokens than input tokens?",
          options: [
            "Output tokens are longer strings",
            "Decode generates one token per forward pass and is memory-bandwidth bound, while prefill processes input in parallel",
            "Output must be moderated",
            "Input tokens are compressed",
          ],
          answer: 1,
          explain: "Each output token needs its own pass over the weights; input tokens share passes. That hardware cost shows up in price and latency.",
        },
        {
          q: "Your system prompt starts with \"Current time: 14:03:22\". What happens to prompt caching?",
          options: [
            "Nothing, caching ignores the system prompt",
            "It improves, because timestamps are short",
            "The prefix changes every request, so almost nothing after it can be served from cache",
            "Only the timestamp is uncached",
          ],
          answer: 2,
          explain: "Caching needs an exact prefix match. Dynamic content belongs at the end of the prompt.",
        },
      ],
      explainPrompt: "Explain TTFT, tokens/sec and p95 to a junior engineer, and why prompt order matters for prompt caching, in five sentences.",
      implementPrompt: "From memory, write a function that streams a completion and returns TTFT, total latency, output tokens and tokens/sec, plus a nearest-rank percentile function.",
      videos: [
        {
          title: "LLM inference: prefill, decode and the KV cache",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+kv+cache+llm+inference",
          kind: "search",
          reason: "Watch this if it is not yet clear why output tokens are slow and why caching a prompt prefix saves compute.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "logs-metrics-alerts",
    title: "Logs, metrics & alerts",
    week: 18,
    domain: "cloud",
    skills: ["monitoring"],
    difficulty: "medium",
    minutes: 65,
    summary: "Structured logs for detail, metrics for trends, alerts on user-facing symptoms with SLOs and error budgets.",
    tags: ["monitoring", "prometheus", "slo", "alerting", "logging"],
    lesson: {
      hook: `It is 2 a.m. and your LLM provider starts returning 529 "overloaded" errors for 15% of requests. Cortex retries, some users see errors, most do not.

Do you find out from an alert with a graph attached, or from a screenshot on Twitter three days later?

Traces tell you why one request was slow. Metrics tell you the error rate right now across all requests. Logs give you the exact details of any single event. Alerts wake you only when users are actually hurting. You need all four, and each has a job the others do badly.`,
      whyItMatters: "Running AI features in production means monitoring provider errors, latency, token spend and quality drift. SLO-based alerting is a standard interview topic for backend and platform roles.",
      levels: {
        l1: "Logs are a diary of individual events. Metrics are counters and timers you can graph over time. Alerts are rules on those graphs that notify you when something users care about goes wrong. Good monitoring means few alerts, each one worth waking up for.",
        l2: {
          text: `The three signals trade detail for cost:

- **Logs**: one record per event, full detail, expensive to store and query at volume. Make them **structured** (JSON), with a request id that also appears in the trace.
- **Metrics**: pre-aggregated numbers — counters, gauges, histograms — cheap to store forever and fast to graph and alert on.
- **Traces**: the causal tree of one request (previous topic).

For services, track **RED**: Rate, Errors, Duration. For AI features add tokens and cost per request, provider error codes, refusal rate and user feedback rate.`,
          analogy: "Metrics are your Vercel analytics dashboard; logs are the function logs you open once the dashboard looks wrong; an alert is the email you get when the dashboard crosses a line you chose in advance.",
          diagram: {
            type: "flow",
            title: "From symptom to cause",
            lanes: [
              {
                tone: "good",
                steps: [
                  { label: "Alert fires", note: "error budget burning fast", accent: true },
                  { label: "Metrics", note: "which route, which provider code" },
                  { label: "Traces", note: "slow or failing span" },
                  { label: "Logs", note: "exact error body, request id" },
                  { label: "Fix + eval case" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `**Structured logs**: one JSON object per line, with consistent keys (\`level\`, \`msg\`, \`request_id\`, \`route\`, \`latency_ms\`, \`model\`). Vercel, CloudWatch and every log tool can then filter by field instead of grepping prose.

**Metrics with Prometheus**: a counter only goes up (requests, tokens); a gauge goes up and down (queue depth); a histogram counts observations into buckets so you can compute percentiles later. Label with low-cardinality values only (route, status, model) — never user ids or prompts, which would create millions of time series.`,
          code: [
            {
              title: "Unstructured log line",
              lang: "typescript",
              variant: "bad",
              code: `// app/api/ask/route.ts
console.log("answered question for " + userId + " in " + ms + "ms");`,
              note: "Unsearchable by field, leaks a raw user id, and cannot be joined to a trace.",
            },
            {
              title: "Structured log line",
              lang: "typescript",
              variant: "good",
              code: `// app/api/ask/route.ts
console.log(JSON.stringify({
  level: "info",
  msg: "ask.completed",
  request_id: requestId,
  route: "/api/ask",
  model: "gpt-4o-mini",
  input_tokens: usage.prompt_tokens,
  output_tokens: usage.completion_tokens,
  latency_ms: ms,
}));`,
            },
            {
              title: "RED + token metrics with prometheus_client",
              lang: "python",
              code: `# pip install prometheus-client
import random
import time
from prometheus_client import Counter, Histogram, start_http_server

REQUESTS = Counter("cortex_requests_total", "Requests", ["route", "status"])
LATENCY = Histogram("cortex_request_seconds", "Request latency", ["route"],
                    buckets=[0.25, 0.5, 1, 2, 4, 8, 16])
TOKENS = Counter("cortex_llm_tokens_total", "LLM tokens", ["model", "kind"])

def handle(route: str) -> None:
    with LATENCY.labels(route=route).time():
        time.sleep(random.uniform(0.1, 1.5))
        ok = random.random() > 0.05
    REQUESTS.labels(route=route, status="200" if ok else "500").inc()
    TOKENS.labels(model="gpt-4o-mini", kind="output").inc(random.randint(50, 400))

if __name__ == "__main__":
    start_http_server(8000)  # scrape http://localhost:8000/metrics
    while True:
        handle("/api/ask")`,
            },
          ],
        },
        l4: {
          text: `**Histograms.** A Prometheus histogram is a set of cumulative counters, one per bucket: \`cortex_request_seconds_bucket{le="2"}\` counts requests that took at most 2s. The server estimates percentiles by interpolating within buckets: \`histogram_quantile(0.95, sum(rate(cortex_request_seconds_bucket[5m])) by (le))\`. Because buckets add up across instances, you can aggregate them — unlike pre-computed percentiles, which cannot be averaged.

**SLOs and error budgets.** Pick a user-facing target: "99.5% of /api/ask requests succeed within 8s, over 30 days". The remaining 0.5% is the **error budget** — 216 minutes of full outage a month. Alert on **burn rate**: how fast you are spending the budget. A burn rate of 1 uses exactly the budget over 30 days; 14.4 sustained for an hour burns 2% of the monthly budget and should page; a burn rate of 1–2 over days should create a ticket, not a page.

Alert on symptoms users feel (error rate, latency, budget burn), not on causes (CPU at 80%). Causes go on dashboards.`,
          code: [
            {
              title: "Error budget and burn rate",
              lang: "python",
              code: `SLO = 0.995
WINDOW_DAYS = 30

budget_fraction = 1 - SLO                                  # 0.005
budget_minutes = WINDOW_DAYS * 24 * 60 * budget_fraction
print(f"error budget: {budget_minutes:.0f} minutes of full outage")  # 216

def burn_rate(error_ratio: float) -> float:
    return error_ratio / budget_fraction

def budget_spent(error_ratio: float, hours: float) -> float:
    return burn_rate(error_ratio) * hours / (WINDOW_DAYS * 24)

# provider returns errors on 7.2% of requests for one hour
print(f"burn={burn_rate(0.072):.1f}x spent={budget_spent(0.072, 1):.1%}")  # 14.4x, 2.0%`,
            },
          ],
        },
        l5: {
          question: "Design the monitoring and alerting for Cortex's /api/ask endpoint, which depends on an external LLM provider. What do you measure, what do you alert on, and what wakes someone up?",
          hint: "RED metrics, AI-specific signals, SLO, burn-rate alerts, page vs ticket.",
          answer: `I would emit structured JSON logs with a request id shared with traces, and metrics for RED — request rate, error rate by status and provider error code, and a latency histogram — plus AI-specific metrics: input and output tokens and cost per request by model, retry count, refusal rate and thumbs-down rate. The SLO would be user-facing, for example 99.5% of requests succeed within 8 seconds over 30 days. Paging alerts would be multi-window burn-rate alerts on that SLO, such as a 14.4x burn over one hour confirmed by a shorter window, so a provider outage pages quickly but a single blip does not. Slower burns, daily cost exceeding a budget, and drift in refusal or thumbs-down rate would create tickets, not pages. CPU, memory and provider latency would live on dashboards for diagnosis. Each alert links to a runbook — for example, switch to the fallback model — and a dashboard filtered to the right time range.`,
        },
      },
      commonMistakes: [
        "Using user ids, prompts or URLs as metric labels, exploding cardinality and the monitoring bill.",
        "Paging on causes like high CPU instead of user-facing symptoms, which trains everyone to ignore alerts.",
        "Averaging p95 values across instances instead of aggregating histogram buckets.",
        "Logging free-text strings, so nothing can be filtered or joined to a trace by request id.",
      ],
      tryThis: "Run the prometheus_client example and open localhost:8000/metrics. Find cortex_request_seconds_bucket and check that the le=\"+Inf\" bucket equals the _count line.",
      miniTask: {
        title: "Define Cortex's first SLO",
        kind: "build",
        minutes: 30,
        steps: [
          "Replace free-text logs in your /api/ask route with one structured JSON log per request, including request_id, latency_ms, model and token counts.",
          "Write an SLO for /api/ask (target, latency threshold, window) in docs/slo.md.",
          "Compute the error budget in minutes and the burn rate that should page.",
          "List three alerts: one page, two tickets, each with the metric, threshold and first runbook step.",
        ],
        checklist: [
          "Every /api/ask request produces exactly one JSON log line with request_id",
          "SLO states target, threshold and window",
          "Error budget calculated correctly for your target",
          "Alerts are on symptoms, and at most one of them pages",
        ],
        deliverable: "Updated route handler and docs/slo.md with SLO, budget and three alerts.",
      },
      quiz: [
        {
          q: "Which Prometheus metric type should you use to compute a p95 request latency across 4 instances?",
          options: ["Gauge", "Counter", "Histogram", "Summary with pre-computed p95 averaged across instances"],
          answer: 2,
          explain: "Histogram buckets can be summed across instances and then turned into a quantile. Pre-computed percentiles cannot be averaged correctly.",
        },
        {
          q: "A 99.9% monthly SLO gives roughly how much error budget?",
          options: ["About 43 minutes", "About 7 hours", "About 4 minutes", "About 1 day"],
          answer: 0,
          explain: "30 x 24 x 60 x 0.001 = 43.2 minutes.",
        },
        {
          q: "Which of these should page an engineer at night?",
          options: [
            "CPU above 80% for 5 minutes",
            "The error budget burning at 14x for the last hour",
            "Daily token spend 10% above average",
            "A single 500 error",
          ],
          answer: 1,
          explain: "Fast budget burn means users are failing now and the monthly SLO is at risk. The others are dashboard or ticket material.",
        },
      ],
      explainPrompt: "Explain the difference between logs, metrics and traces, and what an error budget is, to a junior engineer in five sentences.",
      implementPrompt: "From memory, instrument a Python function with a Prometheus counter (route, status) and a latency histogram, and compute the error budget and burn rate for a 99.5% SLO.",
      videos: [
        {
          title: "Prometheus monitoring explained",
          channel: "TechWorld with Nana",
          url: "https://www.youtube.com/results?search_query=techworld+with+nana+prometheus+explained",
          kind: "search",
          reason: "Watch this for a visual walkthrough of scraping, metric types and alerting rules.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "trace-your-agent",
    title: "Trace Your Agent",
    week: 18,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "ai",
    skills: ["observability", "agents"],
    prerequisites: ["Tracing LLM applications", "A tool-calling agent (Cortex or any agent loop you have built)"],
    topicSlugs: ["llm-tracing", "cost-latency-engineering"],
    objective: "Add span-level tracing to an agent — every LLM call, tool call and retry — then use the traces to find the slowest span and the most expensive step.",
    expectedOutput: "traces.jsonl from 10 agent runs, a print_tree.py script that renders one run as an indented tree with durations and tokens, and a short FINDINGS.md naming the slowest span type, the most token-hungry step, and one fix with before/after numbers.",
    steps: [
      {
        title: "Add the tracer",
        detail: "Use the contextvars JSONL tracer from the topic, or OpenTelemetry with a ConsoleSpanExporter redirected to a file. Either is fine — the goal is spans with trace_id, span_id, parent_id, name, duration_ms, status and attributes.",
      },
      {
        title: "Instrument the agent loop",
        detail: "Wrap the whole run in agent.run, each loop iteration in agent.step (attribute: step number), each model call in llm.call (model, input_tokens, output_tokens, finish_reason) and each tool invocation in tool.<name> (arguments, result length, error).",
      },
      {
        title: "Generate traffic",
        detail: "Run 10 varied questions, including one that needs several tool calls and one that should fail a tool (for example fetch an invalid URL) so you see an error span.",
      },
      {
        title: "Render the tree",
        detail: "Write print_tree.py: group spans by trace_id, build children lists by parent_id, and print recursively with indentation, duration and tokens. Mark spans with status error.",
      },
      {
        title: "Aggregate",
        detail: "Across all traces compute total and p95 duration per span name, and total tokens per span name. Sort descending. The top rows are your optimisation targets.",
      },
      {
        title: "Fix one thing and measure",
        detail: "Apply one fix to the top offender — parallelise independent tool calls with asyncio.gather, add a timeout, cut retrieved context, or cache a repeated tool call — re-run the 10 questions and record the new numbers.",
      },
    ],
    hints: [
      "If child spans show up as separate traces, you are losing context — check that the span is opened inside the parent's with-block, including in async code.",
      "Take token counts from the API response usage object, not from estimating string length.",
      "Durations of sibling spans that sum to less than the parent reveal untraced work (JSON parsing, prompt building, network waits).",
    ],
    stretch: "Export the same spans to a local Jaeger or Arize Phoenix instance via OTLP and compare its waterfall view with your printed tree.",
    learned: [
      "How parent ids and context propagation build a trace tree",
      "Which attributes make an LLM span useful for debugging and cost analysis",
      "Finding latency and token hot spots from data instead of guessing",
      "Verifying a performance fix with before/after measurements",
    ],
    starter: {
      title: "print_tree.py",
      lang: "python",
      code: `import json
from collections import defaultdict

spans = [json.loads(l) for l in open("traces.jsonl") if l.strip()]
by_trace = defaultdict(list)
for s in spans:
    by_trace[s["trace_id"]].append(s)

def show(span: dict, children: dict, depth: int = 0) -> None:
    tokens = span["attrs"].get("output_tokens", "")
    flag = " ERROR" if span.get("status") == "error" else ""
    print("  " * depth + f"{span['name']:<22} {span['duration_ms']:>8.1f} ms {tokens}{flag}")
    for child in sorted(children[span["span_id"]], key=lambda c: c["start"]):
        show(child, children, depth + 1)

for trace_id, group in by_trace.items():
    children = defaultdict(list)
    roots = []
    for s in group:
        (children[s["parent_id"]] if s["parent_id"] else roots).append(s)
    print("trace", trace_id[:8])
    for root in roots:
        show(root, children)
    print()`,
    },
  },
];
