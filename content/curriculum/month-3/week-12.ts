import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "prompt-engineering",
    title: "Prompting as engineering",
    week: 12,
    domain: "ai",
    skills: ["prompting"],
    difficulty: "medium",
    minutes: 60,
    summary: "Treat prompts like code: structured, versioned, tested against a fixed set of cases, and changed one variable at a time.",
    prerequisites: ["next-token-prediction", "sampling-decoding"],
    tags: ["prompting", "few-shot", "evals", "chat-template", "prompt-caching"],
    lesson: {
      hook: p(
        "The IdeaGuard prompt worked perfectly on the ten examples you tried in the playground. In production it mislabels about one request in twelve, and nobody notices until a user screenshots it.",
        "You tweak a sentence, try three examples, it looks better, you ship. A week later a different class of input breaks. You have no idea whether the tweak helped overall.",
        "That is prompting as vibes. Prompting as engineering means the prompt is a versioned artefact with a test suite, and every change is measured.",
      ),
      whyItMatters: "Prompts are the most-edited code in an AI product; an eval-driven workflow is what separates reliable features from demos, and it is the foundation for the evaluation work in later months.",
      levels: {
        l1: "A prompt is the instructions and examples you give the model. Good prompts are clear about the task, the format of the answer, and what to do when unsure. Engineering a prompt means testing it on many real examples and measuring how often it is right, instead of trusting a few lucky tries.",
        l2: {
          text: p(
            "Write the prompt the way you would brief a smart contractor who has never seen your codebase: role and goal, the exact inputs (clearly delimited), the output contract, edge cases, and one or two worked examples.",
            "Then close the loop: a fixed set of cases with expected outputs, a script that runs them, and a score. Every prompt change is a commit that must not lower the score.",
          ),
          analogy: "It is test-driven development where the \"function\" is a paragraph of English. You would never ship a regex after testing it on three strings; do not ship a prompt that way either.",
          diagram: {
            type: "cycle",
            title: "The prompt engineering loop",
            center: "measure every change",
            steps: [
              { label: "Collect real failures", note: "from logs and users" },
              { label: "Add them to the eval set", note: "input + expected output" },
              { label: "Change one thing", note: "instruction, example, format", accent: true },
              { label: "Run evals", note: "score + diff of failures" },
              { label: "Ship if no regressions", note: "version the prompt" },
            ],
          },
        },
        l3: {
          text: p(
            "Concrete techniques that reliably help: put instructions in the system message; wrap untrusted input in delimiters like `<feedback>...</feedback>`; give the model an explicit way out (\"if unsure, return other\"); show a few examples that cover the tricky cases; specify the exact output format; and use temperature 0 for classification.",
            "The code below shows the full pattern with the OpenAI Python SDK (any chat API works the same way): a versioned prompt, few-shot examples as prior turns, and a tiny eval harness that prints accuracy and every failure.",
          ),
          code: [
            {
              title: "Vague prompt, no tests",
              lang: "python",
              variant: "bad",
              code: `prompt = "Classify this feedback: " + text   # which labels? what format? what if it's mixed?
label = call_llm(prompt)                      # "This appears to be a bug report."
if label == "bug":                            # never true: the model answered in prose
    create_ticket(text)`,
              note: "No label set, no output contract, no delimiter around user text, and no way to know how often it fails.",
            },
            {
              title: "Versioned prompt with few-shot examples and an eval harness",
              lang: "python",
              variant: "good",
              code: `# pip install openai   (reads OPENAI_API_KEY from the environment)
import os
from openai import OpenAI

client = OpenAI()
MODEL = os.environ.get("MODEL", "gpt-4o-mini")
PROMPT_VERSION = "classify-feedback@3"
SYSTEM = """You classify user feedback for a study-timer app.
Return exactly one label: bug, feature_request, praise, or other.
If feedback mixes several, choose the one the user most wants acted on.
If you are unsure, return other. Reply with the label only."""
FEW_SHOT = [
    {"role": "user", "content": "<feedback>App crashes when I upload a PDF</feedback>"},
    {"role": "assistant", "content": "bug"},
    {"role": "user", "content": "<feedback>Great app! Wish it had dark mode though</feedback>"},
    {"role": "assistant", "content": "feature_request"},
]

def classify(text: str) -> str:
    resp = client.chat.completions.create(
        model=MODEL, temperature=0,
        messages=[{"role": "system", "content": SYSTEM}, *FEW_SHOT,
                  {"role": "user", "content": f"<feedback>{text}</feedback>"}],
    )
    return resp.choices[0].message.content.strip().lower()

CASES = [("Login button does nothing on Safari", "bug"), ("Please add CSV export", "feature_request"),
         ("Honestly the best study app I've used", "praise"), ("How much is the pro plan?", "other"),
         ("Love it, but it logs me out every hour", "bug")]
results = [(t, want, classify(t)) for t, want in CASES]
print(PROMPT_VERSION, f"accuracy={sum(w == g for _, w, g in results) / len(results):.0%}")
for t, want, got in results:
    if want != got:
        print("FAIL", repr(t), "want", want, "got", got)`,
              note: "Five cases is a demo. A real eval set for a feature like this has 50–200 cases, mostly drawn from production failures.",
            },
          ],
        },
        l4: {
          text: p(
            "**Messages are just tokens.** The API flattens system, user and assistant messages into one sequence using the model's chat template — special role tokens around each message — then runs next-token prediction from the start of the assistant turn. The system prompt has no special power beyond where it sits and how the model was fine-tuned to treat it.",
            "**Why few-shot works.** Transformers are strong pattern-continuers: attention heads (such as induction heads) find earlier examples that resemble the current input and copy their structure. That is also why examples overpower instructions — if your examples all have short answers, you get short answers regardless of what the instructions say. Cover the edge cases in the examples, and vary them.",
            "**Position matters.** Models attend most reliably to the beginning and end of the context; facts buried in the middle of long contexts are recalled worse (\"lost in the middle\"). Put the task instructions and the question near the end, after long documents.",
            "**Prompt caching.** Providers cache the KV state of a prompt prefix they have seen recently and bill those tokens at a discount. Structure prompts as **static first, dynamic last**: system prompt, tool definitions and few-shot examples, then per-request content. Putting a timestamp or user name at the very top silently disables the cache.",
          ),
          code: [
            {
              title: "See the exact tokens a chat request becomes",
              lang: "python",
              code: `# pip install transformers
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
messages = [
    {"role": "system", "content": "You are Cortex. Answer only from the provided sources."},
    {"role": "user", "content": "What is a KV cache?"},
]
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
print(text)                                    # role markers like <|im_start|>system ... <|im_end|>
print(len(tok(text).input_ids), "tokens, including template overhead")`,
              note: "Hosted APIs do the same thing server-side. Your \"messages\" array is a convenience; the model sees one string.",
            },
          ],
        },
        l5: {
          question: "Your LLM feature works about 90% of the time. How would you systematically get it to 99%?",
          hint: "Data before prompt edits. What would you measure, and in what order would you try fixes?",
          answer: p(
            "First I would stop editing and build an eval set: pull a few hundred real inputs from logs, label the expected outputs, and deliberately include every failure users reported. I would write a script that scores the current prompt so I have a baseline, and categorise failures — format errors, wrong label on ambiguous inputs, missing context, instruction conflicts.",
            "Then I would fix by category, one change at a time, re-running the full set to catch regressions: tighten the output contract or move to structured outputs for format errors; add targeted few-shot examples for the confusable cases; add an explicit \"unsure\" path; supply missing context via retrieval; and set temperature to 0 for deterministic tasks.",
            "If a category resists prompting, I would change the system rather than the prose: split the task into two calls, use a stronger model only for hard cases, add a validation-and-retry step, or route low-confidence outputs to a human. Throughout, prompts are versioned in git and the eval runs in CI, so 99% is a measured number rather than a feeling.",
          ),
        },
      },
      commonMistakes: [
        "Iterating on a prompt against the same three examples you wrote it for — that is overfitting, and it guarantees surprises in production.",
        "Concatenating user input into instructions without delimiters, which invites prompt injection and confuses the model about what is data.",
        "Instructions that contradict the few-shot examples; the examples usually win.",
        "Putting dynamic content (dates, user IDs) at the start of the prompt, which defeats prefix caching and raises cost.",
      ],
      tryThis: "Take a prompt you shipped in IdeaGuard or Ideako. Write 20 realistic inputs, including 5 nasty edge cases, and score it honestly. Most people find their \"working\" prompt is at 70–85%.",
      miniTask: {
        title: "Put a real prompt under test",
        kind: "build",
        minutes: 45,
        steps: [
          "Pick one prompt from a project you have shipped (or use the feedback classifier).",
          "Write 15 test cases with expected outputs; at least 5 must be edge cases or past failures.",
          "Adapt the l3 harness to your prompt and record the baseline accuracy with the prompt version string.",
          "Make exactly one change (an instruction, an example or the output format), re-run, and record the new score and which cases flipped.",
          "Commit both prompt versions and the results to git.",
        ],
        checklist: [
          "I have a baseline score for a real prompt",
          "I made a single, isolated change and measured its effect",
          "I know which specific cases improved and which regressed",
          "Prompt text and eval cases live in version control",
        ],
        deliverable: "A small repo folder with `prompt_v1`, `prompt_v2`, `cases.json`, the harness and a two-line results log.",
      },
      quiz: [
        {
          q: "Why do few-shot examples often override written instructions?",
          options: [
            "APIs weight assistant messages more heavily",
            "Transformers are strong pattern-continuers and copy the structure of examples in context",
            "Instructions are truncated first",
            "Examples are processed by a separate model",
          ],
          answer: 1,
          explain: "In-context learning copies patterns from examples; if examples and instructions disagree, the pattern tends to win.",
        },
        {
          q: "To benefit from provider prompt caching, how should a prompt be ordered?",
          options: [
            "Dynamic user content first, static instructions last",
            "Static content (system prompt, tools, examples) first, dynamic content last",
            "Alphabetically by section",
            "Order does not matter for caching",
          ],
          answer: 1,
          explain: "Caches match on an identical prefix; anything that changes per request must come after the stable part.",
        },
        {
          q: "What is the most important first step when a prompt fails 10% of the time?",
          options: [
            "Switch to a larger model",
            "Raise the temperature",
            "Build a labelled eval set from real inputs and failures to measure a baseline",
            "Rewrite the prompt in all capital letters",
          ],
          answer: 2,
          explain: "Without a baseline and a fixed test set you cannot tell whether any change helps or just moves failures around.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why prompts should be versioned and evaluated like code, and name three techniques that reliably improve prompts.",
      implementPrompt: "From memory, write a prompt eval harness: a list of (input, expected) cases, a function calling an LLM, an accuracy score and a printed list of failures tagged with the prompt version.",
      videos: [
        {
          title: "Prompt engineering in practice",
          channel: "Anthropic",
          url: "https://www.youtube.com/results?search_query=anthropic+prompt+engineering+deep+dive",
          kind: "search",
          reason: "Watch this to hear how people who write prompts for frontier models every day think about clarity, examples and testing.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "structured-outputs",
    title: "Structured outputs & JSON schemas",
    week: 12,
    domain: "ai",
    skills: ["structured-outputs", "llm-apis"],
    difficulty: "medium",
    minutes: 75,
    summary: "Get typed, schema-valid data out of an LLM: JSON schemas, constrained decoding, validation and retry — and what each actually guarantees.",
    prerequisites: ["prompt-engineering", "sampling-decoding"],
    tags: ["json-schema", "pydantic", "zod", "constrained-decoding", "citations"],
    lesson: {
      hook: p(
        "It is 2 a.m. and FabricNest's product-tagging job has crashed. The model returned \"Sure! Here is the JSON you asked for:\" followed by the JSON wrapped in a Markdown code fence. `JSON.parse` threw on the first character.",
        "You add a regex to strip the fence. Next week it returns `\"price\": \"about 499\"` instead of a number, and the week after it invents a field called `colour` when your schema says `color`.",
        "LLM output is text. Your code needs types. Structured outputs are the bridge, and knowing exactly what each technique guarantees is the difference between a pipeline that runs for months and one that pages you.",
      ),
      whyItMatters: "Every LLM feature that feeds code — extraction, tool calls, citations in Cortex, classification — depends on reliable structure; this is where AI output meets your type system.",
      levels: {
        l1: "Instead of asking the model for a paragraph, you give it a precise form to fill in — field names, types and allowed values. Modern APIs can force the model to follow that form exactly. You still check the answers make sense, because a perfectly filled form can still contain wrong information.",
        l2: {
          text: p(
            "There is a ladder of guarantees. Asking nicely in the prompt guarantees nothing. **JSON mode** guarantees syntactically valid JSON, but any shape. **Strict schema mode** (or function calling with strict schemas) guarantees the JSON matches your schema. **Validation** in your code catches what schemas cannot express: business rules and facts.",
            "You want to be on the top rung with a validator underneath — and a retry path for the rare failure.",
          ),
          analogy: "A paper form vs a web form with dropdowns and required fields. The web form cannot receive \"about 499\" in a number field — but it will happily accept a wrong phone number, so you still verify.",
          diagram: {
            type: "flow",
            title: "Parsing prose vs enforcing a schema",
            lanes: [
              {
                label: "Prompt and pray",
                tone: "bad",
                steps: [
                  { label: "\"Return JSON please\"" },
                  { label: "Free text", note: "prose, fences, wrong keys" },
                  { label: "Regex + JSON.parse" },
                  { label: "Crash at 2 a.m.", note: "or silent bad data" },
                ],
              },
              {
                label: "Schema-first",
                tone: "good",
                steps: [
                  { label: "Pydantic / Zod schema" },
                  { label: "Strict JSON schema", note: "constrained decoding", accent: true },
                  { label: "Validate + business rules" },
                  { label: "Retry with the error", note: "max 2–3 attempts" },
                  { label: "Typed object" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "Define the shape once as a Pydantic model (Zod on the TypeScript side), generate the JSON schema from it, send it as `response_format` with `strict: true`, and parse the response back into the model. For strict mode, every field must be required and objects must forbid extra keys — `extra=\"forbid\"` produces `additionalProperties: false`. Model optional values as `str | None` rather than defaults.",
            "Then validate what the schema cannot: here, that every cited `source_id` actually exists in the sources you sent. If validation fails, send the error back to the model and retry — models fix their own mistakes well when told exactly what was wrong.",
            "In Next.js the equivalent is a Zod schema with the OpenAI SDK's `zodResponseFormat` helper or the Vercel AI SDK's `generateObject`.",
          ),
          code: [
            {
              title: "Answer with validated citations: schema, strict mode, retry",
              lang: "python",
              code: `import os
from typing import Literal
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, ValidationError

class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str
    quote: str

class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str
    citations: list[Citation]
    confidence: Literal["high", "medium", "low"]

client = OpenAI()
SCHEMA = {"name": "answer", "strict": True, "schema": Answer.model_json_schema()}

def ask(question: str, sources: dict[str, str], attempts: int = 3) -> Answer:
    context = "\\n".join(f"<source id='{sid}'>{text}</source>" for sid, text in sources.items())
    messages = [
        {"role": "system", "content": "Answer only from the sources. Cite the ids you used with exact quotes."},
        {"role": "user", "content": f"{context}\\n\\nQuestion: {question}"},
    ]
    for _ in range(attempts):
        resp = client.chat.completions.create(
            model=os.environ.get("MODEL", "gpt-4o-mini"), temperature=0, messages=messages,
            response_format={"type": "json_schema", "json_schema": SCHEMA},
        )
        raw = resp.choices[0].message.content or ""
        try:
            ans = Answer.model_validate_json(raw)
            unknown = [c.source_id for c in ans.citations if c.source_id not in sources]
            if unknown:
                raise ValueError(f"cited unknown source ids {unknown}; valid ids are {list(sources)}")
            return ans
        except (ValidationError, ValueError) as err:
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": f"Invalid output: {err}. Return corrected JSON."}]
    raise RuntimeError("no valid answer after retries")`,
              note: "The schema guarantees shape; the `unknown` check guarantees the citations point at real sources. You need both.",
            },
          ],
        },
        l4: {
          text: p(
            "**Constrained decoding.** Strict schema modes work by masking logits. The schema is compiled into a grammar (a finite-state machine or pushdown automaton). At every decoding step the engine computes which vocabulary tokens could legally come next, sets every other logit to −∞, and samples from what remains. Invalid JSON becomes literally impossible to generate. Open-source engines include Outlines, XGrammar and llguidance; vLLM and llama.cpp expose the same idea.",
            "The tricky part is that tokens do not align with grammar symbols: one token may contain `\"},{\"` spanning several grammar steps. Engines precompute, for each grammar state, a mask over the whole vocabulary — often using a trie of token strings, this week's DSA pattern — so masking stays fast.",
            "**What it cannot guarantee.** Truth, obviously. It also cannot prevent truncation (check `finish_reason == \"length\"`), refusals (a separate `refusal` field in some APIs), or schema features the provider does not support. And **field order matters**: tokens are generated left to right, so put a `reasoning` field before `answer` if you want the model to think first, and never put the conclusion before the evidence.",
          ),
          code: [
            {
              title: "Toy constrained decoding with a trie of allowed token sequences",
              lang: "python",
              code: `import numpy as np

VOCAB = {0: "pos", 1: "itive", 2: "neg", 3: "ative", 4: "neutral", 5: "maybe", 6: "<eos>"}
LABELS = [[0, 1], [2, 3], [4]]          # "positive", "negative", "neutral" as token ids
EOS = 6

def build_trie(seqs):
    root = {}
    for seq in seqs:
        node = root
        for t in seq:
            node = node.setdefault(t, {})
        node[EOS] = {}                  # a complete label may end here
    return root

def constrained_decode(next_logits, trie):
    node, out = trie, []
    while True:
        logits = next_logits(out)
        mask = np.full(len(VOCAB), -np.inf)
        mask[list(node)] = 0.0          # only children of the current trie node are legal
        tok = int(np.argmax(logits + mask))
        if tok == EOS:
            return "".join(VOCAB[t] for t in out)
        out.append(tok)
        node = node[tok]

rng = np.random.default_rng(3)
random_model = lambda prefix: rng.normal(size=len(VOCAB))   # stands in for a real LM
print([constrained_decode(random_model, build_trie(LABELS)) for _ in range(6)])
# every output is a valid label, even though the "model" is pure noise`,
            },
          ],
        },
        l5: {
          question: "Compare prompt-only JSON, JSON mode, strict schema outputs, function calling and parse-and-retry. What does each guarantee, and what would you use in production?",
          hint: "Separate syntactic validity, schema validity and semantic correctness. Then think about failure modes that still exist.",
          answer: p(
            "Prompt-only JSON guarantees nothing; it works most of the time and fails in creative ways. JSON mode guarantees syntactically valid JSON but not your keys or types. Strict schema outputs use constrained decoding, so the output conforms to the supported subset of JSON Schema — right keys, types and enums. Function or tool calling with strict schemas is the same mechanism applied to tool arguments. Parse-and-retry is provider-agnostic and works with any model, at the cost of extra latency and tokens on failure.",
            "None of them guarantee semantic correctness: a schema-valid object can contain a hallucinated citation or a salary of 10 when the text said 10 LPA. Constrained outputs can also be truncated by `max_tokens` or replaced by a refusal.",
            "In production I would define the schema once (Pydantic or Zod), use strict mode where the provider supports it, validate business rules in code, check `finish_reason` and refusals, and retry once or twice with the validation error in the conversation. I would log every validation failure — they are the best eval cases you will ever get.",
          ),
        },
      },
      commonMistakes: [
        "Trusting schema-valid output as correct. Cross-check IDs, quotes and numbers against the source data.",
        "Ignoring `finish_reason == \"length\"`: a truncated structured response is either invalid or, worse, valid but incomplete.",
        "Putting `answer` before `reasoning` in the schema, so the model commits to a conclusion before generating the reasoning.",
        "Using optional fields with defaults in strict mode — providers typically require every property to be listed as required; represent optionality as `type | None`.",
      ],
      tryThis: "Print `Answer.model_json_schema()` from the l3 code. Find `additionalProperties`, `required`, the `$defs` entry for Citation and the `enum` for confidence — that JSON is exactly what constrains the model.",
      miniTask: {
        title: "Typed answers with real citations",
        kind: "code",
        minutes: 45,
        steps: [
          "Create three short sources (paragraphs from your own notes) with ids like `notes#1`.",
          "Run the l3 `ask` function with a question that needs two of the sources.",
          "Print the parsed `Answer` and confirm every `source_id` is valid and every quote appears verbatim in its source.",
          "Add a check that each quote is a substring of its source; feed failures into the retry path.",
          "Force a failure (e.g. ask a question the sources do not answer) and observe how confidence and citations behave.",
        ],
        checklist: [
          "Output parses into a typed Pydantic object every time",
          "Invalid source ids trigger a retry with a specific error message",
          "Quotes are verified against the source text",
          "I checked `finish_reason` and handled truncation",
        ],
        deliverable: "`cited_answer.py` returning a validated `Answer` object, plus one logged example of a retry being triggered.",
      },
      quiz: [
        {
          q: "What does JSON mode (without a schema) guarantee?",
          options: [
            "Output matches your schema",
            "Output is syntactically valid JSON, with no guarantee about keys or types",
            "Output is factually correct",
            "Output is never truncated",
          ],
          answer: 1,
          explain: "JSON mode only constrains syntax. Schema adherence needs strict schema mode or validation.",
        },
        {
          q: "How does constrained decoding prevent invalid output?",
          options: [
            "It retries until the output parses",
            "It fine-tunes the model on the schema",
            "It masks the logits of tokens that would violate the grammar at each step",
            "It post-processes the output with a regex",
          ],
          answer: 2,
          explain: "Illegal tokens get −∞ logits, so they have zero probability and can never be sampled.",
        },
        {
          q: "Why should a `reasoning` field come before `answer` in a schema?",
          options: [
            "JSON requires alphabetical order",
            "Tokens are generated left to right, so the answer can then be conditioned on the reasoning",
            "It reduces token cost",
            "Providers reject schemas where answer comes first",
          ],
          answer: 1,
          explain: "Generation is autoregressive: whatever comes first cannot depend on what comes later.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences the difference between JSON mode, strict schema outputs and validation, and why Cortex needs all of them for citations.",
      implementPrompt: "From memory, write a Pydantic schema for an answer with citations, call an LLM with strict JSON schema output, validate cited IDs and retry once with the validation error.",
      videos: [
        {
          title: "Structured outputs and constrained generation",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+structured+outputs+constrained+decoding+json",
          kind: "search",
          reason: "Watch a conference talk if you want to see how production teams use structured outputs at scale and where they still fail.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "streaming-llm-responses",
    title: "Streaming LLM responses end-to-end",
    week: 12,
    domain: "ai",
    skills: ["streaming", "ai-ux"],
    difficulty: "medium",
    minutes: 90,
    summary: "Stream tokens from the model through FastAPI as Server-Sent Events, proxy them through a Next.js route handler, and render them in React — with cancellation that actually stops the bill.",
    prerequisites: ["next-token-prediction", "structured-outputs"],
    tags: ["sse", "fastapi", "nextjs", "readablestream", "abortcontroller", "ttft"],
    lesson: {
      hook: p(
        "Cortex takes 9 seconds to write a full answer. Without streaming, the user stares at a spinner for 9 seconds and assumes it is broken. With streaming, the first words appear in 400 ms and the same 9 seconds feels fast.",
        "The model already generates one token at a time (last week). Streaming just stops hiding that from the user.",
        "The catch: bytes now travel through four layers — model API, FastAPI, Next.js, React — and any one of them can buffer, break a UTF-8 character in half, or keep generating (and billing) after the user has closed the tab.",
      ),
      whyItMatters: "Streaming is table stakes for AI UX: it cuts perceived latency to time-to-first-token, and getting cancellation and buffering right saves real money and support tickets.",
      levels: {
        l1: "Instead of waiting for the whole answer and sending it at once, the server sends each small piece as soon as the model produces it. The browser shows the pieces as they arrive, so the answer seems to type itself. If the user clicks stop, the whole chain should stop, including the model.",
        l2: {
          text: p(
            "One HTTP response that stays open. The server writes small **events** into it over time; the client reads them as they arrive. Server-Sent Events (SSE) is the simple text format for those events: lines starting with `data:`, each event ended by a blank line.",
            "Cortex's pipeline: the model API streams chunks to FastAPI; FastAPI re-emits them as SSE; a Next.js route handler proxies the stream (keeping the API key and backend URL server-side); a React hook reads the stream and appends text to state.",
          ),
          analogy: "A live cricket commentary feed instead of the newspaper the next morning. Same match, but you get each ball as it happens — and if you switch off the radio, the broadcaster should stop spending on your channel.",
          diagram: {
            type: "flow",
            title: "Cortex streaming path",
            lanes: [
              {
                tone: "good",
                steps: [
                  { label: "LLM API", note: "stream=True chunks" },
                  { label: "FastAPI", note: "StreamingResponse, text/event-stream", accent: true },
                  { label: "Next.js route handler", note: "proxies the body, forwards abort" },
                  { label: "React hook", note: "ReadableStream reader, parse events" },
                  { label: "UI", note: "text appears token by token" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Backend.** A FastAPI `StreamingResponse` wraps an async generator. Each `yield` writes one SSE event. Send typed events — `token`, `usage`, `done`, `error` — rather than raw text, so the client can tell content from metadata. Check `request.is_disconnected()` and close the upstream stream when the client leaves.",
            "**Proxy.** A Next.js route handler can return the upstream `Response.body` directly — no need to parse. Passing `req.signal` to `fetch` propagates the user's abort to FastAPI.",
            "**Client.** `fetch` + `res.body.pipeThrough(new TextDecoderStream()).getReader()`. Network chunks do not line up with events, so keep a buffer, split on the blank line, and keep the incomplete tail for the next read. `EventSource` is simpler but only supports GET without a body or custom headers, so POST + fetch is the usual choice for chat.",
          ),
          code: [
            {
              title: "FastAPI: stream tokens as typed SSE events",
              lang: "python",
              code: `# pip install fastapi uvicorn openai   |   run: uvicorn main:app --reload
import json
import os
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

app = FastAPI()
client = AsyncOpenAI()

class Ask(BaseModel):
    question: str

def sse(event: str, data: dict) -> str:
    return f"event: {event}\\ndata: {json.dumps(data)}\\n\\n"

@app.post("/ask")
async def ask(body: Ask, request: Request):
    async def events():
        stream = await client.chat.completions.create(
            model=os.environ.get("MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": body.question}],
            stream=True,
            stream_options={"include_usage": True},       # final chunk carries token counts
        )
        try:
            async for chunk in stream:
                if await request.is_disconnected():
                    return                                  # user left: stop generating
                if chunk.choices and chunk.choices[0].delta.content:
                    yield sse("token", {"text": chunk.choices[0].delta.content})
                if chunk.usage:
                    yield sse("usage", {"input": chunk.usage.prompt_tokens, "output": chunk.usage.completion_tokens})
            yield sse("done", {})
        except Exception as err:                            # headers already sent: report in-band
            yield sse("error", {"message": str(err)})
        finally:
            await stream.close()                            # releases the upstream connection

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})`,
            },
            {
              title: "Next.js route handler: app/api/ask/route.ts",
              lang: "typescript",
              code: `export const runtime = "nodejs";

export async function POST(req: Request) {
  const { question } = await req.json();

  const upstream = await fetch(process.env.CORTEX_API_URL + "/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal: req.signal, // browser abort -> cancels the FastAPI request
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", { status: 502 });
  }

  // pass the byte stream straight through; do not await or parse it here
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}`,
            },
            {
              title: "React: consume the stream with a hook",
              lang: "typescript",
              code: `"use client";
import { useRef, useState } from "react";

type Status = "idle" | "streaming" | "done" | "error";

export function useStreamingAnswer() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setText("");
    setStatus("streaming");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split("\\n\\n");
        buffer = events.pop() ?? ""; // incomplete event: wait for more bytes
        for (const raw of events) {
          const event = raw.match(/^event: (.*)$/m)?.[1] ?? "message";
          const data = raw.split("\\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\\n");
          if (event === "token") setText((t) => t + JSON.parse(data).text);
          if (event === "error") throw new Error(JSON.parse(data).message);
        }
      }
      setStatus("done");
    } catch (err) {
      setStatus((err as Error).name === "AbortError" ? "idle" : "error");
    }
  }

  return { text, status, ask, stop: () => abortRef.current?.abort() };
}`,
              note: "`TextDecoderStream` handles multi-byte characters split across chunks, so Tamil text and emoji never render as broken glyphs.",
            },
          ],
        },
        l4: {
          text: p(
            "**The wire format.** SSE is `Content-Type: text/event-stream` over a normal HTTP response, sent with chunked transfer encoding on HTTP/1.1 (or as DATA frames on HTTP/2). Each event is a few `field: value` lines — `event`, `data`, `id`, `retry` — terminated by an empty line. Multiple `data:` lines in one event are joined with newlines, and a space after the colon is optional per the spec. Lines starting with `:` are comments, often used as keep-alive pings.",
            "**Buffering is the enemy.** Anything between server and browser may hold bytes until a buffer fills: nginx (`proxy_buffering`; FastAPI's `X-Accel-Buffering: no` header disables it per response), compression middleware (gzip waits for more data), some CDNs, and code that accidentally `await`s the full body. Symptom: everything arrives at once at the end. Test with `curl -N` against each layer to find the one that buffers.",
            "**Errors after the first byte.** Once headers are sent the status is 200 and cannot change. Mid-stream failures must travel in-band as an `error` event, and the client must handle them.",
            "**Cancellation.** User clicks stop → `AbortController.abort()` → the browser closes the connection → Next.js's `req.signal` fires and aborts its upstream fetch → FastAPI sees the disconnect → you close the model stream. Miss any link and the model keeps generating tokens nobody will read, and you pay for every one.",
            "**Metrics.** Track **time to first token** (dominated by queueing and prompt prefill) separately from **tokens per second** (decode speed). They have different causes and different fixes.",
          ),
          code: [
            {
              title: "What the bytes on the wire look like",
              lang: "text",
              code: `HTTP/1.1 200 OK
content-type: text/event-stream
cache-control: no-cache
x-accel-buffering: no
transfer-encoding: chunked

event: token
data: {"text": "A KV"}

event: token
data: {"text": " cache stores"}

event: usage
data: {"input": 812, "output": 164}

event: done
data: {}
`,
              note: "Run curl -N -X POST localhost:8000/ask -H 'Content-Type: application/json' -d '{\"question\":\"hi\"}' to see this live. -N disables curl's own buffering.",
            },
          ],
        },
        l5: {
          question: "A user closes the tab halfway through a long streamed answer. Walk through what happens in a FastAPI → Next.js → browser stack, and how you make sure you stop paying for tokens.",
          hint: "Trace the abort signal through every hop, and think about what each layer does if it never notices.",
          answer: p(
            "When the tab closes, the browser tears down the TCP (or HTTP/2 stream) connection to the Next.js route. In the route handler, `req.signal` fires; because I passed it to the upstream `fetch`, that request to FastAPI is aborted and its connection closes.",
            "In FastAPI, the ASGI server notices the disconnect; the next write fails or `request.is_disconnected()` returns true. My generator breaks out of the loop and, in `finally`, closes the model API stream. Closing the HTTP connection to the provider is what stops generation and billing on their side.",
            "The failure modes are each missing link: not forwarding the signal in the proxy, so FastAPI keeps streaming into a dead socket until the answer finishes; a generator that never checks for disconnects and does not close the upstream stream; or a background task that detached generation from the request entirely. I would verify it end-to-end with a test that aborts after a few tokens and asserts from logs that the usage event shows far fewer output tokens than a full answer. I would also record partial answers and their usage so cost accounting stays accurate for cancelled requests.",
          ),
        },
      },
      commonMistakes: [
        "Awaiting the full upstream body in the Next.js route (`await upstream.text()`), which silently turns streaming back into one big response.",
        "Splitting network chunks on newlines and calling `JSON.parse` on each piece — chunks do not align with events; buffer until the blank line.",
        "Decoding each chunk with a fresh `TextDecoder` (or without `{ stream: true }`), which corrupts characters split across chunks.",
        "Not propagating aborts, so cancelled requests keep generating and billing to the end.",
        "Enabling gzip or leaving proxy buffering on in front of the SSE endpoint, so tokens arrive in one burst at the end.",
      ],
      tryThis: "Run the FastAPI endpoint and hit it with `curl -N`. Then run the same command without `-N` and compare. Then put the Next.js proxy in front and check it still streams.",
      miniTask: {
        title: "Stream one answer through three layers",
        kind: "build",
        minutes: 60,
        steps: [
          "Run the FastAPI snippet with uvicorn and confirm events stream with `curl -N`.",
          "Add the Next.js route handler to any Next app with `CORTEX_API_URL=http://localhost:8000` in `.env.local`.",
          "Build a tiny page with a textarea, an Ask button, a Stop button and the `useStreamingAnswer` hook.",
          "Measure time to first token in the browser with `performance.now()` around the first `token` event.",
          "Click Stop mid-answer and confirm in the FastAPI logs that generation stopped early.",
        ],
        checklist: [
          "Tokens render progressively in the UI, not all at once",
          "Stop cancels the request at every layer (visible in server logs)",
          "The usage event arrives and I can print input/output token counts",
          "Non-English text and emoji render correctly mid-stream",
        ],
        deliverable: "A working local stream from FastAPI to a Next.js page with a Stop button and a logged TTFT measurement.",
      },
      quiz: [
        {
          q: "What terminates a single Server-Sent Event?",
          options: ["A closing brace", "An empty line (two consecutive newlines)", "The word END", "Closing the HTTP connection"],
          answer: 1,
          explain: "Fields are lines like `data: ...`; a blank line dispatches the event.",
        },
        {
          q: "Why do chat UIs usually use fetch + ReadableStream instead of the browser's EventSource?",
          options: [
            "EventSource cannot parse JSON",
            "EventSource only supports GET requests without a body or custom headers",
            "EventSource is not supported in modern browsers",
            "fetch streams are always faster",
          ],
          answer: 1,
          explain: "Chat requests need POST bodies and often auth headers; EventSource supports neither.",
        },
        {
          q: "Tokens reach the browser all at once at the end instead of progressively. The most likely cause is:",
          options: [
            "The model does not support streaming",
            "A buffering layer such as a proxy, compression middleware, or awaiting the full body",
            "The temperature is too low",
            "SSE requires HTTP/3",
          ],
          answer: 1,
          explain: "The model streams; something in between is holding the bytes. Use curl -N at each hop to find it.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences how Cortex streams an answer from the model to the browser and what must happen when the user clicks Stop.",
      implementPrompt: "From memory, write a FastAPI SSE endpoint that streams typed events and a React function that reads a POST response stream, buffers partial events and appends token text to state.",
      videos: [
        {
          title: "Server-Sent Events crash course",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+server+sent+events",
          kind: "search",
          reason: "Watch this if you want the HTTP-level picture of SSE vs WebSockets vs long polling before debugging a buffering issue.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "kv-cache-inference-cost",
    title: "KV cache & the cost of inference",
    week: 12,
    domain: "ai",
    skills: ["kv-cache", "inference"],
    difficulty: "hard",
    minutes: 75,
    summary: "Why output tokens cost more than input tokens, why long chats slow down, and how the KV cache, prefill/decode split and prompt caching shape every LLM bill.",
    prerequisites: ["self-attention", "next-token-prediction", "streaming-llm-responses"],
    tags: ["kv-cache", "prefill", "decode", "prompt-caching", "cost", "gqa"],
    lesson: {
      hook: p(
        "Look at almost any LLM pricing page: output tokens cost several times more than input tokens. Reading is cheap, writing is expensive. Why would a model charge differently for the same token?",
        "And why does a Cortex conversation that started snappy get slower and pricier with every turn, even though each new question is short?",
        "Both answers come from one data structure sitting in GPU memory: the KV cache. Understand it and you can predict latency, cost and capacity from first principles — and design prompts that are cheaper.",
      ),
      whyItMatters: "Inference cost and latency are the constraints that shape every AI product decision; the KV cache explains pricing, context limits, prompt caching discounts and why self-hosting is harder than it looks.",
      levels: {
        l1: "When a model writes an answer, each new word needs to look back at everything before it. Rather than re-reading the whole conversation from scratch for every word, the model saves its notes about earlier words in memory and reuses them. Those saved notes are the KV cache. They make generation much faster, but they take up a lot of memory.",
        l2: {
          text: p(
            "In attention, each new token's query is compared with the keys of all previous tokens, and blends their values. Past tokens' keys and values never change (the causal mask guarantees it). So compute them once, store them, and for each new token only compute its own Q, K, V and append.",
            "Inference therefore has two phases. **Prefill**: process the whole prompt in one parallel pass and fill the cache — this sets time to first token. **Decode**: generate one token per step, reading the entire cache each time — this sets tokens per second.",
          ),
          analogy: "Taking minutes in a long meeting. Without notes, every time someone speaks you would replay the whole recording from the start. With notes, you just read your notes and add one line — but the notebook keeps getting thicker.",
          diagram: {
            type: "flow",
            title: "Generating token t",
            lanes: [
              {
                label: "No cache",
                tone: "bad",
                steps: [
                  { label: "All t tokens" },
                  { label: "Recompute Q, K, V for every token", note: "O(t) projections per step" },
                  { label: "Attention" },
                  { label: "1 new token", note: "total work grows ~t² per answer" },
                ],
              },
              {
                label: "KV cache",
                tone: "good",
                steps: [
                  { label: "Newest token only" },
                  { label: "Compute its q, k, v", note: "append k, v to the cache", accent: true },
                  { label: "Attend over cached K, V" },
                  { label: "1 new token", note: "cache grows by one row per layer" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "The toy below implements one attention layer twice: recomputing everything each step, and with a cache that stores K and V and only processes the newest token. The outputs are identical — the cache is a pure optimisation, not an approximation.",
            "On the API side, the numbers you pay for are in the response's usage block: prompt (input) tokens, cached input tokens (OpenAI exposes `usage.prompt_tokens_details.cached_tokens`; other providers have equivalents), and completion (output) tokens. Log them per request — that is the Cortex cost accounting for this month.",
          ),
          code: [
            {
              title: "A KV cache in 30 lines: same output, far less work",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)
d = 64
W_q, W_k, W_v = (rng.normal(size=(d, d)) / np.sqrt(d) for _ in range(3))

def softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()

def step_without_cache(X):                 # X: (t, d), the whole prefix, every step
    Q, K, V = X @ W_q, X @ W_k, X @ W_v    # recomputes K, V for all t tokens
    w = softmax(K @ Q[-1] / np.sqrt(d))    # only the newest query matters
    return w @ V

class KVCache:
    def __init__(self):
        self.K, self.V = [], []

def step_with_cache(x_t, cache):           # x_t: (d,), just the newest token
    q, k, v = x_t @ W_q, x_t @ W_k, x_t @ W_v
    cache.K.append(k)
    cache.V.append(v)
    K, V = np.stack(cache.K), np.stack(cache.V)   # (t, d) each, read from memory
    w = softmax(K @ q / np.sqrt(d))
    return w @ V

X = rng.normal(size=(12, d))
cache = KVCache()
for t in range(len(X)):
    assert np.allclose(step_with_cache(X[t], cache), step_without_cache(X[: t + 1]))
print("identical outputs; cache holds", len(cache.K), "keys and values")`,
            },
            {
              title: "Per-request cost accounting",
              lang: "python",
              code: `from dataclasses import dataclass

# USD per 1M tokens. Placeholders: copy current numbers from your provider's pricing page.
PRICES = {
    "small": {"input": 0.15, "cached_input": 0.075, "output": 0.60},
    "large": {"input": 2.50, "cached_input": 1.25, "output": 10.00},
}

@dataclass
class Usage:
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int

def cost_usd(model: str, u: Usage) -> float:
    p = PRICES[model]
    uncached = u.input_tokens - u.cached_input_tokens
    return (uncached * p["input"] + u.cached_input_tokens * p["cached_input"]
            + u.output_tokens * p["output"]) / 1_000_000

# a Cortex answer: 6k-token prompt (4k of it a cached system prompt), 500-token answer
u = Usage(input_tokens=6000, cached_input_tokens=4000, output_tokens=500)
for m in PRICES:
    print(m, f"{cost_usd(m, u):.5f} USD", f"(x10k requests/day = {cost_usd(m, u) * 10_000 * 30:.2f} USD/month)")`,
            },
          ],
        },
        l4: {
          text: p(
            "**Cache size.** Per token, every layer stores one key and one value vector per KV head: `2 × n_layers × n_kv_heads × head_dim × bytes`. For a Llama-3-8B-like config (32 layers, 8 KV heads via GQA, head_dim 128, fp16) that is 128 KiB per token — 1 GiB for a single 8k-token conversation. Thirty-two concurrent 8k chats need 32 GiB of cache on top of ~15 GiB of weights. Memory, not compute, caps how many users one GPU can serve.",
            "**Why output costs more.** Prefill processes all prompt tokens in parallel with big matrix multiplies — the GPU is compute-bound and efficient. Decode produces one token per step, and each step must stream all the weights plus the whole KV cache from GPU memory to compute a tiny amount of math — it is memory-bandwidth-bound. A GPU with ~2 TB/s bandwidth reading ~16 GB of weights manages on the order of 100 decode steps per second for one sequence. Providers batch many users per step to amortise that, but each output token still occupies scarce GPU time and cache memory for the whole response. Hence higher output prices.",
            "**Why long chats slow down.** Each turn resends the full history, so prefill grows, and each decode step attends over a longer cache. Cost per turn grows with conversation length unless you summarise or truncate.",
            "**Tricks you will meet.** GQA/MQA shrink the cache by sharing K/V heads. PagedAttention (vLLM) stores the cache in fixed-size blocks like OS virtual memory to avoid fragmentation. Quantised KV caches (fp8/int8) halve memory. **Prompt caching** keeps the KV cache for a repeated prefix across requests — which is why providers bill cached input tokens at a steep discount, and why static-first prompt ordering matters.",
          ),
          code: [
            {
              title: "KV-cache memory calculator",
              lang: "python",
              code: `GiB = 1024 ** 3

def kv_cache_bytes(n_layers, n_kv_heads, head_dim, seq_len, batch=1, bytes_per_value=2):
    return 2 * n_layers * n_kv_heads * head_dim * seq_len * batch * bytes_per_value  # 2 = K and V

# Llama-3-8B-like: 32 layers, 8 KV heads (GQA), head_dim 128, fp16 (2 bytes)
print(kv_cache_bytes(32, 8, 128, 1) // 1024, "KiB per token")                      # 128
print(kv_cache_bytes(32, 8, 128, 8192) / GiB, "GiB for one 8k conversation")       # 1.0
print(kv_cache_bytes(32, 32, 128, 8192) / GiB, "GiB if every head kept its own K/V")  # 4.0
print(kv_cache_bytes(32, 8, 128, 8192, batch=32) / GiB, "GiB for 32 users at 8k")  # 32.0
print(8e9 * 2 / GiB, "GiB of fp16 weights, for comparison")                        # ~14.9`,
            },
          ],
          diagram: {
            type: "compare",
            title: "The two phases of inference",
            left: {
              label: "Prefill (your prompt)",
              points: [
                "All prompt tokens processed in parallel",
                "Compute-bound: large matmuls, efficient",
                "Fills the KV cache",
                "Drives time to first token",
                "Cheaper per token; cached prefixes cheaper still",
              ],
            },
            right: {
              label: "Decode (the answer)",
              points: [
                "One token per step, sequential",
                "Memory-bandwidth-bound: reads weights + cache each step",
                "Appends one K/V row per layer per token",
                "Drives tokens per second",
                "More expensive per token",
              ],
            },
          },
        },
        l5: {
          question: "Why are output tokens priced higher than input tokens, and why do long conversations get slower and more expensive per turn? What would you do about it in Cortex?",
          hint: "Prefill vs decode, what each step has to read from memory, and what gets resent every turn.",
          answer: p(
            "Input tokens are processed in one parallel prefill pass, which is compute-bound and uses the GPU efficiently. Output tokens are generated one per decode step, and every step must read all model weights and the growing KV cache from memory to produce a single token per sequence; that is memory-bandwidth-bound, so each output token consumes far more GPU time and holds cache memory for the whole response. Pricing reflects that.",
            "Long chats get worse because chat APIs are stateless: every turn resends the whole history, so prefill work and billed input tokens grow each turn, and every decode step attends over a longer context, lowering tokens per second.",
            "For Cortex I would keep the system prompt, tool definitions and instructions as a stable prefix so provider prompt caching applies; retrieve only the top few chunks rather than whole documents; summarise or trim old turns past a budget; cap `max_tokens` and ask for concise answers since output is the expensive side; route simple questions to a smaller model; and log input, cached and output tokens per request so I can see which of these actually moves the bill.",
          ),
        },
      },
      commonMistakes: [
        "Assuming a bigger context window is free. Every extra token in the prompt is billed on every request and slows time to first token.",
        "Estimating self-hosting capacity from weight size alone and forgetting that the KV cache for concurrent users can exceed the weights.",
        "Breaking prompt caching by putting per-request content (timestamps, user names, retrieved chunks) before the static instructions.",
        "Not logging token usage per request, so cost regressions from a prompt change are discovered on the monthly invoice.",
      ],
      tryThis: "Send the same 3,000-token system prompt to your LLM API twice within a minute and compare the cached-token count in the usage block of the two responses.",
      miniTask: {
        title: "Prove the cache and price a conversation",
        kind: "code",
        minutes: 40,
        steps: [
          "Run the KV-cache toy and confirm identical outputs.",
          "Time both versions for 512 tokens with d = 256 and compare.",
          "Use the calculator to find the KV-cache size for a 32k-token context on the Llama-3-8B-like config.",
          "Price a 10-turn Cortex conversation where each turn adds 300 input and 400 output tokens and resends the full history; print cost per turn and total.",
          "Repeat with a 2k-token cached prefix and compare.",
        ],
        checklist: [
          "Cached and uncached attention outputs match",
          "I measured the speedup from caching",
          "I can compute KV-cache memory from a model config",
          "I showed per-turn cost growing across a conversation, and the effect of prefix caching",
        ],
        deliverable: "`inference_cost.py` printing the timing comparison, the memory figure and a per-turn cost table.",
      },
      quiz: [
        {
          q: "What does the KV cache store?",
          options: [
            "The generated text so far",
            "Keys and values of previous tokens for every layer (and KV head)",
            "The query vectors of all tokens",
            "The final logits of each step",
          ],
          answer: 1,
          explain: "Past keys and values never change under a causal mask, so they are computed once and reused. Queries are only needed for the newest token.",
        },
        {
          q: "Decode steps are usually limited by:",
          options: ["Tokenizer speed", "Memory bandwidth", "Network latency to the GPU", "Disk I/O"],
          answer: 1,
          explain: "Each step reads all weights and the cache to compute one token per sequence — little math per byte moved.",
        },
        {
          q: "A model has 32 layers, 8 KV heads, head_dim 128, fp16. How big is the KV cache per token?",
          options: ["16 KiB", "64 KiB", "128 KiB", "1 MiB"],
          answer: 2,
          explain: "2 × 32 × 8 × 128 × 2 bytes = 131,072 bytes = 128 KiB.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences what the KV cache is, the difference between prefill and decode, and why output tokens cost more.",
      implementPrompt: "From memory, implement single-head attention with a KV cache in NumPy and assert it matches the uncached version; then write the KV-cache memory formula as a function.",
      videos: [
        {
          title: "KV cache explained",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+kv+cache+explained",
          kind: "search",
          reason: "Watch this if you want the cache traced through a real Llama implementation, including grouped-query attention.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "structured-extraction-pipeline",
    title: "Structured extraction pipeline",
    week: 12,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "ai",
    skills: ["structured-outputs", "llm-apis", "prompting", "python"],
    prerequisites: ["Structured outputs & JSON schemas", "Prompting as engineering"],
    topicSlugs: ["structured-outputs", "prompt-engineering"],
    objective: "Turn messy, real-world text (job postings) into typed records with a JSON schema, validation, business rules and retry on invalid output — then measure accuracy against hand-labelled answers.",
    expectedOutput: "`extract.py` that processes 15 messy postings into validated `JobPosting` objects, prints per-field accuracy against a gold file, the number of retries triggered, and total tokens and cost.",
    steps: [
      {
        title: "Collect messy inputs",
        detail: "Copy 15 job postings from LinkedIn, Naukri or company career pages into `postings/*.txt`. Deliberately include hard cases: salary in LPA vs per month vs USD, \"remote (India only)\", no salary at all, multiple locations, skills buried in paragraphs.",
      },
      {
        title: "Label a gold set",
        detail: "For 10 postings, hand-write the expected output in `gold.json`. This takes 20 minutes and is the most valuable file in the lab.",
      },
      {
        title: "Define the schema",
        detail: "A Pydantic `JobPosting` with `extra=\"forbid\"`: title, company, locations (list), work_mode (Literal onsite/hybrid/remote), salary_min and salary_max (`float | None`), currency (`Literal[\"INR\", \"USD\", \"EUR\"] | None`), period (`Literal[\"year\", \"month\"] | None`), skills (list of strings). No defaults, so strict mode accepts it.",
      },
      {
        title: "Extract with strict schema output",
        detail: "Call your LLM with `response_format` json_schema strict, temperature 0, and a system prompt that states conversion rules (\"12 LPA means 1,200,000 INR per year\"). Put the posting inside `<posting>` tags.",
      },
      {
        title: "Validate business rules and retry",
        detail: "After parsing, check rules the schema cannot: salary_min ≤ salary_max; both null or both set; every skill appears (case-insensitively) in the source text. On failure, append the model's output and the specific error to the conversation and retry, at most twice. Count retries.",
      },
      {
        title: "Measure",
        detail: "Compare against `gold.json` field by field and print accuracy per field. Sum usage tokens and compute cost with the week's cost function. Write down the two worst fields and one prompt change that fixes them, then re-run.",
      },
    ],
    hints: [
      "Pydantic validators (`@model_validator(mode=\"after\")`) are a clean place for cross-field rules like salary_min ≤ salary_max; the resulting ValidationError message goes straight into the retry prompt.",
      "If a skill check fails because the model normalised \"ReactJS\" to \"React\", decide whether that is a bug or a feature — then encode the decision in the prompt and the validator.",
      "Log the raw model output for every failure to a `failures.jsonl` file; these become regression tests.",
    ],
    stretch: "Port the same pipeline to TypeScript in a Next.js route with a Zod schema, and run both implementations against the same gold file.",
    learned: [
      "Designing strict-mode-compatible schemas",
      "Separating schema validity from semantic validity",
      "Retry loops that feed back specific validation errors",
      "Measuring extraction quality per field instead of eyeballing",
    ],
    starter: {
      title: "extract.py (schema and retry loop)",
      lang: "python",
      code: `import os
from typing import Literal
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

class JobPosting(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    company: str
    locations: list[str]
    work_mode: Literal["onsite", "hybrid", "remote"]
    salary_min: float | None
    salary_max: float | None
    currency: Literal["INR", "USD", "EUR"] | None
    period: Literal["year", "month"] | None
    skills: list[str]

    @model_validator(mode="after")
    def salary_range(self):
        if (self.salary_min is None) != (self.salary_max is None):
            raise ValueError("salary_min and salary_max must both be set or both be null")
        if self.salary_min is not None and self.salary_min > self.salary_max:
            raise ValueError("salary_min must be <= salary_max")
        return self

client = OpenAI()
SCHEMA = {"name": "job_posting", "strict": True, "schema": JobPosting.model_json_schema()}
SYSTEM = "Extract the job posting into the schema. 12 LPA means 1200000 INR per year. Use null when a value is not stated."

def extract(text: str, max_retries: int = 2) -> tuple[JobPosting, int]:
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"<posting>{text}</posting>"}]
    for attempt in range(max_retries + 1):
        resp = client.chat.completions.create(
            model=os.environ.get("MODEL", "gpt-4o-mini"), temperature=0, messages=messages,
            response_format={"type": "json_schema", "json_schema": SCHEMA})
        raw = resp.choices[0].message.content or ""
        try:
            return JobPosting.model_validate_json(raw), attempt
        except ValidationError as err:
            messages += [{"role": "assistant", "content": raw},
                         {"role": "user", "content": f"Invalid: {err}. Return corrected JSON."}]
    raise RuntimeError("extraction failed after retries")`,
    },
  },
  {
    slug: "flagship-v3-streaming",
    title: "Cortex v0.3: streaming answers with citations and cost tracking",
    week: 12,
    duration: "weekend",
    minutes: 720,
    difficulty: "hard",
    domain: "ai",
    skills: ["streaming", "ai-ux", "structured-outputs", "fastapi", "nextjs", "observability"],
    prerequisites: [
      "Streaming LLM responses end-to-end",
      "Structured outputs & JSON schemas",
      "KV cache & the cost of inference",
    ],
    topicSlugs: ["streaming-llm-responses", "structured-outputs", "kv-cache-inference-cost", "prompt-engineering", "embeddings"],
    objective: "Upgrade Cortex so answers stream token by token from FastAPI to the Next.js UI, arrive with validated citations to the user's own documents, and every request logs tokens, cost and latency.",
    expectedOutput: "A deployed (or locally running) Cortex where a question streams an answer in under ~1 s to first token, citation chips link to the source chunks, Stop cancels generation end-to-end, and a `/usage` page or log shows per-request input/cached/output tokens, cost, TTFT and total time.",
    steps: [
      {
        title: "Define the event contract",
        detail: "Write down the SSE events before coding: `token {text}`, `citations {items: [{source_id, doc_title, chunk_id, quote}]}`, `usage {input, cached_input, output, cost_usd}`, `error {message}`, `done {request_id}`. Share one TypeScript type and one Pydantic model per event so both sides agree.",
      },
      {
        title: "Retrieval into the prompt",
        detail: "Reuse Cortex's document store from v0.2 — or, if you don't have one yet, embed chunks of 3–5 of your own documents with all-MiniLM-L6-v2 in memory. Retrieve the top 5 chunks for the question and render them as `<source id=\"S1\">...</source>` blocks after a static system prompt (static first, for prompt caching).",
      },
      {
        title: "Stream the answer from FastAPI",
        detail: "Instruct the model to cite inline with markers like [S1]. Stream `token` events with `stream_options={\"include_usage\": True}`, check `request.is_disconnected()` each chunk, and close the upstream stream in `finally`. Record TTFT (time from request to the first token event) and total time.",
      },
      {
        title: "Structured, validated citations",
        detail: "When the stream ends, parse the accumulated text for [S#] markers, map them to the retrieved chunks, drop any marker that does not exist (log it as a hallucinated citation), and emit a `citations` event with a Pydantic-validated payload. Optionally ask for a short exact quote per source with a strict-schema follow-up call on a small model.",
      },
      {
        title: "Token and cost accounting",
        detail: "From the usage chunk, compute cost with a price table in config. Write one row per request to Postgres (or JSONL for now): request_id, model, prompt_version, input, cached_input, output tokens, cost_usd, ttft_ms, total_ms, cancelled. Emit the `usage` event to the client.",
      },
      {
        title: "Next.js proxy and UI",
        detail: "Route handler that proxies the SSE body and forwards `req.signal`. A `useStreamingAnswer` hook that handles all five events. UI: streaming text with a blinking cursor, a Stop button, citation chips that open the source chunk in a side panel, and a small footer showing tokens, cost and TTFT for that answer.",
      },
      {
        title: "Test and ship",
        detail: "A pytest that calls the endpoint with FastAPI's TestClient and asserts the event order (tokens → citations → usage → done). A manual test that clicking Stop yields a log row with `cancelled = true` and far fewer output tokens. Deploy the API (Render, Fly.io or Railway) and the UI (Vercel) and confirm with `curl -N` that nothing buffers in production.",
      },
    ],
    hints: [
      "Markers can be split across chunks (\"[S\" then \"1]\"), so parse citations from the accumulated full text at the end, not per chunk.",
      "If tokens arrive in one burst only in production, check for gzip or proxy buffering on the host; `X-Accel-Buffering: no` and `Cache-Control: no-transform` usually fix it.",
      "Keep the price table in one config file with a `prices_updated_at` date — prices change, and stale numbers silently corrupt your cost dashboard.",
      "Record `prompt_version` on every usage row now; month 5 evals will thank you.",
    ],
    stretch: "Show citations as they are detected mid-stream (highlight [S1] the moment the closing bracket arrives), and add a per-day cost chart on the `/usage` page with a budget alert when spend exceeds a threshold.",
    learned: [
      "Designing a typed streaming event protocol shared by Python and TypeScript",
      "End-to-end cancellation that actually stops model billing",
      "Validating citations against retrieved sources to catch hallucinated references",
      "Per-request token, cost and latency observability",
    ],
    starter: {
      title: "cortex/citations.py (post-stream citation extraction)",
      lang: "python",
      code: `import re
from pydantic import BaseModel

CITE = re.compile(r"\\[S(\\d+)\\]")

class Chunk(BaseModel):
    source_id: str          # "S1", "S2", ... as shown to the model
    doc_title: str
    chunk_id: int
    text: str

class CitationItem(BaseModel):
    source_id: str
    doc_title: str
    chunk_id: int

def extract_citations(answer: str, retrieved: list[Chunk]) -> tuple[list[CitationItem], list[str]]:
    by_id = {c.source_id: c for c in retrieved}
    seen, items, hallucinated = set(), [], []
    for n in CITE.findall(answer):
        sid = "S" + n
        if sid in seen:
            continue
        seen.add(sid)
        if sid in by_id:
            c = by_id[sid]
            items.append(CitationItem(source_id=sid, doc_title=c.doc_title, chunk_id=c.chunk_id))
        else:
            hallucinated.append(sid)
    return items, hallucinated

chunks = [Chunk(source_id="S1", doc_title="KV cache notes", chunk_id=4, text="..."),
          Chunk(source_id="S2", doc_title="Streaming notes", chunk_id=9, text="...")]
print(extract_citations("Decode is memory-bound [S1]. SSE uses blank lines [S2][S7].", chunks))`,
    },
  },
];
