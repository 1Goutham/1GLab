import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Code bodies are written flush-left starting on the line after the backtick. */
const code = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "redis-caching",
    title: "Redis & caching",
    week: 4,
    domain: "backend",
    skills: ["caching"],
    difficulty: "medium",
    minutes: 75,
    summary: "Cache-aside with Redis: when to cache, how to key it, how long to keep it, and how caches fail.",
    prerequisites: ["fastapi-fundamentals", "async-python"],
    tags: ["redis", "caching", "ttl", "performance", "fastapi"],
    lesson: {
      hook: p(
        "Imagine your AI application receives the same request 10,000 times. \"Summarise the refund policy.\" Same document, same question, same answer.",
        "Without a cache, that is 10,000 LLM calls, 10,000 times the latency, and a bill that grows linearly with your popularity. With a cache, it is one LLM call and 9,999 lookups that take under a millisecond.",
        "You already know this instinct from React: `useMemo` skips recomputing when inputs have not changed. Redis is `useMemo` for your whole backend, shared by every server instance."
      ),
      whyItMatters:
        "LLM calls are the slowest and most expensive thing in an AI product. Caching responses, embeddings and external API results is often the single biggest cost and latency win you can ship.",
      levels: {
        l1: "A cache is a fast, temporary copy of an answer you already computed. Redis is a database that keeps data in memory, so reading from it takes well under a millisecond. You check Redis first; only if the answer is missing do you do the slow work and save the result for next time.",
        l2: {
          analogy:
            "Your database is the warehouse across town. Redis is the shelf behind the counter. The first customer who asks for something waits while you fetch it from the warehouse, and you put a copy on the shelf with a sticky note saying when to throw it out (the TTL).",
          text: p(
            "The standard pattern is **cache-aside**: the app checks the cache, on a miss reads from the source of truth, then writes the result into the cache with an expiry.",
            "The cache is never the source of truth. If Redis is wiped, the app still works, just slower."
          ),
          diagram: {
            type: "flow",
            title: "Same request, with and without a cache",
            lanes: [
              {
                label: "Without cache",
                tone: "bad",
                steps: [
                  { label: "Browser", note: "same request x10,000" },
                  { label: "Server", note: "does the work every time" },
                  { label: "Database", note: "10,000 queries", accent: true },
                ],
              },
              {
                label: "With cache",
                tone: "good",
                steps: [
                  { label: "Browser", note: "same request x10,000" },
                  { label: "Server", note: "check cache first" },
                  { label: "Redis", note: "9,999 hits, < 1 ms", accent: true },
                  { label: "Database", note: "1 query on the miss" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Cache-aside in four lines:** build a key, `GET` it, on a miss do the work and `SET key value EX ttl`, return. Everything interesting is in choosing the **key** and the **TTL**.",
            "**Keys** must include everything that changes the answer: `weather:13.08:80.27` for coordinates, `llm:v2:{model}:{sha256(prompt)}` for LLM responses. Include a version so you can invalidate everything by bumping it. Round inputs where it makes sense (coordinates to 2 decimals) to increase hit rate.",
            "**TTL** is how stale you can tolerate: weather 10 minutes, a user's profile 1 minute, an embedding of an immutable chunk forever. When the source changes, either wait for the TTL or delete the key explicitly on write.",
            "Beyond caching, Redis data structures give you rate limiters (`INCR` + `EXPIRE`), leaderboards (sorted sets), queues (lists, streams) and distributed locks (`SET key value NX PX 5000`)."
          ),
          code: [
            {
              title: "Cache-aside for a weather endpoint (FastAPI + redis.asyncio)",
              lang: "python",
              code: code(`
# pip install "fastapi[standard]" redis httpx
# redis-server running locally (brew install redis / apt install redis-server)
import json
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Response
from redis import asyncio as aioredis

TTL_SECONDS = 600


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url("redis://localhost:6379", decode_responses=True)
    app.state.http = httpx.AsyncClient(timeout=10)
    yield
    await app.state.http.aclose()
    await app.state.redis.aclose()


app = FastAPI(lifespan=lifespan)


@app.get("/weather")
async def weather(lat: float, lon: float, response: Response) -> dict:
    key = f"weather:v1:{lat:.2f}:{lon:.2f}"
    start = time.perf_counter()

    if (cached := await app.state.redis.get(key)) is not None:
        response.headers["x-cache"] = "HIT"
        data = json.loads(cached)
    else:
        r = await app.state.http.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current": "temperature_2m,wind_speed_10m"},
        )
        r.raise_for_status()
        data = r.json()["current"]
        await app.state.redis.set(key, json.dumps(data), ex=TTL_SECONDS)
        response.headers["x-cache"] = "MISS"

    response.headers["x-elapsed-ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    return data
`),
              note: "Call /weather?lat=13.08&lon=80.27 twice. The first is a MISS at a few hundred ms; the second a HIT at around 1 ms.",
            },
          ],
        },
        l4: {
          text: p(
            "**Why Redis is fast:** all data lives in RAM in a giant hash table, and commands are executed by a single main thread running an event loop (network I/O can be offloaded to I/O threads since Redis 6). No locks, no disk seeks on the read path, and a simple text protocol (RESP). A single instance handles on the order of 100k+ simple operations per second.",
            "**How expiry works:** keys with a TTL are also stored in an expires dictionary. Redis deletes expired keys **lazily** (when you access one, it checks the timestamp) and **actively** (a background cycle samples random keys with TTLs and deletes the expired ones, repeating while a high fraction are expired). That is why memory is reclaimed even for keys nobody reads again.",
            "**When memory is full:** `maxmemory-policy` decides. For a pure cache use `allkeys-lru` or `allkeys-lfu`. Redis approximates LRU by sampling a few keys and evicting the best candidate, rather than maintaining an exact linked list.",
            "**Failure modes:** a **stampede** is when a hot key expires and hundreds of requests all miss at once and hammer the database or LLM. Mitigations: a short lock with `SET lock:key 1 NX EX 10` so one request recomputes while others wait or serve stale, and jittered TTLs so keys do not all expire together. **Stale data** is the other: always know which writes must delete which keys."
          ),
          code: [
            {
              title: "Talk RESP by hand",
              lang: "bash",
              code: code(`
redis-cli SET greeting "hello" EX 30
redis-cli TTL greeting          # seconds left
redis-cli --latency             # round-trip latency to your local Redis
redis-cli MONITOR               # watch every command your app sends (dev only)

# Raw protocol: arrays of bulk strings over TCP
printf '*2\\r\\n$3\\r\\nGET\\r\\n$8\\r\\ngreeting\\r\\n' | nc localhost 6379
`),
              note: "RESP: *2 means an array of 2 items, $3 means a 3-byte string. That is the entire wire format for a GET.",
            },
          ],
        },
        l5: {
          question: "Your RAG endpoint answers questions over a company's documents and costs too much. A PM asks you to \"just cache the answers\". What do you cache, how do you key it, and what can go wrong?",
          hint: "Layers of caching, what makes two requests the same, and invalidation when documents change.",
          answer: p(
            "I would cache at several layers. Embeddings of chunks are deterministic, so cache them indefinitely by `sha256(chunk_text) + embedding_model`. Query embeddings can be cached by normalised question text. Final answers can be cached by a key built from the model, prompt template version, normalised question, and the ids and versions of the retrieved chunks, with a TTL.",
            "Including the retrieved chunk versions in the key means that when a document is updated, retrieval returns new versions and the old answer naturally stops matching. For hard guarantees I would also delete keys tagged with a document id on update.",
            "Risks: leaking one tenant's answer to another if the key omits the tenant or permission scope, so the user or tenant id must be part of the key; serving stale answers after policy changes; low hit rate if questions vary in wording, which semantic caching (matching by embedding similarity) can help with but adds false-hit risk; and stampedes on popular questions. I would measure hit rate and cost savings, and keep Redis optional so an outage only makes things slower."
          ),
        },
      },
      commonMistakes: [
        "Keys that miss an input that changes the answer, such as the user id or model name, causing wrong or leaked responses.",
        "No TTL at all, so stale data lives forever and memory grows until eviction starts dropping random keys.",
        "Treating Redis as the source of truth for data you cannot afford to lose.",
        "Creating a new Redis connection per request instead of one shared client with a pool.",
      ],
      tryThis: "Run `redis-cli MONITOR` in one terminal and hit your cached endpoint in another. Watch the GET on every request and the SET only on misses.",
      miniTask: {
        title: "Add Redis caching to a weather endpoint",
        kind: "build",
        minutes: 35,
        steps: [
          "Install and start Redis locally, then check it with `redis-cli ping` (expect PONG).",
          "Paste the weather app into `main.py` and run `fastapi dev main.py`.",
          "Call `/weather?lat=13.08&lon=80.27` twice with `curl -i` and compare the `x-cache` and `x-elapsed-ms` headers.",
          "Run `redis-cli TTL weather:v1:13.08:80.27` and confirm the countdown.",
          "Stop Redis and call the endpoint again. Make it degrade gracefully: catch `redis.exceptions.ConnectionError` and fall back to calling the API directly.",
        ],
        checklist: [
          "First call shows MISS and second shows HIT",
          "Cache hit latency is at least 10x lower than the miss",
          "The key has a TTL of about 600 seconds",
          "The endpoint still works (slower) when Redis is down",
        ],
        deliverable: "A FastAPI weather endpoint with Redis cache-aside, TTL, x-cache header and graceful fallback.",
      },
      quiz: [
        {
          q: "In cache-aside, what happens on a cache miss?",
          options: [
            "Return 404",
            "Read from the source of truth, store the result in the cache with a TTL, return it",
            "Wait for Redis to fetch it from the database automatically",
            "Write to the database, then the cache",
          ],
          answer: 1,
          explain: "The application owns the logic: miss, load from source, populate cache, return.",
        },
        {
          q: "A multi-tenant app caches answers under `answer:{question_hash}`. What is the bug?",
          options: [
            "Hashes are too slow",
            "The key omits the tenant/user scope, so one tenant can receive another's answer",
            "Redis cannot store hashes",
            "There is no bug",
          ],
          answer: 1,
          explain: "Every input that affects the answer, including permission scope, must be part of the key.",
        },
        {
          q: "What is a cache stampede?",
          options: [
            "Redis running out of memory",
            "Many requests missing on the same hot key at once and all recomputing it",
            "Too many keys with long TTLs",
            "Replication lag",
          ],
          answer: 1,
          explain: "When a hot key expires, concurrent misses hammer the backend. Locks, stale-while-revalidate and jittered TTLs prevent it.",
        },
      ],
      explainPrompt: "Explain to a junior engineer how cache-aside works, how to choose a key and TTL, and one way caches fail, in five sentences.",
      implementPrompt: "From memory, write a FastAPI endpoint that caches an external API response in Redis with a 10-minute TTL and reports HIT or MISS in a header.",
      videos: [
        {
          title: "Redis in 100 seconds",
          channel: "Fireship",
          url: "https://www.youtube.com/results?search_query=fireship+redis+in+100+seconds",
          kind: "search",
          reason: "Watch this for a two-minute overview of what Redis is and what it is used for.",
        },
        {
          title: "Caching strategies / top caching pitfalls",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+caching+strategies",
          kind: "search",
          reason: "Watch this when you want the system-design view: cache-aside vs write-through, stampedes and eviction.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "authentication-sessions-jwt",
    title: "Authentication: sessions, JWT & OAuth",
    week: 4,
    domain: "backend",
    skills: ["auth", "web-security"],
    difficulty: "hard",
    minutes: 90,
    summary: "Password hashing, server sessions vs JWTs, and what OAuth actually does, built the way you would defend it in a review.",
    prerequisites: ["http-request-lifecycle", "fastapi-fundamentals", "sql-postgres-essentials"],
    tags: ["auth", "jwt", "sessions", "oauth", "argon2", "security", "cookies"],
    lesson: {
      hook: p(
        "In your Next.js apps, auth was probably NextAuth or Clerk: a provider, a callback URL, and a `session` object appeared. It worked, and you never had to know why.",
        "Cortex will hold people's private documents. The first time someone asks \"how do you store passwords?\" or \"what happens if a token leaks?\", \"the library handles it\" is not an answer.",
        "This lesson builds auth from its parts: hashing, a login endpoint, a token or session, a protected route. After this, libraries become choices, not magic."
      ),
      whyItMatters:
        "Every AI product with user data needs auth, and agent systems add service tokens and OAuth for tools (MCP servers use OAuth). Understanding the moving parts is how you avoid the breaches that end products.",
      levels: {
        l1: "Authentication is proving who you are; authorisation is what you are then allowed to do. After you log in with a password, the server gives your browser a pass (a session id or a signed token) so you do not have to send your password on every request. The server checks that pass on each request.",
        l2: {
          analogy:
            "A **session** is a coat-check ticket: a meaningless number, and the venue keeps the real record, so it can cancel your ticket any time. A **JWT** is a festival wristband: it carries your details and a tamper-proof seal, so any gate can verify it without calling the office, but it cannot easily be taken back before it expires. **OAuth** is showing your passport at a partner desk (Google) that then gives the venue a pass for you, without the venue ever seeing your passport.",
          text: "Both sessions and JWTs are just ways to carry proof of a past login. The trade-off is where the truth lives: in your database (revocable, one lookup per request) or in the token itself (stateless, hard to revoke).",
          diagram: {
            type: "compare",
            title: "Server sessions vs JWT access tokens",
            left: {
              label: "Server sessions",
              points: [
                "Cookie holds a random opaque id",
                "Server stores session row (DB or Redis)",
                "Instant revocation: delete the row",
                "One lookup per request",
                "Great fit: a web app on one domain",
              ],
            },
            right: {
              label: "JWT access tokens",
              points: [
                "Token holds signed claims (sub, exp, scope)",
                "Server verifies signature, no lookup",
                "Revocation needs short expiry + refresh tokens or a denylist",
                "Payload is readable (base64), not secret",
                "Great fit: APIs, mobile, service-to-service",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**Passwords:** never store them, store a slow, salted hash: **Argon2id** (preferred) or bcrypt. Fast hashes like SHA-256 are wrong for passwords because attackers can try billions per second on a GPU.",
            "**Login:** look up the user by email, verify the hash, and on success issue a credential. Return the same generic error for \"no such user\" and \"wrong password\" so attackers cannot enumerate accounts.",
            "**Delivering the credential:** for browsers, an `HttpOnly; Secure; SameSite=Lax` cookie keeps it away from JavaScript (and therefore XSS). For API clients, an `Authorization: Bearer <token>` header. JWTs should be short-lived (5 to 15 minutes) with a rotating refresh token.",
            "**OAuth 2.0 / OIDC** (\"Sign in with Google\") uses the authorization code flow with PKCE: redirect to Google, the user consents, Google redirects back with a one-time code, your server exchanges it for tokens, and the OIDC `id_token` tells you who the user is."
          ),
          code: [
            {
              title: "Login + protected route with Argon2 and JWT",
              lang: "python",
              code: code(`
# pip install "fastapi[standard]" argon2-cffi pyjwt
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

SECRET = "dev-only-secret-change-me-0123456789abcdef"  # load from env in real code
ph = PasswordHasher()  # Argon2id with sensible defaults
USERS = {"goutham@example.com": {"id": 1, "hash": ph.hash("correct horse battery staple")}}

app = FastAPI()
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")
DUMMY_HASH = ph.hash("timing-equaliser")  # verify against this for unknown emails


@app.post("/auth/token")
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> dict[str, str]:
    user = USERS.get(form.username)
    try:
        ph.verify(user["hash"] if user else DUMMY_HASH, form.password)
        if user is None:
            raise VerifyMismatchError
    except VerifyMismatchError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password") from None
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user["id"]), "iat": now, "exp": now + timedelta(minutes=15)}
    return {"access_token": jwt.encode(claims, SECRET, algorithm="HS256"), "token_type": "bearer"}


def current_user_id(token: Annotated[str, Depends(oauth2)]) -> int:
    try:
        claims = jwt.decode(token, SECRET, algorithms=["HS256"])  # checks signature + exp
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token", {"WWW-Authenticate": "Bearer"}) from None
    return int(claims["sub"])


@app.get("/me")
def me(user_id: Annotated[int, Depends(current_user_id)]) -> dict[str, int]:
    return {"user_id": user_id}
`),
              note: "Use the Authorize button in /docs to log in, then call /me. Pinning algorithms=[\"HS256\"] on decode is essential.",
            },
          ],
        },
        l4: {
          text: p(
            "**A JWT is three base64url strings joined by dots:** a header (`{\"alg\":\"HS256\",\"typ\":\"JWT\"}`), a payload of claims, and a signature. For HS256 the signature is `HMAC-SHA256(secret, header_b64 + \".\" + payload_b64)`. Verifying means recomputing it and comparing in constant time, then checking `exp`, and ideally `iss` and `aud`. Anyone can **read** the payload; only the key holder can **forge** it. RS256/ES256 use a private key to sign and a public key to verify, so many services can verify without being able to mint tokens.",
            "Classic JWT attacks come from trusting the header: `alg: none`, or swapping RS256 to HS256 and signing with the public key as an HMAC secret. Libraries defend against this only if you pass an explicit `algorithms` list.",
            "**Argon2id** is memory-hard: each hash deliberately uses tens of megabytes of RAM and several passes, which makes GPU and ASIC cracking expensive. The output string encodes the algorithm, version, parameters and a random salt (`$argon2id$v=19$m=65536,t=3,p=4$salt$hash`), so you can raise the cost later and rehash on next login (`ph.check_needs_rehash`)."
          ),
          code: [
            {
              title: "Verify a JWT by hand",
              lang: "python",
              code: code(`
import base64
import hashlib
import hmac
import json

import jwt

SECRET = "dev-only-secret-change-me-0123456789abcdef"
token = jwt.encode({"sub": "1", "role": "user"}, SECRET, algorithm="HS256")


def b64url_decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


header_b64, payload_b64, sig_b64 = token.split(".")
print("header: ", json.loads(b64url_decode(header_b64)))
print("payload:", json.loads(b64url_decode(payload_b64)))  # readable by anyone!

signing_input = f"{header_b64}.{payload_b64}".encode()
expected = hmac.new(SECRET.encode(), signing_input, hashlib.sha256).digest()
print("valid signature:", hmac.compare_digest(expected, b64url_decode(sig_b64)))
`),
            },
          ],
        },
        l5: {
          question: "Your Next.js frontend on Vercel talks to a FastAPI backend. Where do you keep the user's credential in the browser, and how do you handle logout and a stolen token?",
          hint: "localStorage vs HttpOnly cookies, XSS vs CSRF, and revocation.",
          answer: p(
            "I would avoid localStorage, because any XSS can read it and exfiltrate the token. Instead the backend sets an `HttpOnly; Secure; SameSite=Lax` cookie (ideally with the API on a subdomain of the same site, or proxied through Next.js route handlers, so it is first-party).",
            "Cookies reintroduce CSRF risk, which `SameSite=Lax` mostly mitigates for state-changing POSTs; I would add a CSRF token or check the Origin header for extra safety.",
            "For revocation, I would use either server-side sessions in Postgres or Redis, where logout and \"log out everywhere\" are just deleting rows, or short-lived JWT access tokens (around 15 minutes) with rotating refresh tokens stored server-side, so a stolen refresh token is detected on reuse and the whole family is revoked. Logout clears the cookie and deletes the server record. For a product like Cortex holding private documents, I would lean toward server sessions for simplicity and instant revocation."
          ),
        },
      },
      commonMistakes: [
        "Hashing passwords with SHA-256 or MD5 (fast hashes) instead of Argon2id or bcrypt.",
        "Putting secrets or personal data in a JWT payload, forgetting it is only encoded, not encrypted.",
        "Decoding JWTs without an explicit `algorithms` list, or with signature verification disabled.",
        "Storing tokens in localStorage, where any XSS can steal them, and issuing long-lived access tokens with no revocation path.",
      ],
      tryThis: "Paste a token from the login endpoint into jwt.io (dev tokens only) and read the payload. Then change one character in the payload section and watch verification fail.",
      miniTask: {
        title: "Break and fix your own auth",
        kind: "code",
        minutes: 40,
        steps: [
          "Run the login + /me app and get a token through the /docs Authorize button.",
          "Call /me with `curl -H \"Authorization: Bearer <token>\"` and confirm your user id.",
          "Tamper with the token (edit one payload character) and confirm you get 401.",
          "Change exp to 10 seconds, wait, and confirm the expired token is rejected.",
          "Print `ph.hash(\"same password\")` twice and explain why the two hashes differ yet both verify.",
        ],
        checklist: [
          "Valid token returns my user id",
          "Tampered token returns 401",
          "Expired token returns 401",
          "I can explain salts from the two different hashes",
          "Wrong email and wrong password return the identical error",
        ],
        deliverable: "Terminal output showing valid, tampered and expired token results, plus a two-line explanation of salting.",
      },
      quiz: [
        {
          q: "Why is SHA-256 a bad choice for storing passwords?",
          options: [
            "It is reversible",
            "It is designed to be fast, so attackers can test billions of guesses per second",
            "It produces collisions constantly",
            "Postgres cannot store it",
          ],
          answer: 1,
          explain: "Password hashing must be deliberately slow and memory-hard, which is exactly what Argon2id and bcrypt provide.",
        },
        {
          q: "What can someone who intercepts a JWT (but not the secret) do?",
          options: [
            "Nothing, it is encrypted",
            "Read its claims and use it until it expires, but not modify it",
            "Modify the claims and re-sign it",
            "Extract the signing secret",
          ],
          answer: 1,
          explain: "JWTs are signed, not encrypted. A stolen token works as a bearer credential until exp, which is why short lifetimes matter.",
        },
        {
          q: "Which cookie flag stops JavaScript on the page from reading the session cookie?",
          options: ["Secure", "SameSite=Strict", "HttpOnly", "Path=/"],
          answer: 2,
          explain: "HttpOnly hides the cookie from document.cookie, which blunts token theft via XSS. Secure restricts it to HTTPS; SameSite addresses CSRF.",
        },
      ],
      explainPrompt: "Explain to a junior engineer the difference between sessions and JWTs, and why passwords are hashed with Argon2 rather than SHA-256, in five sentences.",
      implementPrompt: "From memory, write a FastAPI login endpoint that verifies an Argon2 hash and returns a 15-minute HS256 JWT, plus a dependency that validates it.",
      videos: [
        {
          title: "Session vs token authentication",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+session+vs+jwt+authentication",
          kind: "search",
          reason: "Watch this for a visual comparison of sessions, JWTs and where each fits.",
        },
        {
          title: "OAuth 2.0 and OpenID Connect explained",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=oauth+2.0+openid+connect+authorization+code+pkce+explained",
          kind: "search",
          reason: "Watch this before adding \"Sign in with Google\" so the redirect and code exchange make sense.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "testing-apis-pytest",
    title: "Testing APIs with pytest",
    week: 4,
    domain: "backend",
    skills: ["testing", "fastapi"],
    difficulty: "medium",
    minutes: 70,
    summary: "Fast, isolated API tests with pytest fixtures, FastAPI's TestClient and dependency overrides.",
    prerequisites: ["fastapi-fundamentals"],
    tags: ["pytest", "testing", "fastapi", "fixtures", "ci"],
    lesson: {
      hook: p(
        "Friday evening you rename a field in the notes API. The endpoint you edited works. The login flow you did not touch now returns 500, and you find out from a user on Monday.",
        "Tests are how you change code without fear. For APIs specifically, a good test sends a real HTTP request to your app, in-process, in milliseconds, and checks the status code and JSON, the same contract your frontend depends on.",
        "In AI engineering this matters even more: evals in month 4 are just tests for probabilistic outputs. The habits start here."
      ),
      whyItMatters:
        "Tests are what let you refactor Cortex every month without breaking auth or data. They are also the base layer of the eval harness you will build for your LLM features.",
      levels: {
        l1: "An automated test is a small program that uses your code and checks the result is what you expect. For an API, a test sends a request, like a browser would, and checks the response. You run all your tests with one command before every change goes out.",
        l2: {
          analogy:
            "Tests are the crash-test dummies of your API. You would never ship a car because \"it drove fine around the block once\"; you run the same controlled collisions every time the design changes.",
          text: p(
            "Every good test has the same three beats: **arrange** (set up data and dependencies), **act** (make the request), **assert** (check status and body). Fixtures handle arrange so each test stays short.",
            "Isolation is the whole game. Each test must start from a known state and must not depend on another test having run first."
          ),
          diagram: {
            type: "cycle",
            title: "Red, green, refactor",
            center: "pytest -q",
            steps: [
              { label: "Write a failing test", note: "red: define the contract" },
              { label: "Make it pass", note: "green: simplest code" },
              { label: "Refactor", note: "tests keep you safe", accent: true },
              { label: "Run in CI", note: "every push" },
            ],
          },
        },
        l3: {
          text: p(
            "**pytest basics:** files named `test_*.py`, functions named `test_*`, plain `assert` statements. Run with `pytest -q`.",
            "**Fixtures** are functions decorated with `@pytest.fixture` that tests request by parameter name, the same dependency-injection idea FastAPI uses. `yield` in a fixture separates setup from teardown.",
            "**FastAPI's TestClient** (built on httpx) calls your ASGI app directly in-process, no server needed. Use it as a context manager (`with TestClient(app) as client`) so lifespan startup and shutdown run.",
            "**`app.dependency_overrides`** swaps any dependency, such as the store, the DB connection, the current user or an LLM client, for a test version. This is why good FastAPI apps put every external resource behind a dependency.",
            "**`@pytest.mark.parametrize`** runs one test body over many inputs, perfect for validation cases."
          ),
          code: [
            {
              title: "test_notes.py for the notes app from FastAPI fundamentals",
              lang: "python",
              code: code(`
# pip install pytest httpx ; run: pytest -q
import pytest
from fastapi.testclient import TestClient

from main import Store, app, get_store


@pytest.fixture
def client():
    store = Store()  # fresh state for every test
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_create_then_get(client: TestClient) -> None:
    created = client.post("/notes", json={"title": "Attention", "body": "QKV"})
    assert created.status_code == 201
    note_id = created.json()["id"]

    fetched = client.get(f"/notes/{note_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "Attention"


def test_missing_note_is_404(client: TestClient) -> None:
    assert client.get("/notes/999").status_code == 404


@pytest.mark.parametrize("payload", [{}, {"title": ""}, {"title": "x" * 201}])
def test_invalid_payload_is_422(client: TestClient, payload: dict) -> None:
    response = client.post("/notes", json=payload)
    assert response.status_code == 422


def test_delete_returns_204_and_removes(client: TestClient) -> None:
    note_id = client.post("/notes", json={"title": "tmp"}).json()["id"]
    assert client.delete(f"/notes/{note_id}").status_code == 204
    assert client.get(f"/notes/{note_id}").status_code == 404
`),
              note: "Each test gets a brand-new Store through the override, so order never matters.",
            },
          ],
        },
        l4: {
          text: p(
            "**Assertion rewriting:** pytest installs an import hook that rewrites the AST of your test modules before they run, turning a plain `assert a == b` into code that captures both sides. That is how a failing assert shows the full diff of two dicts without special assertion methods.",
            "**Fixture resolution:** pytest builds a graph from parameter names, resolves dependencies between fixtures, caches each per its **scope** (`function`, `module`, `session`) and runs teardown (code after `yield`) in reverse order. Put expensive things (a database pool) in session scope and per-test state (a transaction) in function scope.",
            "**TestClient internals:** it is an `httpx.Client` whose transport, instead of opening a socket, builds an ASGI `scope` and calls `app(scope, receive, send)` directly (running the async app via an AnyIO portal in a background thread). You exercise routing, validation, dependencies and serialisation exactly as production does, minus the network.",
            "**Database tests:** the fastest reliable isolation is to run each test inside a transaction and roll it back at the end, so no test ever sees another's rows."
          ),
          code: [
            {
              title: "Per-test transaction rollback against a real Postgres",
              lang: "python",
              code: code(`
# conftest.py (for the Postgres-backed notes lab)
import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from main import app, get_conn

TEST_DSN = os.getenv("TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/notes_test")


@pytest.fixture
def conn():
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as c:
        yield c
        c.rollback()  # throw away everything this test wrote


@pytest.fixture
def client(conn):
    app.dependency_overrides[get_conn] = lambda: conn
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
`),
              note: "Routes see a real database and real SQL, but every test starts from the same clean state.",
            },
          ],
        },
        l5: {
          question: "How would you test an endpoint that calls an LLM API to summarise a document, so that the test suite is fast, free and deterministic?",
          hint: "Where is the seam, and what do you still want to test for real?",
          answer: p(
            "I would put the LLM client behind a FastAPI dependency (or an interface the service layer receives) and, in unit and API tests, override it with a fake that returns canned responses, including malformed JSON, timeouts and rate-limit errors. That makes tests deterministic, free and millisecond-fast, and lets me assert my code's behaviour: validation of the model output, retries, error mapping to proper status codes, and that the right prompt and parameters were sent.",
            "I would not mock HTTP at the transport level everywhere, because that couples tests to the SDK's internals; overriding at my own seam is cleaner.",
            "Separately, I would have a small, opt-in suite (marked with `@pytest.mark.llm`, skipped in normal CI) that calls the real API against a few golden documents to catch prompt regressions, which grows into the proper eval harness later. The default `pytest` run stays offline."
          ),
        },
      },
      commonMistakes: [
        "Tests that depend on each other's data or on execution order, which pass locally and fail randomly in CI.",
        "Forgetting `app.dependency_overrides.clear()`, leaking overrides into later tests.",
        "Only testing the happy path. The 401, 404 and 422 paths are where production bugs hide.",
        "Calling real external APIs (LLMs, weather) in the default test run, making tests slow, flaky and costly.",
      ],
      tryThis: "Break a test on purpose, for example `assert fetched.json() == {\"title\": \"wrong\"}`, and read how pytest's assertion rewriting shows the full dict diff.",
      miniTask: {
        title: "Put the notes API under test",
        kind: "code",
        minutes: 30,
        steps: [
          "Install pytest and httpx in the venv with your notes `main.py`.",
          "Add `test_notes.py` with the fixture and four tests above; run `pytest -q`.",
          "Add a test for your PATCH endpoint that checks unsent fields stay unchanged.",
          "Add a parametrised test for three `limit` values on GET /notes (0 should be 422, 1 and 100 fine).",
          "Run `pytest -q --durations=5` and confirm the whole suite takes under a second.",
        ],
        checklist: [
          "All tests pass with `pytest -q`",
          "Every test creates its own data; running any single test alone passes",
          "At least one test covers 404 and one covers 422",
          "The PATCH test proves partial updates work",
        ],
        deliverable: "A passing `test_notes.py` with at least seven tests.",
      },
      quiz: [
        {
          q: "What does `app.dependency_overrides[get_store] = lambda: store` do in a test?",
          options: [
            "Replaces get_store with the lambda for every request while the override is set",
            "Deletes the route",
            "Only affects the next request",
            "Mocks the HTTP layer",
          ],
          answer: 0,
          explain: "FastAPI consults dependency_overrides whenever it resolves dependencies, so every request uses the test version until cleared.",
        },
        {
          q: "Why use `with TestClient(app) as client:` instead of just `TestClient(app)`?",
          options: [
            "It is faster",
            "The context manager runs the app's lifespan startup and shutdown",
            "It enables HTTPS",
            "It is required for GET requests",
          ],
          answer: 1,
          explain: "Without the context manager, lifespan does not run, so resources created at startup (pools, clients) would be missing.",
        },
        {
          q: "What does `@pytest.mark.parametrize(\"payload\", [a, b, c])` do?",
          options: [
            "Runs the test once with all three payloads merged",
            "Generates three separate test cases, one per payload",
            "Randomly picks one payload",
            "Marks the test as slow",
          ],
          answer: 1,
          explain: "Each value becomes its own test case with its own pass/fail result.",
        },
      ],
      explainPrompt: "Explain to a junior engineer how pytest fixtures and FastAPI dependency overrides combine to make API tests isolated, in five sentences.",
      implementPrompt: "From memory, write a pytest fixture that yields a TestClient with an overridden dependency, plus a parametrised test asserting three invalid payloads return 422.",
      videos: [
        {
          title: "pytest tutorial",
          channel: "ArjanCodes",
          url: "https://www.youtube.com/results?search_query=arjancodes+pytest",
          kind: "search",
          reason: "Watch this for idiomatic fixtures, parametrize and structuring a test suite.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "redis-weather-cache",
    title: "Cache a weather API behind Redis",
    week: 4,
    duration: "45m",
    minutes: 45,
    difficulty: "easy",
    domain: "backend",
    skills: ["caching", "fastapi", "async-concurrency"],
    prerequisites: ["Redis & caching", "Async Python & the event loop"],
    topicSlugs: ["redis-caching", "async-python"],
    objective: "Put Redis cache-aside in front of the Open-Meteo API, then prove the win with real latency numbers and protect it against a stampede.",
    expectedOutput: "A FastAPI `/weather` endpoint with x-cache headers, a benchmark script printing p50/p95 for cold vs warm requests, and a note with the measured speed-up.",
    steps: [
      {
        title: "Run Redis and the baseline",
        detail: "Start Redis (`redis-server`, check `redis-cli ping`). Build `/weather?lat=&lon=` that calls `https://api.open-meteo.com/v1/forecast` with `current=temperature_2m,wind_speed_10m` using a shared `httpx.AsyncClient` from lifespan. No cache yet.",
      },
      {
        title: "Benchmark without cache",
        detail: "Write `bench.py` that sends 30 sequential requests to your endpoint with httpx and records each duration. Print p50 and p95 with `statistics.median` and `statistics.quantiles(durations, n=20)[-1]` (the starter below does this).",
      },
      {
        title: "Add cache-aside",
        detail: "Key `weather:v1:{lat:.2f}:{lon:.2f}`, `SET ... EX 600`, `x-cache: HIT|MISS` header. Rerun the benchmark; the first request is a miss, the rest hits.",
      },
      {
        title: "Add jitter and graceful degradation",
        detail: "Use a TTL of 600 plus `random.randint(0, 60)` so keys created together do not expire together. Catch `redis.exceptions.ConnectionError` around cache reads and writes and fall back to the API.",
      },
      {
        title: "Stampede protection",
        detail: "On a miss, try `SET lock:{key} 1 NX EX 10`. If you get the lock, fetch and populate. If not, poll the cache key a few times with `await asyncio.sleep(0.05)` before falling back. Test by deleting the key and firing 50 concurrent requests with `asyncio.gather`, counting upstream calls with a log line.",
      },
      {
        title: "Write up",
        detail: "Record p50/p95 without and with cache, the speed-up factor, and how many upstream calls the 50-request stampede test caused with and without the lock.",
      },
    ],
    hints: [
      "Open-Meteo needs no API key, which keeps this lab free.",
      "Measure from the client side (bench.py), not only inside the handler, so you include serialisation and network overhead.",
      "Release the lock with DEL after populating the cache, and keep the lock's EX short so a crashed worker cannot hold it forever.",
    ],
    stretch: "Implement stale-while-revalidate: store `fetched_at` with the value, serve anything under 15 minutes old immediately, and refresh in the background with `asyncio.create_task` when it is older than 10 minutes.",
    learned: [
      "Implementing cache-aside with sensible keys and TTLs",
      "Measuring latency with percentiles rather than averages",
      "Preventing stampedes with SET NX locks and TTL jitter",
      "Designing caches that fail open when Redis is unavailable",
    ],
    starter: {
      title: "bench.py",
      lang: "python",
      code: code(`
import statistics
import time

import httpx

URL = "http://127.0.0.1:8000/weather"
PARAMS = {"lat": 13.08, "lon": 80.27}

durations: list[float] = []
with httpx.Client() as client:
    for _ in range(30):
        start = time.perf_counter()
        r = client.get(URL, params=PARAMS)
        durations.append((time.perf_counter() - start) * 1000)
        r.raise_for_status()

p50 = statistics.median(durations)
p95 = statistics.quantiles(durations, n=20)[-1]  # 95th percentile
print(f"p50 {p50:.1f} ms | p95 {p95:.1f} ms | max {max(durations):.1f} ms")
`),
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "auth-from-scratch",
    title: "Auth from scratch in FastAPI",
    week: 4,
    duration: "3h",
    minutes: 180,
    difficulty: "hard",
    domain: "backend",
    skills: ["auth", "web-security", "fastapi", "sql-postgres", "testing"],
    prerequisites: ["Authentication: sessions, JWT & OAuth", "Testing APIs with pytest", "SQL & Postgres: joins, indexes, transactions"],
    topicSlugs: ["authentication-sessions-jwt", "testing-apis-pytest", "sql-postgres-essentials"],
    objective: "Implement registration, login, server-side sessions in an HttpOnly cookie and JWT bearer tokens in FastAPI with Postgres, Argon2 password hashing, a protected route and a test suite.",
    expectedOutput: "Endpoints: POST /auth/register, POST /auth/login (sets session cookie), POST /auth/logout, POST /auth/token (JWT), GET /me (accepts cookie or bearer). A pytest suite of 10+ tests passes.",
    steps: [
      {
        title: "Schema",
        detail: "Tables: `users (id, email UNIQUE, password_hash, created_at)` and `sessions (id text PRIMARY KEY, user_id REFERENCES users ON DELETE CASCADE, created_at, expires_at)`. Store emails lowercased; add an index on `sessions (user_id)`.",
      },
      {
        title: "Register",
        detail: "Validate `email` with Pydantic `EmailStr` (install `email-validator`) and a password of at least 12 characters. Hash with `argon2.PasswordHasher().hash`. Catch the unique violation (`psycopg.errors.UniqueViolation`) and return 409. Return 201 with id and email only.",
      },
      {
        title: "Login with sessions",
        detail: "Verify the hash (generic 401 on any failure). Create a session id with `secrets.token_urlsafe(32)`, insert it with `expires_at = now() + interval '7 days'`, and `response.set_cookie(\"session\", sid, httponly=True, secure=True, samesite=\"lax\", max_age=604800)`. Note: browsers accept Secure cookies on http://localhost; for curl, use the -c/-b cookie jar flags.",
      },
      {
        title: "Tokens for API clients",
        detail: "POST /auth/token accepts `OAuth2PasswordRequestForm` and returns a 15-minute HS256 JWT with `sub`, `iat`, `exp`. Load the secret from an environment variable and fail fast at startup if it is missing or shorter than 32 bytes.",
      },
      {
        title: "One current_user dependency",
        detail: "Write `current_user` that first checks the session cookie (look up an unexpired session, join to users), then falls back to a bearer JWT. Raise 401 with `WWW-Authenticate: Bearer` if neither is valid. Protect GET /me with it.",
      },
      {
        title: "Logout",
        detail: "Delete the session row and call `response.delete_cookie(\"session\")`. A subsequent /me with the old cookie must return 401. Add POST /auth/logout-all that deletes every session for the user.",
      },
      {
        title: "Tests",
        detail: "Using the transaction-rollback fixture pattern, test: register 201, duplicate 409, weak password 422, login wrong password 401, login unknown email 401 with the identical body, /me via cookie, /me via bearer, tampered JWT 401, expired JWT 401 (issue one with exp in the past), logout invalidates the session.",
      },
    ],
    hints: [
      "TestClient keeps cookies between requests on the same client, so login then /me just works in tests.",
      "To test expiry without sleeping, encode a token directly with `exp` set to one minute ago.",
      "Compare error bodies for wrong-password and unknown-email with `==` in a test to guarantee no user enumeration.",
      "Call `ph.check_needs_rehash(hash)` after successful verification and update the stored hash if it returns True.",
    ],
    stretch: "Add login rate limiting with Redis (`INCR login:{ip}` + `EXPIRE 60`, 429 after 5 failures) and a refresh-token flow with rotation and reuse detection.",
    learned: [
      "Storing passwords safely with Argon2id and rehash-on-login",
      "Implementing revocable server-side sessions with secure cookies",
      "Issuing and validating JWTs with pinned algorithms and expiry",
      "Testing security properties: tampering, expiry, enumeration, logout",
    ],
    starter: {
      title: "schema.sql",
      lang: "sql",
      code: code(`
CREATE TABLE IF NOT EXISTS users (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         text NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id         text PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- current_user lookup
-- SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
-- WHERE s.id = %s AND s.expires_at > now();
`),
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "flagship-v1-auth-database",
    title: "Cortex v0.1: auth + database",
    week: 4,
    duration: "weekend",
    minutes: 600,
    difficulty: "hard",
    domain: "backend",
    skills: ["fastapi", "sql-postgres", "data-modeling", "auth", "api-design", "testing"],
    prerequisites: [
      "FastAPI: production-shaped APIs",
      "SQL & Postgres: joins, indexes, transactions",
      "Authentication: sessions, JWT & OAuth",
      "Testing APIs with pytest",
      "Auth from scratch in FastAPI",
    ],
    topicSlugs: [
      "fastapi-fundamentals",
      "rest-api-design",
      "sql-postgres-essentials",
      "authentication-sessions-jwt",
      "testing-apis-pytest",
    ],
    objective: "Start Cortex, your personal AI research assistant, as a real repository: a FastAPI backend with Postgres, users, authentication and a documents table, runnable locally without Docker and documented so anyone can run it in five minutes.",
    expectedOutput: "A GitHub repo `cortex` where `uv run fastapi dev` (or venv + `fastapi dev`) starts the API, `/docs` shows /v1/auth/*, /v1/me and /v1/documents endpoints, `pytest` passes, and the README explains setup, architecture and next steps.",
    steps: [
      {
        title: "Repository structure",
        detail: "Create `cortex/` with `app/main.py` (app + lifespan), `app/config.py` (pydantic-settings `Settings` reading DATABASE_URL and SECRET_KEY from `.env`), `app/db.py` (pool + `get_conn`), `app/auth.py`, `app/routes/documents.py`, `migrations/001_init.sql`, `tests/`, `pyproject.toml`, `.env.example`, `README.md`. Add `.env` to `.gitignore`.",
      },
      {
        title: "Schema and migration",
        detail: "`001_init.sql` creates `users`, `sessions` and `documents (id, owner_id FK ON DELETE CASCADE, title, source_url, content, content_hash, status CHECK IN ('ready','processing','failed'), metadata jsonb, created_at, updated_at)` with an index on `(owner_id, created_at DESC)` and a UNIQUE constraint on `(owner_id, content_hash)` to prevent duplicate uploads. Add a tiny `scripts/migrate.py` that applies files in order and records them in a `schema_migrations` table.",
      },
      {
        title: "Auth",
        detail: "Port your auth-from-scratch work into `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/logout` and `/v1/me`, with Argon2id, session cookie and bearer JWT support behind one `current_user` dependency.",
      },
      {
        title: "Documents API",
        detail: "`POST /v1/documents` (201; computes `sha256(content)`; 409 on duplicate), `GET /v1/documents` (cursor pagination on `(created_at, id)`), `GET /v1/documents/{id}`, `DELETE /v1/documents/{id}` (204). Every query filters by `owner_id = current_user.id`; a user requesting someone else's document gets 404, not 403, so ids do not leak.",
      },
      {
        title: "Errors and health",
        detail: "Add a consistent error shape via an exception handler and `GET /health` that runs `SELECT 1` and returns 200 or 503.",
      },
      {
        title: "Tests",
        detail: "At least 12 tests: auth happy/sad paths, document CRUD, pagination across two pages, duplicate upload 409, and the crucial one: user B cannot read, list or delete user A's documents.",
      },
      {
        title: "README",
        detail: "What Cortex is (one paragraph), a local setup section (install Postgres, `createdb cortex`, copy `.env.example`, run migrations, start the server), an architecture sketch, the endpoint table, how to run tests, and a roadmap line for month 2 (ingestion and chunking) and month 3 (embeddings and cited answers).",
      },
    ],
    hints: [
      "pydantic-settings: `class Settings(BaseSettings): model_config = SettingsConfigDict(env_file=\".env\")` then `settings = Settings()`.",
      "Write the tenant isolation test first. It is the one bug that would make Cortex untrustworthy.",
      "Keep route handlers thin: SQL in small functions in a `repo` module makes both testing and the month-3 move to embeddings easier.",
      "If you use uv, `uv add fastapi[standard] psycopg[binary] psycopg-pool argon2-cffi pyjwt pydantic-settings email-validator` and `uv add --dev pytest httpx`.",
    ],
    stretch: "Add GitHub Actions CI that starts a Postgres service container, runs migrations and runs pytest on every push, and add Redis-backed rate limiting on the login endpoint.",
    learned: [
      "Structuring a real FastAPI project with config, db, auth and routes separated",
      "Designing a multi-tenant schema with ownership enforced in every query",
      "Writing SQL migrations and a reproducible local setup",
      "Documenting a backend so another engineer can run it in minutes",
    ],
    starter: {
      title: "app/config.py and app/db.py",
      lang: "python",
      code: code(`
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/cortex"
    secret_key: str
    access_token_minutes: int = 15


settings = Settings()  # fails fast at startup if SECRET_KEY is missing


# app/db.py
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

pool = ConnectionPool(settings.database_url, kwargs={"row_factory": dict_row}, open=False)


def get_conn() -> Iterator[psycopg.Connection]:
    with pool.connection() as conn:  # commit on success, rollback on error
        yield conn

# In app/main.py lifespan: pool.open() at startup, pool.close() at shutdown.
`),
      note: "Shown as one block for brevity; in the repo, db.py imports settings from app.config.",
    },
  },
];
