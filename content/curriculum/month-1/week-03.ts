import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Code bodies are written flush-left starting on the line after the backtick. */
const code = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "fastapi-fundamentals",
    title: "FastAPI: production-shaped APIs",
    week: 3,
    domain: "backend",
    skills: ["fastapi", "api-design"],
    difficulty: "medium",
    minutes: 90,
    summary: "Routes, Pydantic models, dependencies, status codes and lifespan: FastAPI as the Python version of your Express + Zod stack.",
    prerequisites: ["python-types-pydantic", "async-python"],
    tags: ["fastapi", "python", "api", "dependency-injection", "openapi"],
    lesson: {
      hook: p(
        "In Express you write a route, then a Zod schema for the body, then a separate OpenAPI doc that drifts out of date within a week, then middleware to check auth.",
        "FastAPI collapses those into one thing: **the function signature**. Type-hint a parameter as a Pydantic model and you get parsing, validation, a 422 with field errors, and interactive docs at `/docs`, all from the same line.",
        "It is the default backend for AI products in Python, and it is what Cortex will be built on. This lesson gets you from hello-world to a route shape you would not be embarrassed to ship."
      ),
      whyItMatters:
        "Every model you serve, every RAG endpoint and every agent tool server you build in this curriculum is a FastAPI app. Clean route design here compounds for five months.",
      levels: {
        l1: "FastAPI is a Python library for building web APIs. You write normal Python functions, add type hints for the inputs and outputs, and FastAPI turns them into HTTP endpoints that check incoming data and document themselves automatically.",
        l2: {
          analogy:
            "If Express is a bare kitchen where you install every appliance yourself, FastAPI is a kitchen where the recipe card (your type hints) also programs the oven, checks the ingredients and prints the menu.",
          text: p(
            "A request flows through Starlette (the ASGI toolkit underneath), then FastAPI's dependency resolver, then Pydantic validation, and only then reaches your function. Your return value flows back through the `response_model` filter and is serialised to JSON.",
            "If validation fails, your function never runs: FastAPI returns `422 Unprocessable Entity` with the exact fields that were wrong."
          ),
          diagram: {
            type: "flow",
            title: "Life of a FastAPI request",
            lanes: [
              {
                label: "Request path",
                tone: "neutral",
                steps: [
                  { label: "Uvicorn (ASGI server)", note: "HTTP bytes to scope" },
                  { label: "Middleware", note: "CORS, logging" },
                  { label: "Router", note: "match method + path" },
                  { label: "Dependencies", note: "db session, current user" },
                  { label: "Pydantic validation", note: "422 on failure" },
                  { label: "Your handler", note: "business logic", accent: true },
                  { label: "response_model", note: "filter + serialise" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "Parameters are resolved by where they appear: path params from `{note_id}` in the path, query params from simple typed arguments, the body from a Pydantic model argument, and dependencies from `Depends(...)`.",
            "Production habits from day one: separate **input** and **output** models (`NoteCreate` vs `NoteOut`, so you never leak fields like `owner_id` or password hashes), set `status_code` explicitly (201 for create, 204 for delete), raise `HTTPException` for expected errors, and put shared resources (DB pools, HTTP clients) in a **lifespan** handler rather than module globals created at import time.",
            "Run it with `fastapi dev main.py` (from `pip install \"fastapi[standard]\"`) or `uvicorn main:app --reload`, then open http://127.0.0.1:8000/docs."
          ),
          code: [
            {
              title: "A complete, production-shaped FastAPI app",
              lang: "python",
              code: code(`
# pip install "fastapi[standard]"
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class NoteOut(NoteCreate):
    id: int
    created_at: datetime


class Store:
    def __init__(self) -> None:
        self.notes: dict[int, NoteOut] = {}
        self.next_id = 1


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = Store()  # open DB pools / HTTP clients here
    yield
    # close them here


app = FastAPI(title="Notes", lifespan=lifespan)


def get_store() -> Store:
    return app.state.store


StoreDep = Annotated[Store, Depends(get_store)]


@app.post("/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, store: StoreDep) -> NoteOut:
    note = NoteOut(id=store.next_id, created_at=datetime.now(timezone.utc), **payload.model_dump())
    store.notes[note.id] = note
    store.next_id += 1
    return note


@app.get("/notes", response_model=list[NoteOut])
def list_notes(store: StoreDep, limit: Annotated[int, Query(ge=1, le=100)] = 20) -> list[NoteOut]:
    return list(store.notes.values())[:limit]


@app.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int, store: StoreDep) -> NoteOut:
    if note_id not in store.notes:
        raise HTTPException(status_code=404, detail="Note not found")
    return store.notes[note_id]


@app.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, store: StoreDep) -> None:
    if store.notes.pop(note_id, None) is None:
        raise HTTPException(status_code=404, detail="Note not found")
`),
              note: "Try POST /notes with an empty title in /docs and read the 422 body: FastAPI tells the client exactly which field failed.",
            },
          ],
        },
        l4: {
          text: p(
            "**ASGI** is the interface between the server (Uvicorn) and the app: the app is an async callable `app(scope, receive, send)`. `scope` describes the connection (method, path, headers), `receive` yields body chunks, and `send` emits response start and body events. Starlette implements routing and middleware on top; FastAPI adds the parameter and dependency system.",
            "At startup, FastAPI **introspects each route function's signature** with `inspect.signature` and the type hints, and builds a dependency tree. Each parameter becomes a path, query, header, body or dependency field; Pydantic builds a validator for the body model. The same data produces the OpenAPI JSON at `/openapi.json`, which is why docs never drift.",
            "`async def` routes run directly on the event loop. Plain `def` routes (and plain `def` dependencies) are run in a worker threadpool via AnyIO, so blocking drivers like sync psycopg are safe there. Dependencies with `yield` behave like context managers: code after `yield` runs after the response, which is how DB sessions get closed reliably."
          ),
          code: [
            {
              title: "ASGI without any framework",
              lang: "python",
              code: code(`
# Save as raw_asgi.py and run: uvicorn raw_asgi:app
import json


async def app(scope, receive, send):
    assert scope["type"] == "http"
    body = json.dumps({"method": scope["method"], "path": scope["path"]}).encode()
    await send({
        "type": "http.response.start",
        "status": 200,
        "headers": [(b"content-type", b"application/json")],
    })
    await send({"type": "http.response.body", "body": body})
`),
              note: "This is everything FastAPI ultimately produces: one async callable speaking scope/receive/send.",
            },
          ],
        },
        l5: {
          question: "How would you structure database access in a FastAPI app so that every request gets a connection, it is always returned to the pool, and route handlers stay testable?",
          hint: "Lifespan, a yield dependency, and dependency_overrides.",
          answer: p(
            "I would create the connection pool once in the lifespan handler and store it on `app.state`, so it is opened at startup and closed on shutdown rather than at import time.",
            "Then a dependency with `yield` checks out a connection (or SQLAlchemy session) from the pool, yields it to the handler, and returns it in a `finally` block, committing or rolling back depending on whether an exception occurred. Routes declare it as a typed `Annotated[..., Depends(get_db)]` parameter, so they never manage connections themselves.",
            "For tests, `app.dependency_overrides[get_db]` swaps in a connection to a test database, often wrapped in a transaction that is rolled back after each test, so tests are isolated and fast. That separation also makes it easy to move from sync psycopg to an async driver later without touching route logic."
          ),
        },
      },
      commonMistakes: [
        "Returning the database model directly with no `response_model`, leaking fields like `password_hash` or `owner_id`.",
        "Creating DB connections or HTTP clients at module import time instead of in lifespan, which breaks tests and multi-worker setups.",
        "Using `async def` routes with blocking libraries (sync psycopg, requests). Either use plain `def` or async drivers.",
        "Leaving every endpoint at the default 200, including creates (should be 201) and deletes (usually 204).",
      ],
      tryThis: "Open http://127.0.0.1:8000/openapi.json and find your NoteCreate schema. Then change max_length to 100 and refresh: the docs update with zero extra work.",
      miniTask: {
        title: "Ship the notes API locally",
        kind: "build",
        minutes: 35,
        steps: [
          "Install `fastapi[standard]` in a fresh venv and paste the app above into `main.py`.",
          "Run `fastapi dev main.py` and open `/docs`.",
          "Create two notes, list them, fetch one by id and delete one, all from the Swagger UI.",
          "Send an invalid body (empty title) and a non-existent id, and read both error responses.",
          "Add a `PATCH /notes/{note_id}` using a `NoteUpdate` model where every field is optional, applying `payload.model_dump(exclude_unset=True)`.",
        ],
        checklist: [
          "POST returns 201 with the created note",
          "DELETE returns 204 with an empty body",
          "Invalid input returns 422 naming the bad field",
          "Unknown id returns 404",
          "PATCH only changes the fields that were sent",
        ],
        deliverable: "A running FastAPI app with five endpoints and correct status codes.",
      },
      quiz: [
        {
          q: "A client sends a POST body that fails Pydantic validation. What does FastAPI return by default?",
          options: ["400 with a generic message", "422 with per-field error details", "500", "200 with null"],
          answer: 1,
          explain: "FastAPI validates before calling your handler and returns 422 Unprocessable Entity listing each failing field.",
        },
        {
          q: "What does `response_model=NoteOut` do?",
          options: [
            "Validates the request body",
            "Filters and serialises the return value to NoteOut's fields and documents it",
            "Creates a database table",
            "Caches the response",
          ],
          answer: 1,
          explain: "It shapes the output, stripping any extra fields, and appears in OpenAPI docs.",
        },
        {
          q: "Where should you open a database connection pool in a FastAPI app?",
          options: ["Inside each route", "At module import time", "In the lifespan handler", "In a middleware per request"],
          answer: 2,
          explain: "Lifespan runs once at startup and shutdown, which is exactly the lifetime of a pool.",
        },
      ],
      explainPrompt: "Explain to an Express developer how FastAPI uses type hints to replace routing boilerplate, validation and docs, in five sentences.",
      implementPrompt: "From memory, write a FastAPI app with POST and GET /items/{id}, separate input and output models, a 201 on create and a 404 on missing.",
      videos: [
        {
          title: "FastAPI course for beginners",
          channel: "freeCodeCamp",
          url: "https://www.youtube.com/results?search_query=freecodecamp+fastapi+course",
          kind: "search",
          reason: "Watch this if you want a long, guided build of a full FastAPI project with a database.",
        },
        {
          title: "FastAPI in 100 seconds / FastAPI overview",
          channel: "ArjanCodes",
          url: "https://www.youtube.com/results?search_query=arjancodes+fastapi",
          kind: "search",
          reason: "Watch this for a quick, opinionated look at structuring FastAPI apps cleanly.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "rest-api-design",
    title: "API design that ages well",
    week: 3,
    domain: "backend",
    skills: ["api-design"],
    difficulty: "medium",
    minutes: 60,
    summary: "Resource naming, status codes, errors, pagination, idempotency and versioning: the decisions that are expensive to change later.",
    prerequisites: ["http-request-lifecycle", "fastapi-fundamentals"],
    tags: ["rest", "api-design", "pagination", "idempotency", "versioning"],
    lesson: {
      hook: p(
        "Code is cheap to change. APIs are not. The moment ZtudyLock's mobile app or someone else's script depends on your endpoint, every field name and status code is a contract.",
        "Most painful API rewrites come from the same few early decisions: verbs in URLs, inconsistent errors, offset pagination that breaks at scale, and POSTs that charge the customer twice when the network retries.",
        "Design these right once and Cortex's API will survive its first thousand users without a v2."
      ),
      whyItMatters:
        "AI products are API products: agents call your tools, frontends stream from your endpoints, and partners integrate. Predictable, idempotent, well-paginated APIs are what make agent tool-use reliable too.",
      levels: {
        l1: "A good API is predictable: once you have used one endpoint, you can guess how the others work. It names things as nouns, uses HTTP methods for the actions, returns consistent errors, and lets clients page through large lists and safely retry.",
        l2: {
          analogy:
            "An API is a public library's catalogue system. Books (resources) have stable shelf addresses (URLs); you borrow, return or reserve (methods) rather than having a separate door for every action. Change the shelf numbering and every regular's bookmarks break.",
          text: "Think in resources and their lifecycles, not in RPC functions. Then make each lifecycle operation behave the way HTTP already promised clients it would.",
          diagram: {
            type: "compare",
            title: "RPC-ish vs resource-oriented",
            left: {
              label: "Ages badly",
              points: [
                "POST /createDocument, GET /getDocs?user=4",
                "200 OK with {\"success\": false}",
                "?page=5000 (offset) on a growing table",
                "POST /payments with no retry safety",
                "Breaking field renames in place",
              ],
            },
            right: {
              label: "Ages well",
              points: [
                "POST /documents, GET /users/4/documents",
                "Proper 4xx/5xx + one consistent error shape",
                "?cursor=opaque&limit=20 (keyset)",
                "Idempotency-Key header on unsafe POSTs",
                "Additive changes; /v2 only for true breaks",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**Naming:** plural nouns, nested only one level for ownership (`/documents/{id}/chunks`), kebab or snake case consistently, and actions that do not fit CRUD as sub-resources (`POST /documents/{id}/reindex`).",
            "**Errors:** one shape everywhere. RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, plus extensions like `errors`) is a good standard. Clients should never have to parse English messages.",
            "**Pagination:** offset (`LIMIT 20 OFFSET 100000`) makes the database walk and discard every skipped row, and items shift when rows are inserted. **Cursor / keyset** pagination (`WHERE id < :last_id ORDER BY id DESC LIMIT 20`) uses the index and stays stable.",
            "**Idempotency:** for POSTs with side effects (payments, sending emails, starting an expensive LLM job), accept an `Idempotency-Key` header, store the first response under that key, and replay it for duplicates.",
            "**Evolution:** adding optional fields and endpoints is safe; removing or renaming is breaking. Version only when you must (`/v1/` prefix is simplest to operate)."
          ),
          code: [
            {
              title: "Cursor pagination in FastAPI",
              lang: "python",
              code: code(`
import base64
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

app = FastAPI()
DOCS = [{"id": i, "title": f"Doc {i}"} for i in range(1, 101)]  # pretend table


class Page(BaseModel):
    items: list[dict]
    next_cursor: str | None


def encode(last_id: int) -> str:
    return base64.urlsafe_b64encode(str(last_id).encode()).decode()


def decode(cursor: str) -> int:
    try:
        return int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cursor")


@app.get("/documents", response_model=Page)
def list_documents(limit: Annotated[int, Query(ge=1, le=50)] = 10, cursor: str | None = None) -> Page:
    after = decode(cursor) if cursor else 0
    # SQL equivalent: WHERE id > :after ORDER BY id LIMIT :limit + 1
    rows = [d for d in DOCS if d["id"] > after][: limit + 1]
    has_more = len(rows) > limit
    items = rows[:limit]
    return Page(items=items, next_cursor=encode(items[-1]["id"]) if has_more else None)
`),
              note: "Fetching limit + 1 rows is the classic trick for knowing whether another page exists without a COUNT query.",
            },
          ],
        },
        l4: {
          text: p(
            "**Why keyset pagination is fast:** with a B-tree index on `id`, `WHERE id > 5000 ORDER BY id LIMIT 20` is an index seek to 5000 plus reading 20 entries, O(log n + k). `OFFSET 100000` must still produce and throw away 100,000 rows, O(offset + k), and gets slower on every page. For non-unique sort keys (like `created_at`) use a compound cursor `(created_at, id)` with a row comparison `WHERE (created_at, id) < (:ts, :id)`.",
            "**How idempotency keys work:** on the first request, insert the key into a table with a unique constraint and status `in_progress` in the same transaction that starts the work. A concurrent duplicate hits the unique constraint and gets `409` (or waits). When the work finishes, store the status code and body. Later duplicates with the same key get that stored response replayed. Keys expire after a window (Stripe uses 24 hours). Also store a hash of the request body so a reused key with a different payload is rejected with `422`.",
            "**ETags** give you optimistic concurrency: `GET` returns `ETag: \"v7\"`, the client sends `If-Match: \"v7\"` on `PUT`, and the server replies `412 Precondition Failed` if someone else changed it first."
          ),
          code: [
            {
              title: "Idempotency table",
              lang: "sql",
              code: code(`
CREATE TABLE idempotency_keys (
    key            text PRIMARY KEY,
    user_id        bigint NOT NULL,
    request_hash   text NOT NULL,
    status         text NOT NULL CHECK (status IN ('in_progress', 'done')),
    response_code  int,
    response_body  jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- First request claims the key; a duplicate violates the primary key.
INSERT INTO idempotency_keys (key, user_id, request_hash, status)
VALUES ('9b2f6c1e-4a7d-4c1e-8f2a-3d5b7e9a1c20', 42, 'sha256-of-body', 'in_progress');
`),
            },
          ],
        },
        l5: {
          question: "Design the endpoint that lets a Cortex user upload a document and kick off ingestion (chunking + embedding), which can take 30 seconds. What does the API look like?",
          hint: "Long-running work, retries, and how the client learns it is done.",
          answer: p(
            "I would not hold an HTTP request open for 30 seconds. `POST /documents` accepts the upload, stores the file and a row with `status = \"processing\"`, enqueues an ingestion job, and returns `202 Accepted` with the document resource and a `Location: /documents/{id}` header.",
            "The client polls `GET /documents/{id}` (or subscribes via SSE) until status becomes `ready` or `failed`, with a failure reason in the resource. The POST accepts an `Idempotency-Key` so a retried upload on a flaky mobile connection does not create duplicate documents or double embedding costs.",
            "Errors use one Problem Details shape, listing uses cursor pagination on `(created_at, id)`, and re-running ingestion is an explicit sub-resource action, `POST /documents/{id}/reindex`. Everything is under `/v1` so I can evolve the shape later without breaking the frontend."
          ),
        },
      },
      commonMistakes: [
        "Verbs in URLs (`/getUser`, `/createNote`). Let the HTTP method be the verb.",
        "Different error shapes per endpoint, forcing clients to special-case each one.",
        "Offset pagination on large or fast-changing tables, causing slow deep pages and duplicated or skipped items.",
        "Non-idempotent POSTs for expensive or financial actions with no Idempotency-Key, so client retries double-charge.",
      ],
      tryThis: "Look at Stripe's API reference for creating a PaymentIntent. Find the idempotency key, the error object and the list pagination parameters (`starting_after`). Stripe is the gold standard for this lesson.",
      miniTask: {
        title: "Design Cortex's v1 API on paper",
        kind: "explain",
        minutes: 30,
        steps: [
          "List the resources Cortex has in month 1: users, sessions (or tokens), documents.",
          "Write every endpoint as METHOD + path + success status (e.g. `POST /v1/documents -> 201`).",
          "Define one JSON error shape and show an example for a 404 and a 422.",
          "Specify pagination for `GET /v1/documents` with cursor and limit, including the response shape.",
          "Mark which endpoints need an Idempotency-Key and why.",
        ],
        checklist: [
          "No verbs in any path",
          "Every endpoint has an explicit success status code",
          "One error shape used everywhere",
          "Listing uses cursor pagination, not offset",
          "I justified idempotency for at least one endpoint",
        ],
        deliverable: "A one-page API spec (markdown) for Cortex v1 that you will implement in week 4.",
      },
      quiz: [
        {
          q: "Why does `OFFSET 100000 LIMIT 20` get slow?",
          options: [
            "Postgres cannot index OFFSET queries at all",
            "The database must generate and discard the first 100,000 rows",
            "LIMIT is slow",
            "It is not slow",
          ],
          answer: 1,
          explain: "Offset work grows with the page depth. Keyset pagination seeks directly to the cursor via the index.",
        },
        {
          q: "A long-running ingestion job is started by POST. Which response fits best?",
          options: ["200 with the final result after 30s", "201 Created with no body", "202 Accepted with a status resource to poll", "204 No Content"],
          answer: 2,
          explain: "202 says the request was accepted for processing but is not complete; the resource tells the client where to check.",
        },
        {
          q: "Which change is backward compatible for existing clients?",
          options: ["Renaming `title` to `name`", "Adding a new optional response field", "Changing an id from int to string", "Making an optional request field required"],
          answer: 1,
          explain: "Well-behaved clients ignore unknown fields, so adding optional fields is safe. The others break existing callers.",
        },
      ],
      explainPrompt: "Explain to a junior engineer why cursor pagination and idempotency keys matter, with a concrete failure each prevents, in five sentences.",
      implementPrompt: "From memory, write a FastAPI list endpoint with cursor pagination that fetches limit + 1 rows to compute next_cursor.",
      videos: [
        {
          title: "API design best practices / REST API design",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+api+design+best+practices",
          kind: "search",
          reason: "Watch this for a compact visual summary of naming, versioning, pagination and idempotency.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "sql-postgres-essentials",
    title: "SQL & Postgres: joins, indexes, transactions",
    week: 3,
    domain: "backend",
    skills: ["sql-postgres", "data-modeling"],
    difficulty: "medium",
    minutes: 90,
    summary: "Relational modelling for a MongoDB developer: schemas, joins, indexes you can prove with EXPLAIN, and transactions.",
    prerequisites: ["python-types-pydantic"],
    tags: ["sql", "postgres", "indexes", "transactions", "data-modeling", "psycopg"],
    lesson: {
      hook: p(
        "In FabricNest you stored orders in MongoDB with the product details embedded. It was fast to build. Then a product's price changed and you had to decide which of 40 copies was the truth.",
        "Relational databases solve that by storing each fact once and **joining** at read time, with constraints that make bad data impossible rather than just unlikely.",
        "Postgres is also where your AI data will live: users, documents, chunks and, with pgvector in month 3, the embeddings themselves. Learning it properly now is not a detour."
      ),
      whyItMatters:
        "Postgres plus pgvector is the default storage for production RAG. Correct schemas, indexes and transactions are what keep Cortex fast and consistent as documents grow.",
      levels: {
        l1: "A relational database stores data in tables with fixed columns, like strict spreadsheets. Instead of copying the same information into many places, tables point at each other using ids, and a join combines them when you read. Indexes make lookups fast, and transactions make groups of changes happen all-or-nothing.",
        l2: {
          analogy:
            "MongoDB is a filing cabinet of self-contained folders: easy to grab one, painful to keep copies in sync. Postgres is a set of ledgers that reference each other by row number: you cross-reference at read time, but every fact is written exactly once.",
          text: "Think in three layers: the **schema** (tables, types, constraints) guarantees shape; **indexes** make the queries you actually run fast; **transactions** keep multi-step changes consistent even under concurrency and crashes.",
          diagram: {
            type: "compare",
            title: "Coming from MongoDB",
            left: {
              label: "MongoDB (what you know)",
              points: [
                "Collections of flexible documents",
                "Embed related data, duplicate for reads",
                "$lookup is the exception",
                "Schema enforced by app code (Mongoose)",
                "Multi-doc transactions exist but are rarer",
              ],
            },
            right: {
              label: "Postgres",
              points: [
                "Tables with typed columns + jsonb for flexible bits",
                "Normalise, then JOIN at read time",
                "JOIN is the normal path, planned by the optimiser",
                "Schema enforced by the database (NOT NULL, FK, CHECK, UNIQUE)",
                "Every statement is transactional",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**Schema:** use `bigint GENERATED ALWAYS AS IDENTITY` (or UUIDs) for ids, `timestamptz` for times, `text` for strings, `jsonb` for genuinely flexible metadata. Enforce rules with `NOT NULL`, `UNIQUE`, `CHECK` and `REFERENCES ... ON DELETE CASCADE`.",
            "**Joins:** `INNER JOIN` keeps only matching rows; `LEFT JOIN` keeps every left row and fills NULLs. Aggregate with `GROUP BY` and filter groups with `HAVING`.",
            "**Indexes:** Postgres indexes primary keys and unique constraints automatically, but **not foreign keys**. Add indexes for the columns you filter and sort on, matching the query shape: `(owner_id, created_at DESC)` serves \"my latest documents\". Verify with `EXPLAIN ANALYZE`.",
            "**Transactions:** `BEGIN ... COMMIT` groups statements; any error means `ROLLBACK` and none of them happened. From Python, always use parameterised queries (`%s` placeholders), never string formatting, to prevent SQL injection."
          ),
          code: [
            {
              title: "Cortex month-1 schema",
              lang: "sql",
              code: code(`
CREATE TABLE users (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    content    text NOT NULL,
    metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Serves: "this user's documents, newest first"
CREATE INDEX documents_owner_created_idx ON documents (owner_id, created_at DESC);

-- Documents per user, including users with zero documents
SELECT u.email, count(d.id) AS doc_count
FROM users u
LEFT JOIN documents d ON d.owner_id = u.id
GROUP BY u.email
ORDER BY doc_count DESC;
`),
            },
            {
              title: "Parameterised queries and a transaction with psycopg 3",
              lang: "python",
              code: code(`
# pip install "psycopg[binary]"
import psycopg
from psycopg.rows import dict_row

DSN = "postgresql://postgres:postgres@localhost:5432/cortex"

with psycopg.connect(DSN, row_factory=dict_row) as conn:
    with conn.transaction():  # COMMIT on success, ROLLBACK on any exception
        user = conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
            ("goutham@example.com", "not-a-real-hash"),
        ).fetchone()
        conn.execute(
            "INSERT INTO documents (owner_id, title, content) VALUES (%s, %s, %s)",
            (user["id"], "Attention notes", "Q, K and V are projections..."),
        )

    rows = conn.execute(
        "SELECT id, title FROM documents WHERE owner_id = %s ORDER BY created_at DESC LIMIT 10",
        (user["id"],),
    ).fetchall()
    print(rows)
`),
              note: "Never build SQL with f-strings. The %s placeholders send values separately from the query text.",
            },
          ],
        },
        l4: {
          text: p(
            "**B-tree indexes:** Postgres's default index is a balanced tree of 8 KB pages, sorted by the key, with leaf pages pointing to row locations (TIDs) in the table heap. A lookup is O(log n) page reads, usually 3 to 4 even for millions of rows. A composite index `(owner_id, created_at DESC)` is sorted by owner first, then by time within each owner, so \"owner = 42 ORDER BY created_at DESC LIMIT 10\" is a seek plus reading 10 entries with no sort. The same index cannot help a query filtering only on `created_at` (leftmost-prefix rule).",
            "**MVCC:** Postgres never updates a row in place. An UPDATE writes a new row version and marks the old one with the transaction id that superseded it. Each transaction sees a **snapshot**, so readers never block writers. Dead versions are cleaned up later by VACUUM (autovacuum).",
            "**Durability via WAL:** before a commit is acknowledged, the change is appended to the write-ahead log and fsynced. After a crash, Postgres replays the WAL. The WAL is also what replication streams to read replicas.",
            "**Isolation:** the default is READ COMMITTED (each statement sees data committed before it started). Two concurrent \"read balance, then write balance\" transactions can lose an update; fix with `SELECT ... FOR UPDATE`, an atomic `UPDATE ... SET x = x - 1`, or SERIALIZABLE with retries."
          ),
          code: [
            {
              title: "Prove an index with EXPLAIN ANALYZE",
              lang: "sql",
              code: code(`
-- Generate 200k fake documents for user 1
INSERT INTO documents (owner_id, title, content, created_at)
SELECT 1, 'Doc ' || g, 'body', now() - (g || ' minutes')::interval
FROM generate_series(1, 200000) AS g;
ANALYZE documents;

EXPLAIN ANALYZE
SELECT id, title FROM documents
WHERE owner_id = 1
ORDER BY created_at DESC
LIMIT 10;
-- With the index: "Index Scan using documents_owner_created_idx", well under 1 ms.
-- DROP INDEX documents_owner_created_idx; and rerun: Seq Scan + Sort, tens of ms.
`),
            },
          ],
        },
        l5: {
          question: "Users can have a credit balance for LLM usage. Two requests from the same user arrive at the same moment, each costing 10 credits, and the user has 15. Both succeed and the balance ends at 5. What happened and how do you fix it?",
          hint: "Read-modify-write under READ COMMITTED.",
          answer: p(
            "This is a lost update. Both transactions read balance 15 under READ COMMITTED, both checked 15 >= 10 in application code, and both wrote 15 - 10 = 5. The second write overwrote the first, so the user spent 20 credits for 10.",
            "The simplest robust fix is to make the check and the write one atomic statement: `UPDATE accounts SET credits = credits - 10 WHERE user_id = %s AND credits >= 10 RETURNING credits`. If no row is returned, the user lacked credits. Postgres row-locks during the update, so the second transaction waits, then re-evaluates against the new value.",
            "Alternatives are `SELECT ... FOR UPDATE` to lock the row before reading, or SERIALIZABLE isolation with retry on serialization failure. I would also add a `CHECK (credits >= 0)` constraint as a last line of defence and write a concurrency test that fires parallel requests."
          ),
        },
      },
      commonMistakes: [
        "Building SQL with f-strings or concatenation, opening the door to SQL injection. Always use placeholders.",
        "Assuming foreign keys are indexed automatically. They are not; add an index on columns like `owner_id`.",
        "Using `timestamp` instead of `timestamptz`, then getting timezone bugs between Vercel (UTC) and local time.",
        "Doing read-then-write in application code without locking or an atomic UPDATE, causing lost updates.",
      ],
      tryThis: "Run the EXPLAIN ANALYZE example, drop the index, run it again, and compare the plans and timings.",
      miniTask: {
        title: "Build and query the Cortex schema",
        kind: "build",
        minutes: 40,
        steps: [
          "Install Postgres locally (Postgres.app on macOS, or your OS package manager) and run `createdb cortex`.",
          "Apply the users and documents schema with `psql cortex -f schema.sql`.",
          "Insert three users and ten documents spread across them, including one user with zero documents.",
          "Write the LEFT JOIN count query and confirm the zero-document user appears with 0.",
          "Seed 200k documents for one user and compare EXPLAIN ANALYZE with and without the composite index.",
        ],
        checklist: [
          "Schema applies cleanly with all constraints",
          "Inserting a document with a non-existent owner_id fails with a foreign key error",
          "The LEFT JOIN includes users with zero documents",
          "I captured the plan and timing both with and without the index",
        ],
        deliverable: "`schema.sql`, `queries.sql` and a short note with the two EXPLAIN timings.",
      },
      quiz: [
        {
          q: "You need every user listed with their document count, including users with none. Which join?",
          options: ["INNER JOIN", "LEFT JOIN from users to documents", "RIGHT JOIN from users to documents", "CROSS JOIN"],
          answer: 1,
          explain: "LEFT JOIN keeps every user; count(d.id) counts only non-NULL matches, giving 0 for users with none.",
        },
        {
          q: "Given an index on (owner_id, created_at), which query cannot use it efficiently as a seek?",
          options: [
            "WHERE owner_id = 5",
            "WHERE owner_id = 5 ORDER BY created_at",
            "WHERE created_at > now() - interval '1 day'",
            "WHERE owner_id = 5 AND created_at > now() - interval '1 day'",
          ],
          answer: 2,
          explain: "Composite B-trees follow the leftmost-prefix rule; filtering only on the second column cannot seek.",
        },
        {
          q: "What does MVCC give Postgres?",
          options: [
            "Readers and writers do not block each other because each transaction sees a snapshot",
            "Automatic sharding",
            "Faster full-text search",
            "Schema-less tables",
          ],
          answer: 0,
          explain: "Updates create new row versions, so reads work from a consistent snapshot without waiting on writers.",
        },
      ],
      explainPrompt: "Explain to a MongoDB developer when to normalise, how a composite index is used, and what a transaction guarantees, in five sentences.",
      implementPrompt: "From memory, write the users and documents tables with constraints and a composite index, plus a psycopg snippet that inserts both inside one transaction.",
      videos: [
        {
          title: "Database indexing explained",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+database+indexing+explained",
          kind: "search",
          reason: "Watch this if B-tree indexes and EXPLAIN plans still feel like magic.",
        },
        {
          title: "SQL tutorial / PostgreSQL full course",
          channel: "freeCodeCamp",
          url: "https://www.youtube.com/results?search_query=freecodecamp+postgresql+full+course",
          kind: "search",
          reason: "Watch sections of this if you need more practice writing joins and aggregates.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "fastapi-notes-api",
    title: "Notes API with FastAPI + Postgres",
    week: 3,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "backend",
    skills: ["fastapi", "sql-postgres", "api-design"],
    prerequisites: ["FastAPI: production-shaped APIs", "SQL & Postgres: joins, indexes, transactions", "API design that ages well"],
    topicSlugs: ["fastapi-fundamentals", "rest-api-design", "sql-postgres-essentials"],
    objective: "Build a real CRUD notes API backed by Postgres with a connection pool, Pydantic input/output models, cursor pagination and correct status codes.",
    expectedOutput: "`fastapi dev main.py` serves /docs with POST, GET list (cursor-paginated), GET one, PATCH and DELETE for /notes, all persisted in Postgres and returning 201/200/204/404/422 correctly.",
    steps: [
      {
        title: "Database and schema",
        detail: "Create a `notes_lab` database. Create a `notes` table: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200)`, `body text NOT NULL DEFAULT ''`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.",
      },
      {
        title: "Project setup",
        detail: "New venv; install `fastapi[standard]`, `psycopg[binary]` and `psycopg-pool`. Read the database URL from an environment variable `DATABASE_URL` with a local default.",
      },
      {
        title: "Pool in lifespan, connection as a dependency",
        detail: "Open a `ConnectionPool` in the lifespan handler and close it on shutdown. Write a `get_conn` dependency that yields `pool.connection()`, so each request borrows a connection and returns it (committing on success, rolling back on error).",
      },
      {
        title: "Models",
        detail: "`NoteCreate` (title, body), `NoteUpdate` (both optional), `NoteOut` (id, title, body, created_at, updated_at) and `NotePage` (items, next_cursor).",
      },
      {
        title: "Endpoints",
        detail: "POST /notes -> 201 using `INSERT ... RETURNING *`. GET /notes with `limit` (1..100) and `cursor` using `WHERE id < %s ORDER BY id DESC LIMIT %s` fetching limit + 1. GET /notes/{id} -> 404 if missing. PATCH builds the SET clause only from `exclude_unset` fields (column names from a fixed allow-list, values as parameters) and bumps `updated_at`. DELETE -> 204, 404 if no row was deleted (check `cursor.rowcount`).",
      },
      {
        title: "Exercise it",
        detail: "In /docs, create 25 notes, page through them with limit=10 until next_cursor is null, patch one title, delete one, and try every error case.",
      },
    ],
    hints: [
      "Plain `def` routes are fine with sync psycopg; FastAPI runs them in a threadpool.",
      "Use `row_factory=dict_row` via the pool's `kwargs={\"row_factory\": dict_row}` so rows map straight into `NoteOut(**row)`.",
      "Never interpolate user input into SQL. For dynamic PATCH columns, only use names from a hard-coded set; values always go through placeholders.",
      "If PATCH receives an empty body, return the note unchanged rather than running an empty UPDATE.",
    ],
    stretch: "Add a `q` query parameter that filters with `title ILIKE %s` and a GIN trigram index (`pg_trgm`), and prove the index is used with EXPLAIN ANALYZE.",
    learned: [
      "Managing a Postgres connection pool across the FastAPI lifecycle",
      "Mapping SQL rows into Pydantic output models",
      "Implementing keyset pagination with limit + 1",
      "Writing safe dynamic UPDATEs with parameterised values",
    ],
    starter: {
      title: "main.py starting point",
      lang: "python",
      code: code(`
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Iterator

import psycopg
from fastapi import Depends, FastAPI, HTTPException, status
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/notes_lab")


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class NoteOut(NoteCreate):
    id: int
    created_at: datetime
    updated_at: datetime


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = ConnectionPool(DATABASE_URL, kwargs={"row_factory": dict_row}, open=True)
    yield
    app.state.pool.close()


app = FastAPI(title="Notes Lab", lifespan=lifespan)


def get_conn() -> Iterator[psycopg.Connection]:
    with app.state.pool.connection() as conn:  # commits on success, rolls back on error
        yield conn


Conn = Annotated[psycopg.Connection, Depends(get_conn)]


@app.post("/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, conn: Conn) -> NoteOut:
    row = conn.execute(
        "INSERT INTO notes (title, body) VALUES (%s, %s) RETURNING *",
        (payload.title, payload.body),
    ).fetchone()
    return NoteOut(**row)


@app.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int, conn: Conn) -> NoteOut:
    row = conn.execute("SELECT * FROM notes WHERE id = %s", (note_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteOut(**row)
`),
      note: "Runs as-is for create and get. Add list, PATCH and DELETE following the steps.",
    },
  },
];
