import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Code bodies are written flush-left starting on the line after the backtick. */
const code = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "python-for-js-devs",
    title: "Python for a JavaScript engineer",
    week: 2,
    domain: "backend",
    skills: ["python"],
    difficulty: "easy",
    minutes: 75,
    summary: "The Python you need for backend and AI work, mapped onto the JavaScript you already know.",
    tags: ["python", "javascript", "venv", "comprehensions", "idioms"],
    lesson: {
      hook: p(
        "You can build a full Next.js app in a weekend. Then you open a PyTorch notebook or a FastAPI repo and suddenly you are googling how to loop over an object.",
        "The good news: you do not need to learn programming again. About 80% of Python maps one-to-one onto things you already do in TypeScript. The other 20% (indentation, truthiness, mutable defaults, virtual environments, comprehensions) is where JS developers trip.",
        "This lesson is the translation table, plus the handful of Python-only ideas that every AI codebase uses."
      ),
      whyItMatters:
        "Almost every AI library (PyTorch, Hugging Face, LangChain, the official LLM SDKs, FastAPI) is Python-first. Fluent Python is the entry ticket to the rest of this curriculum.",
      levels: {
        l1: "Python is a general-purpose language like JavaScript, but it uses indentation instead of curly braces and favours one obvious way to do things. Its data types map closely to JS: lists are arrays, dicts are objects used as maps, and functions are first-class values just like in JS.",
        l2: {
          analogy:
            "Python is JavaScript with the training wheels of a strict style guide welded on. Fewer ways to do the same thing, more batteries in the standard library, and indentation is the syntax.",
          text: "Keep this mapping in your head while you read Python code. When something feels unfamiliar, ask \"what is the JS equivalent?\" first; there usually is one.",
          diagram: {
            type: "compare",
            title: "JavaScript / TypeScript vs Python",
            left: {
              label: "JS / TS",
              points: [
                "const xs = [1, 2, 3]  /  xs.map(x => x * 2)",
                "const user = { name: \"G\" }  /  user.name",
                "null, undefined",
                "npm + package.json + node_modules",
                "async/await on a built-in event loop",
                "try / catch / finally",
              ],
            },
            right: {
              label: "Python",
              points: [
                "xs = [1, 2, 3]  /  [x * 2 for x in xs]",
                "user = {\"name\": \"G\"}  /  user[\"name\"]",
                "None (one value only)",
                "pip or uv + pyproject.toml + a .venv per project",
                "async/await, but you start the loop with asyncio.run",
                "try / except / finally",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**Environments first.** Every project gets its own virtual environment so packages do not leak between projects: `python -m venv .venv` then `source .venv/bin/activate`. Or use `uv` (`uv init`, `uv add fastapi`), which is the closest thing Python has to pnpm. Never `pip install` into the system Python.",
            "**Idioms you will see everywhere:** list and dict comprehensions instead of `map`/`filter`, `enumerate` instead of index loops, `zip` to walk two lists together, tuple unpacking (`a, b = b, a`), f-strings for formatting, `with` blocks for anything that must be closed, and `if __name__ == \"__main__\":` to make a file both importable and runnable.",
            "**Truthiness differs:** empty list, empty dict, empty string, `0` and `None` are all falsy. Unlike JS, `[]` and `{}` are falsy in Python. Use `is None` to test for None, not `== None`."
          ),
          code: [
            {
              title: "The same data transform, Python style",
              lang: "python",
              code: code(`
from collections import Counter
from pathlib import Path

projects = [
    {"name": "IdeaGuard", "stack": ["nextjs", "openai"], "stars": 14},
    {"name": "ZtudyLock", "stack": ["react", "gemini"], "stars": 9},
    {"name": "FabricNest", "stack": ["nextjs", "mongodb"], "stars": 21},
]

# JS: projects.filter(p => p.stars > 10).map(p => p.name)
popular = [p["name"] for p in projects if p["stars"] > 10]

# JS: Object.fromEntries(projects.map(p => [p.name, p.stars]))
stars_by_name = {p["name"]: p["stars"] for p in projects}

# JS: a reduce into a counts object
stack_counts = Counter(tech for p in projects for tech in p["stack"])

for rank, p in enumerate(sorted(projects, key=lambda p: p["stars"], reverse=True), start=1):
    print(f"{rank}. {p['name']:<12} {p['stars']:>3} stars")

print(popular, stars_by_name, stack_counts.most_common(2), sep="\\n")
Path("report.txt").write_text(", ".join(popular), encoding="utf-8")
`),
            },
          ],
        },
        l4: {
          text: p(
            "**Everything is a reference to an object.** Variables are names bound to objects, exactly like JS object references. Assignment never copies. `b = a` for a list means both names point at the same list.",
            "**Default arguments are evaluated once**, when the function is defined, not on each call. A mutable default like `def f(xs=[])` is shared across every call, the single most famous Python bug. Use `None` and create the list inside.",
            "**CPython** compiles your file to bytecode (`.pyc`) and runs it on a stack-based interpreter. Every object carries a reference count; memory is freed when it hits zero, with a cycle collector for reference loops. The **GIL** (global interpreter lock) means only one thread runs Python bytecode at a time in the default build, which is why CPU-heavy Python uses processes or native libraries (NumPy, PyTorch release the GIL inside C/CUDA code) and I/O-heavy Python uses async. Python 3.13+ ships an optional free-threaded build, but the ecosystem default is still the GIL."
          ),
          code: [
            {
              title: "The mutable default argument bug",
              lang: "python",
              variant: "bad",
              code: code(`
def add_tag(tag: str, tags: list[str] = []) -> list[str]:
    tags.append(tag)
    return tags

print(add_tag("ai"))       # ['ai']
print(add_tag("backend"))  # ['ai', 'backend']  <- shared list!
`),
            },
            {
              title: "The fix",
              lang: "python",
              variant: "good",
              code: code(`
def add_tag(tag: str, tags: list[str] | None = None) -> list[str]:
    tags = [] if tags is None else list(tags)
    tags.append(tag)
    return tags

print(add_tag("ai"))       # ['ai']
print(add_tag("backend"))  # ['backend']
`),
            },
          ],
        },
        l5: {
          question: "A teammate's FastAPI endpoint sometimes returns data from a previous request. The handler calls a helper `def build_filters(extra, filters={})`. What is going on and how do you fix and prevent it?",
          hint: "When is a default argument created?",
          answer: p(
            "Default argument values are evaluated once at function definition time, so the `filters` dict is a single object shared by every call that does not pass it. Each request mutates the same dict, so filters from one request leak into the next, which is both a correctness bug and potentially a data-leak security issue across users.",
            "The fix is `filters: dict | None = None` and creating a fresh dict inside the function. To prevent it, enable a linter rule for it (Ruff's B006 from the flake8-bugbear set flags mutable defaults) and run Ruff in CI.",
            "I would also add a regression test that calls the helper twice and asserts the second result is unaffected by the first."
          ),
        },
      },
      commonMistakes: [
        "Installing packages globally instead of in a per-project `.venv`, then hitting version conflicts between projects.",
        "Using a mutable default argument (`def f(x=[])`).",
        "Expecting `[]` or `{}` to be truthy like in JavaScript. In Python they are falsy.",
        "Writing `for i in range(len(xs))` and indexing, instead of `for x in xs` or `enumerate(xs)`.",
      ],
      tryThis: "Run `python -c \"import this\"` and read the Zen of Python. Two of those lines explain most Python style decisions you will see in code review.",
      miniTask: {
        title: "Port a JS utility to idiomatic Python",
        kind: "code",
        minutes: 30,
        steps: [
          "Create a project folder, run `python -m venv .venv` (or `uv init`) and activate it.",
          "Pick a small utility you have written in JS (e.g. grouping items by category, slugifying titles, or summing cart totals from FabricNest).",
          "Rewrite it in Python using at least one comprehension, `enumerate` or `zip`, and an f-string.",
          "Add type hints to the function signature and a `if __name__ == \"__main__\":` block that runs an example.",
          "Run it and check the output matches the JS version.",
        ],
        checklist: [
          "My project has its own virtual environment",
          "The function uses a comprehension instead of a manual append loop",
          "No mutable default arguments",
          "Output matches the original JS utility for the same input",
        ],
        deliverable: "A single typed Python file that runs with `python file.py` and mirrors a JS utility.",
      },
      quiz: [
        {
          q: "What does `bool([])` return in Python?",
          options: ["True", "False", "None", "It raises an error"],
          answer: 1,
          explain: "Empty containers are falsy in Python, unlike JavaScript where [] is truthy.",
        },
        {
          q: "Which is the Python equivalent of `xs.filter(x => x > 0).map(x => x * 2)`?",
          options: [
            "[x * 2 for x in xs if x > 0]",
            "[x > 0 for x * 2 in xs]",
            "map(xs, x * 2).filter(x > 0)",
            "{x * 2: x > 0 for x in xs}",
          ],
          answer: 0,
          explain: "A list comprehension with an if clause filters, and the expression at the front maps.",
        },
        {
          q: "Why does CPU-bound pure-Python code not speed up with threads in standard CPython?",
          options: [
            "Python has no threads",
            "The GIL lets only one thread execute Python bytecode at a time",
            "Threads are always slower than processes",
            "Because of reference counting only",
          ],
          answer: 1,
          explain: "The GIL serialises bytecode execution. Use processes, native libraries or the free-threaded build for CPU parallelism.",
        },
      ],
      explainPrompt: "Explain to a JavaScript developer the three Python differences most likely to cause bugs, with one example each, in five sentences.",
      implementPrompt: "From memory, write a Python function that groups a list of dicts by a key into a dict of lists, using type hints and no mutable defaults.",
      videos: [
        {
          title: "Python for JavaScript developers",
          channel: "freeCodeCamp",
          url: "https://www.youtube.com/results?search_query=python+for+javascript+developers",
          kind: "search",
          reason: "Watch this if you prefer a guided side-by-side syntax tour before writing your own code.",
        },
        {
          title: "Python code smells / idiomatic Python",
          channel: "ArjanCodes",
          url: "https://www.youtube.com/results?search_query=arjancodes+python+code+smells",
          kind: "search",
          reason: "Watch this once the syntax feels fine and you want your Python to look like a Python developer wrote it.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "python-types-pydantic",
    title: "Types, dataclasses & Pydantic",
    week: 2,
    domain: "backend",
    skills: ["python", "data-modeling"],
    difficulty: "medium",
    minutes: 75,
    summary: "Type hints for your editor, dataclasses for your own objects, Pydantic for anything that crosses a boundary.",
    prerequisites: ["python-for-js-devs"],
    tags: ["python", "typing", "pydantic", "dataclasses", "validation"],
    lesson: {
      hook: p(
        "In IdeaGuard you asked an LLM for JSON and got back `{\"score\": \"8/10\"}` instead of a number. The TypeScript type said `score: number`, the compiler was happy, and the bug reached production anyway.",
        "That is the key lesson: **types are promises the compiler checks; validation is proof at runtime**. TypeScript types vanish at runtime, and so do Python type hints. Something has to check data that arrives from the outside world.",
        "In TS you reached for Zod. In Python, that tool is Pydantic, and FastAPI, the OpenAI SDK and most LLM structured-output libraries are built on it."
      ),
      whyItMatters:
        "Every request body, LLM structured output, config file and tool-call argument in Cortex will pass through a Pydantic model. Getting this right is how AI apps stop crashing on bad data.",
      levels: {
        l1: "Type hints are labels that say what kind of data a variable should hold; your editor uses them but Python ignores them at runtime. A dataclass is a quick way to define a simple object with named fields. Pydantic models look similar but actually check and convert incoming data, and raise a clear error when it is wrong.",
        l2: {
          analogy:
            "Type hints are the labels on moving boxes. A dataclass is a box with labelled compartments. Pydantic is the customs officer at the border who opens every box, checks the contents match the label, and either converts them (\"8\" becomes 8) or rejects the shipment with a list of problems.",
          text: "Use the right tool at the right layer. Trusted data inside your own code can use plain types and dataclasses. Untrusted data crossing a boundary (HTTP bodies, LLM outputs, env vars, files) goes through Pydantic.",
          diagram: {
            type: "flow",
            title: "Where validation lives",
            lanes: [
              {
                label: "No validation",
                tone: "bad",
                steps: [
                  { label: "LLM / HTTP JSON", note: "{\"score\": \"8/10\"}" },
                  { label: "dict passed around", note: "hope it is right" },
                  { label: "Crash deep in logic", note: "TypeError far from cause", accent: true },
                ],
              },
              {
                label: "Validate at the boundary",
                tone: "good",
                steps: [
                  { label: "LLM / HTTP JSON", note: "untrusted" },
                  { label: "Pydantic model", note: "coerce or reject", accent: true },
                  { label: "Typed object", note: "safe everywhere after" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Type hints:** `list[str]`, `dict[str, int]`, `str | None`, `Literal[\"draft\", \"ready\"]`. Run a checker (`mypy` or `pyright`, which powers VS Code's Pylance) to get TypeScript-like feedback. At runtime they do nothing.",
            "**Dataclasses** (`@dataclass`) generate `__init__`, `__repr__` and `__eq__` for you. `frozen=True` makes instances immutable, `slots=True` saves memory. No validation: `Point(x=\"oops\")` is accepted.",
            "**Pydantic v2** models (`BaseModel`) validate on construction, coerce sensible inputs in the default lax mode (\"42\" to 42), and give structured errors. Key API: `Model.model_validate(dict)`, `Model.model_validate_json(str)`, `obj.model_dump()`, `obj.model_dump_json()`, `Field(...)` for constraints, `@field_validator` for custom rules, and `Model.model_json_schema()`, which is exactly what you send to an LLM as a structured-output schema."
          ),
          code: [
            {
              title: "Validate an LLM's structured output",
              lang: "python",
              code: code(`
# pip install pydantic
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator


class IdeaVerdict(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    score: int = Field(ge=0, le=10)
    risk: Literal["low", "medium", "high"]
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalise_tags(cls, tags: list[str]) -> list[str]:
        return sorted({t.strip().lower() for t in tags if t.strip()})


good = IdeaVerdict.model_validate_json(
    '{"title": "AI resume coach", "score": "8", "risk": "low", "tags": ["AI", " ai ", "Career"]}'
)
print(good)  # score coerced to 8, tags deduplicated

try:
    IdeaVerdict.model_validate({"title": "x", "score": "8/10", "risk": "extreme"})
except ValidationError as exc:
    for err in exc.errors():
        print(err["loc"], err["msg"])
`),
              note: "Three separate errors come back at once: title too short, score not an int, risk not an allowed literal.",
            },
            {
              title: "Dataclass for trusted internal data",
              lang: "python",
              code: code(`
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Chunk:
    doc_id: str
    index: int
    text: str
    metadata: dict[str, str] = field(default_factory=dict)


c = Chunk(doc_id="doc-1", index=0, text="Cortex answers with citations.")
print(c, c == Chunk("doc-1", 0, "Cortex answers with citations."))
`),
            },
          ],
        },
        l4: {
          text: p(
            "Python stores annotations on the function or class (`__annotations__`, read via `typing.get_type_hints`). The interpreter never enforces them. Tools like mypy read them statically; libraries like Pydantic and FastAPI read them **at runtime** to build behaviour, which is why FastAPI can turn `def create(note: NoteIn)` into request validation.",
            "Pydantic v2's core is written in Rust (`pydantic-core`). When a model class is created, Pydantic walks its annotations and compiles a **core schema**, a tree of validators, once. Validating data then runs that compiled tree in Rust, which is why v2 is several times faster than v1. `model_json_schema()` serialises the same schema as JSON Schema.",
            "`@dataclass` works differently: it is a class decorator that generates Python source for `__init__` and friends and `exec`s it when the class is defined. No schema, no runtime checks, near-zero overhead."
          ),
          code: [
            {
              title: "The JSON Schema you would send to an LLM",
              lang: "python",
              code: code(`
import json
from typing import Literal

from pydantic import BaseModel, Field


class Citation(BaseModel):
    doc_id: str
    quote: str = Field(description="Exact sentence from the source")


class Answer(BaseModel):
    answer: str
    confidence: Literal["low", "medium", "high"]
    citations: list[Citation]


print(json.dumps(Answer.model_json_schema(), indent=2))
`),
              note: "Nested models become $defs references. This is the schema Cortex will use for cited answers in month 3.",
            },
          ],
        },
        l5: {
          question: "You call an LLM with a JSON schema and 2% of responses fail validation. How do you design the parsing layer so the product stays reliable?",
          hint: "Think about strictness, retries, error feedback and observability.",
          answer: p(
            "I would define the expected output as a Pydantic model and validate every response at the boundary with `model_validate_json`, never passing raw dicts deeper into the app.",
            "On a validation failure, I would retry once or twice, feeding the `ValidationError` messages back to the model so it can correct the specific fields, and I would use the provider's native structured-output or JSON mode to reduce failures in the first place. Lax coercion handles harmless drift like \"8\" versus 8, while `Literal` and field constraints reject real nonsense.",
            "If retries fail, the endpoint returns a controlled error or a safe fallback instead of a 500. I would log every failure with the raw output and the error locations so I can track the rate over time and fix the prompt or schema, and I would add failing examples to an eval set."
          ),
        },
      },
      commonMistakes: [
        "Believing type hints validate data at runtime. They do not; only something like Pydantic does.",
        "Passing raw `dict`s from `response.json()` deep into business logic instead of validating once at the edge.",
        "Using Pydantic v1 APIs (`.dict()`, `.parse_obj()`, `@validator`) in v2 code. Use `model_dump`, `model_validate`, `@field_validator`.",
        "Forgetting `@classmethod` under `@field_validator`, or forgetting to return the value from a validator.",
      ],
      tryThis: "Add `model_config = ConfigDict(strict=True)` to `IdeaVerdict` and rerun the good example. Watch \"8\" stop being accepted as an int.",
      miniTask: {
        title: "Model a Cortex document",
        kind: "code",
        minutes: 30,
        steps: [
          "Create a Pydantic model `DocumentIn` with `title` (3 to 200 chars), `source_url` (optional `HttpUrl`), `content` (non-empty) and `tags` (list of lowercase strings).",
          "Add a `field_validator` that strips whitespace from `title`.",
          "Write three valid and three invalid JSON strings and validate each with `model_validate_json`.",
          "Print `exc.errors()` for the invalid ones and read the `loc` and `msg` fields.",
          "Print `DocumentIn.model_json_schema()`.",
        ],
        checklist: [
          "Valid inputs produce model instances with clean fields",
          "Each invalid input fails with an error pointing at the right field",
          "I used Pydantic v2 APIs only",
          "I can explain the difference between this model and a dataclass",
        ],
        deliverable: "A Python file with the model, six test inputs and printed results.",
      },
      quiz: [
        {
          q: "What happens at runtime with `def f(x: int): return x` when you call `f(\"hello\")`?",
          options: ["TypeError", "It returns \"hello\"", "It returns 0", "SyntaxError"],
          answer: 1,
          explain: "Plain type hints are not enforced at runtime; only static checkers or libraries like Pydantic use them.",
        },
        {
          q: "Which Pydantic v2 method parses a JSON string directly into a model?",
          options: ["Model.parse_raw", "Model.model_validate_json", "Model.from_json", "json.loads(Model)"],
          answer: 1,
          explain: "`model_validate_json` is the v2 API and avoids a separate json.loads step.",
        },
        {
          q: "When should you prefer a dataclass over a Pydantic model?",
          options: [
            "For HTTP request bodies",
            "For LLM outputs",
            "For trusted internal data where validation overhead is unnecessary",
            "Never; dataclasses are deprecated",
          ],
          answer: 2,
          explain: "Validate at boundaries with Pydantic; inside your own code, lightweight dataclasses are fine.",
        },
      ],
      explainPrompt: "Explain to a junior engineer the difference between a type hint, a dataclass and a Pydantic model, and when to use each, in five sentences.",
      implementPrompt: "From memory, write a Pydantic v2 model for an LLM answer with citations, including one Field constraint and one field_validator.",
      videos: [
        {
          title: "Pydantic v2 tutorial",
          channel: "ArjanCodes",
          url: "https://www.youtube.com/results?search_query=arjancodes+pydantic",
          kind: "search",
          reason: "Watch this if you want to see Pydantic models, validators and settings used in a realistic codebase.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "async-python",
    title: "Async Python & the event loop",
    week: 2,
    domain: "backend",
    skills: ["python", "async-concurrency"],
    difficulty: "medium",
    minutes: 80,
    summary: "asyncio for someone who already knows the JavaScript event loop, and the one mistake that freezes FastAPI.",
    prerequisites: ["python-for-js-devs"],
    tags: ["python", "asyncio", "event-loop", "concurrency", "fastapi"],
    lesson: {
      hook: p(
        "Cortex needs to call an embedding API for 50 document chunks. Sequentially, at 300 ms each, that is 15 seconds. The user has already closed the tab.",
        "In JavaScript you would reach for `Promise.all` without thinking. Python has the exact same idea, `asyncio.gather`, and the same single-threaded event loop underneath.",
        "But Python has one trap JS mostly hides from you: blocking calls. One `time.sleep` or `requests.get` inside an `async def` freezes every other request on the server."
      ),
      whyItMatters:
        "LLM apps are I/O-bound: they spend almost all their time waiting on model APIs, vector databases and Postgres. Async is how one FastAPI process serves hundreds of those waits at once.",
      levels: {
        l1: "Async code lets a program start a slow task, like a network call, and do other work while it waits instead of standing still. Python's asyncio runs many such tasks on one thread by switching between them every time one is waiting.",
        l2: {
          analogy:
            "One barista (the event loop) taking orders. They start the espresso machine (await an API call) and take the next order instead of staring at the machine. If the barista instead hand-grinds beans for five minutes (a blocking call), the whole queue stops.",
          text: p(
            "It is the same model as Node: one thread, one loop, cooperative scheduling. A coroutine runs until it hits `await` on something not ready, then hands control back to the loop.",
            "Concurrency, not parallelism: tasks overlap their **waiting**, not their CPU work."
          ),
          diagram: {
            type: "cycle",
            title: "The asyncio event loop",
            center: "Event loop (1 thread)",
            steps: [
              { label: "Pick a ready task", note: "from the ready queue" },
              { label: "Run until await", note: "coroutine yields" },
              { label: "Register I/O wait", note: "socket, timer" },
              { label: "Poll the OS", note: "epoll / kqueue", accent: true },
              { label: "Wake finished tasks", note: "back to ready queue" },
            ],
          },
        },
        l3: {
          text: p(
            "`async def` defines a coroutine function; calling it returns a coroutine object that does nothing until awaited or scheduled (unlike a JS promise, which starts immediately). `asyncio.run(main())` starts the loop at the entry point. `asyncio.gather(*coros)` runs them concurrently, like `Promise.all`. `asyncio.create_task` schedules one to start now. `asyncio.Semaphore` limits concurrency, which you need to respect API rate limits.",
            "Python 3.11+ also has `asyncio.TaskGroup` for structured concurrency (if one task fails, the others are cancelled) and `asyncio.timeout()` for deadlines.",
            "**The golden rule:** inside `async def`, only await async libraries (`httpx.AsyncClient`, `asyncpg`, `redis.asyncio`). For unavoidable blocking or CPU work, use `await asyncio.to_thread(fn, *args)`. In FastAPI, a plain `def` route is run in a threadpool automatically, so a blocking library in a `def` route is safe; the same library in an `async def` route blocks the loop."
          ),
          code: [
            {
              title: "50 fake embedding calls: sequential vs concurrent with a limit",
              lang: "python",
              code: code(`
import asyncio
import random
import time


async def embed(chunk: str) -> list[float]:
    await asyncio.sleep(0.3)  # stands in for an HTTP call to an embedding API
    return [random.random() for _ in range(4)]


async def sequential(chunks: list[str]) -> list[list[float]]:
    return [await embed(c) for c in chunks]


async def concurrent(chunks: list[str], limit: int = 10) -> list[list[float]]:
    sem = asyncio.Semaphore(limit)  # respect provider rate limits

    async def guarded(c: str) -> list[float]:
        async with sem:
            return await embed(c)

    return await asyncio.gather(*(guarded(c) for c in chunks))


async def main() -> None:
    chunks = [f"chunk {i}" for i in range(50)]
    for fn in (sequential, concurrent):
        start = time.perf_counter()
        vectors = await fn(chunks)
        print(f"{fn.__name__:<10} {len(vectors)} vectors in {time.perf_counter() - start:.2f}s")


asyncio.run(main())
`),
              note: "Sequential takes about 15s, concurrent with limit 10 about 1.5s. Results from gather keep input order.",
            },
            {
              title: "Blocking the loop inside FastAPI",
              lang: "python",
              variant: "bad",
              code: code(`
import time
from fastapi import FastAPI

app = FastAPI()

@app.get("/slow")
async def slow() -> dict[str, str]:
    time.sleep(2)  # blocks the ONLY event-loop thread: every other request waits
    return {"status": "done"}
`),
            },
            {
              title: "Non-blocking version",
              lang: "python",
              variant: "good",
              code: code(`
import asyncio
from fastapi import FastAPI

app = FastAPI()

@app.get("/slow")
async def slow() -> dict[str, str]:
    await asyncio.sleep(2)  # yields to the loop; other requests keep flowing
    return {"status": "done"}
`),
              note: "If you must call a blocking library, either make the route a plain def or wrap the call in await asyncio.to_thread(...).",
            },
          ],
        },
        l4: {
          text: p(
            "Coroutines are built on generators. `await x` suspends the coroutine and passes control up the chain to the event loop, which is literally a `while` loop: run everything in the ready queue, then ask the OS selector (`epoll` on Linux, `kqueue` on macOS) which sockets are ready, with a timeout set by the nearest scheduled timer, and move the matching callbacks back into the ready queue.",
            "A **Task** wraps a coroutine and drives it step by step with `coro.send(None)`. When the coroutine awaits a **Future** that is not done, the task attaches a callback to that future and gets out of the way. When the socket becomes readable, the future's result is set, the callback schedules the task again, and it resumes exactly where it left off.",
            "That is why a blocking call is so damaging: the loop can only switch at an `await`. `time.sleep(2)` never yields, so the `while` loop is stuck for two seconds and no other task, including health checks, can run."
          ),
          code: [
            {
              title: "Prove the loop is single-threaded",
              lang: "python",
              code: code(`
import asyncio
import threading
import time


async def ticker() -> None:
    for i in range(5):
        print(f"tick {i} on {threading.current_thread().name}")
        await asyncio.sleep(0.2)


async def main() -> None:
    task = asyncio.create_task(ticker())
    await asyncio.sleep(0.3)
    print("blocking for 1s...")
    time.sleep(1)  # watch the ticks stop
    print("unblocked")
    await task


asyncio.run(main())
`),
            },
          ],
        },
        l5: {
          question: "Your async FastAPI service has fine average latency, but under load p99 spikes to several seconds and even /health times out. CPU is at 100% on one core. What is your hypothesis and how do you confirm and fix it?",
          hint: "What can stop a single-threaded loop from switching tasks?",
          answer: p(
            "My hypothesis is that something is blocking the event loop: a synchronous library call (like `requests`, a sync DB driver, or a sync LLM SDK) or CPU-heavy work (parsing a large PDF, tokenising, JSON on huge payloads) inside an `async def` route. While it runs, no other coroutine, including /health, can be scheduled, which explains the tail latency and the single hot core.",
            "To confirm, I would enable asyncio debug mode (`PYTHONASYNCIODEBUG=1`), which logs callbacks that take longer than 100 ms, or profile with py-spy to see which function holds the loop.",
            "The fix is to use async clients (httpx.AsyncClient, asyncpg, redis.asyncio), move unavoidable blocking calls to `asyncio.to_thread` or make that route a plain `def` so FastAPI runs it in its threadpool, and push heavy CPU work to a process pool or a background worker queue. Then I would load-test again and compare p99."
          ),
        },
      },
      commonMistakes: [
        "Calling `requests.get` or `time.sleep` inside `async def`. Use `httpx.AsyncClient` and `asyncio.sleep`.",
        "Forgetting `await`, which returns a coroutine object instead of the result (and a \"coroutine was never awaited\" warning).",
        "Firing 1,000 concurrent API calls with `gather` and no semaphore, instantly hitting provider rate limits (429s).",
        "Expecting async to speed up CPU-bound work. It only overlaps waiting.",
      ],
      tryThis: "In the embedding script, change the semaphore limit to 1, 5, 25 and 50. Predict each runtime before running it (hint: ceil(50 / limit) * 0.3s).",
      miniTask: {
        title: "Concurrent fetch with a rate limit",
        kind: "code",
        minutes: 30,
        steps: [
          "Install httpx in your venv.",
          "Write an async function that fetches `https://httpbin.org/delay/1` with a shared `httpx.AsyncClient`.",
          "Fetch it 10 times sequentially and time it.",
          "Fetch it 10 times with `asyncio.gather` and a `Semaphore(5)` and time it.",
          "Add `asyncio.timeout(5)` around the whole batch and handle `TimeoutError` gracefully.",
        ],
        checklist: [
          "One AsyncClient is created and reused for all requests",
          "Sequential takes about 10s; concurrent with limit 5 about 2s",
          "No blocking calls inside any async def",
          "A timeout is handled without an unhandled exception",
        ],
        deliverable: "A script printing both timings and handling a timeout.",
      },
      quiz: [
        {
          q: "What is the Python equivalent of `await Promise.all([a(), b()])`?",
          options: ["await asyncio.wait_for(a(), b())", "await asyncio.gather(a(), b())", "asyncio.run(a(), b())", "await a() and await b()"],
          answer: 1,
          explain: "`asyncio.gather` schedules both concurrently and returns results in the original order.",
        },
        {
          q: "In FastAPI, you must use a blocking SDK with no async version. Which is correct?",
          options: [
            "Call it directly in an async def route",
            "Make the route a plain def, or wrap the call with asyncio.to_thread",
            "Wrap it in asyncio.gather",
            "Add await in front of the blocking call",
          ],
          answer: 1,
          explain: "Plain def routes run in a threadpool, and to_thread moves the call off the event loop. Awaiting a non-awaitable just raises.",
        },
        {
          q: "When does the asyncio event loop switch to another task?",
          options: [
            "Every 10 ms, preemptively",
            "Only when the running coroutine hits an await on something not yet ready (or finishes)",
            "Whenever a new request arrives",
            "Only when a thread finishes",
          ],
          answer: 1,
          explain: "Scheduling is cooperative. No await, no switch, which is why blocking calls stall everything.",
        },
      ],
      explainPrompt: "Explain to a Node.js developer how Python's asyncio differs from the JS event loop, including why a blocking call in async def is dangerous, in five sentences.",
      implementPrompt: "From memory, write an async function that fetches a list of URLs concurrently with httpx.AsyncClient and a Semaphore of 5, returning status codes in order.",
      videos: [
        {
          title: "Python asyncio explained",
          channel: "mCoding",
          url: "https://www.youtube.com/results?search_query=mcoding+asyncio",
          kind: "search",
          reason: "Watch this if you want to see how coroutines, tasks and the loop fit together under the hood.",
        },
        {
          title: "asyncio in Python: full tutorial",
          channel: "ArjanCodes",
          url: "https://www.youtube.com/results?search_query=arjancodes+asyncio+tutorial",
          kind: "search",
          reason: "Watch this for practical patterns like gather, tasks and converting sync code to async.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "python-cli-json-tool",
    title: "Typed Python CLI for validating JSON",
    week: 2,
    duration: "45m",
    minutes: 45,
    difficulty: "easy",
    domain: "backend",
    skills: ["python", "data-modeling"],
    prerequisites: ["Python for a JavaScript engineer", "Types, dataclasses & Pydantic"],
    topicSlugs: ["python-for-js-devs", "python-types-pydantic"],
    objective: "Build a small, fully type-hinted CLI that reads a JSON file of documents, validates each record with Pydantic, and prints a clean report with a proper exit code.",
    expectedOutput: "Running `python docs_check.py sample.json` prints valid/invalid counts, one line per invalid record with field-level errors, and exits with code 1 if any record is invalid. `--out clean.json` writes only the valid records.",
    steps: [
      {
        title: "Set up the project",
        detail: "Create a folder, a virtual environment (`python -m venv .venv` or `uv init`), and install pydantic. Add mypy (or use Pylance in strict mode) so you get TypeScript-style feedback.",
      },
      {
        title: "Write the model",
        detail: "Define a `Document` Pydantic model: `id` (str, non-empty), `title` (3 to 200 chars), `url` (optional HttpUrl), `content` (non-empty), `tags` (list of str, normalised to lowercase and deduplicated by a field_validator), `created_at` (datetime).",
      },
      {
        title: "Create sample data",
        detail: "Write `sample.json` as a JSON array with at least 6 records: 3 valid and 3 broken in different ways (bad URL, empty content, date as \"yesterday\").",
      },
      {
        title: "Parse arguments with argparse",
        detail: "Accept a positional input path, an optional `--out` path, and a `--quiet` flag. Use `pathlib.Path` for file handling.",
      },
      {
        title: "Validate record by record",
        detail: "Load the file with `json.loads`, check it is a list, then validate each record separately with `Document.model_validate` inside try/except so one bad record does not stop the rest. Collect valid models and (index, errors) pairs.",
      },
      {
        title: "Report and exit correctly",
        detail: "Print a summary line and one line per error using `err['loc']` and `err['msg']`. If `--out` is given, write `[d.model_dump(mode='json') for d in valid]`. Exit with `sys.exit(1)` if anything was invalid, otherwise 0, so the tool works in scripts and CI.",
      },
      {
        title: "Type-check",
        detail: "Run `mypy --strict docs_check.py` (after `pip install mypy`) and fix everything it reports.",
      },
    ],
    hints: [
      "Use `model_dump(mode=\"json\")` so datetimes and URLs serialise as strings.",
      "Handle `json.JSONDecodeError` separately and exit with code 2 for \"not even JSON\".",
      "`err[\"loc\"]` is a tuple like ('tags', 0); join it with dots for a readable path.",
    ],
    stretch: "Add a `--schema` flag that prints `Document.model_json_schema()` and a `--stdin` mode so you can pipe LLM output straight into the validator.",
    learned: [
      "Structuring a small, typed Python program with argparse and pathlib",
      "Validating untrusted records one at a time with Pydantic v2",
      "Reading Pydantic error locations and messages",
      "Using exit codes so tools compose in shells and CI",
    ],
    starter: {
      title: "docs_check.py skeleton",
      lang: "python",
      code: code(`
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field, HttpUrl, ValidationError, field_validator


class Document(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=3, max_length=200)
    url: HttpUrl | None = None
    content: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    created_at: datetime

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, tags: list[str]) -> list[str]:
        return sorted({t.strip().lower() for t in tags if t.strip()})


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a JSON file of documents")
    parser.add_argument("path", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    records = json.loads(args.path.read_text(encoding="utf-8"))
    valid: list[Document] = []
    for i, record in enumerate(records):
        try:
            valid.append(Document.model_validate(record))
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(part) for part in err["loc"])
                print(f"record {i}: {loc}: {err['msg']}")

    print(f"{len(valid)} valid, {len(records) - len(valid)} invalid")
    return 0 if len(valid) == len(records) else 1


if __name__ == "__main__":
    sys.exit(main())
`),
      note: "Runs as-is; the lab steps add --out, --quiet, JSON error handling and strict typing.",
    },
  },
];
