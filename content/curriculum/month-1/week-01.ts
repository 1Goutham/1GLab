import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");
/** Code bodies are written flush-left starting on the line after the backtick. */
const code = (s: string) => s.replace(/^\n/, "").replace(/\s+$/, "");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "http-request-lifecycle",
    title: "HTTP & the request lifecycle",
    week: 1,
    domain: "backend",
    skills: ["http", "api-design"],
    difficulty: "easy",
    minutes: 60,
    summary: "What actually happens between typing a URL and seeing a page: methods, status codes, headers and bodies.",
    tags: ["http", "devtools", "headers", "status-codes", "web"],
    lesson: {
      hook: p(
        "You have shipped a dozen apps on Vercel. Every one of them is, underneath, a machine that receives text messages and sends text messages back.",
        "When IdeaGuard calls the OpenAI API, when your Next.js page fetches data, when a browser loads 1goutham.space, it is the same conversation: a **request** with a method, a path and some headers, and a **response** with a status code, some headers and a body.",
        "Most bugs you will debug as a backend engineer (CORS errors, stale caches, 401 loops, a 502 from a proxy) are readable directly in those few lines of text. This lesson is about learning to read them fluently."
      ),
      whyItMatters:
        "Every LLM API, every tool an agent calls and every endpoint in Cortex speaks HTTP. If you can read a request and response precisely, you can debug any of them.",
      levels: {
        l1: "A browser asks a server for something by sending a short, structured note: what it wants (the method and path) plus some extra details (headers). The server replies with a number saying how it went (the status code), its own details, and usually some content. That round trip is one HTTP request.",
        l2: {
          analogy:
            "HTTP is a restaurant order slip. The method is the verb (GET me the menu, POST a new order), the path is the dish, the headers are notes to the kitchen (\"no onions\", \"I speak English\"), and the status code is the waiter's one-word reply before the food arrives: 200 here you go, 404 we do not have that, 500 the kitchen is on fire.",
          text: p(
            "Every request travels through the same pipeline. Your browser resolves the host, opens a connection, sends the request, and the server (on Vercel, first an edge proxy, then your function) builds a response.",
            "The important insight: each request is **independent**. HTTP is stateless. Anything the server should remember about you (a login, a cart) has to travel with every request, usually as a cookie or an `Authorization` header."
          ),
          diagram: {
            type: "flow",
            title: "One request, end to end",
            lanes: [
              {
                label: "Request",
                tone: "neutral",
                steps: [
                  { label: "Browser", note: "GET /api/projects" },
                  { label: "DNS + TCP + TLS", note: "find and connect" },
                  { label: "Edge / CDN", note: "cache hit?" },
                  { label: "App server", note: "route + handler", accent: true },
                  { label: "Database", note: "query" },
                ],
              },
              {
                label: "Response",
                tone: "good",
                steps: [
                  { label: "Handler", note: "build JSON" },
                  { label: "Status + headers", note: "200, content-type" },
                  { label: "Edge", note: "maybe cache it" },
                  { label: "Browser", note: "render / parse", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "A request has four parts: **method** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), **target** (path + query string), **headers** (key-value metadata) and an optional **body**. A response has a **status code**, headers and an optional body.",
            "Status code families are worth memorising: `2xx` success (`200 OK`, `201 Created`, `204 No Content`), `3xx` go elsewhere (`301`, `304 Not Modified`), `4xx` the client did something wrong (`400`, `401` not authenticated, `403` not allowed, `404`, `422` validation failed, `429` rate limited), `5xx` the server failed (`500`, `502` bad gateway, `503`, `504` gateway timeout).",
            "Method semantics matter: `GET`, `PUT` and `DELETE` are **idempotent** (doing them twice has the same effect as once), `POST` is not. `GET` should never change data, because browsers, crawlers and CDNs are allowed to repeat or prefetch it.",
            "The headers you will read daily: `content-type`, `content-length`, `cache-control`, `etag`, `set-cookie`, `authorization`, `location` (on redirects), and on Vercel, `x-vercel-cache` (HIT / MISS / STALE)."
          ),
          code: [
            {
              title: "See the raw conversation with curl",
              lang: "bash",
              code: code(`
# -v prints the request lines (>) and response lines (<)
curl -sv https://1goutham.space -o /dev/null

# Only the response headers
curl -sI https://1goutham.space

# A POST with a JSON body, the shape every LLM API call has
curl -s https://httpbin.org/post \\
  -H "content-type: application/json" \\
  -d '{"question": "what is HTTP?"}'
`),
              note: "httpbin.org echoes your request back, which makes it a perfect mirror for learning.",
            },
            {
              title: "The same request from Python",
              lang: "python",
              code: code(`
# pip install httpx
import httpx

resp = httpx.get("https://1goutham.space", follow_redirects=True)

print(resp.request.method, resp.request.url)
print("status:", resp.status_code, resp.reason_phrase)
for name in ["content-type", "cache-control", "x-vercel-cache", "server"]:
    print(f"{name}: {resp.headers.get(name)}")
print("body bytes:", len(resp.content))
print("took:", resp.elapsed.total_seconds(), "s")
`),
            },
          ],
        },
        l4: {
          text: p(
            "Under every library, HTTP/1.1 is literally ASCII text written to a TCP socket. The request line, then headers, each ending in CRLF (`\\r\\n`), then an empty line, then the body. The server replies in the same shape. `content-length` (or `transfer-encoding: chunked`) tells the reader where the body ends.",
            "HTTP/2 and HTTP/3 (what Vercel actually serves to modern browsers) keep exactly the same **semantics** (methods, headers, status codes) but change the **wire format**: binary frames, compressed headers (HPACK/QPACK) and many requests multiplexed over one connection. That is why DevTools shows the protocol as `h2` or `h3`, and why header names appear lowercase.",
            "Run the script below against a plain-HTTP host to see the bytes with nothing hidden."
          ),
          code: [
            {
              title: "HTTP by hand over a raw socket",
              lang: "python",
              code: code(`
import socket

host = "example.com"
request = (
    "GET / HTTP/1.1\\r\\n"
    f"Host: {host}\\r\\n"
    "User-Agent: goutham-raw-socket\\r\\n"
    "Connection: close\\r\\n"
    "\\r\\n"
)

with socket.create_connection((host, 80)) as sock:
    sock.sendall(request.encode("ascii"))
    chunks = []
    while data := sock.recv(4096):
        chunks.append(data)

raw = b"".join(chunks).decode("utf-8", errors="replace")
head, _, body = raw.partition("\\r\\n\\r\\n")
print(head)
print("--- body starts ---")
print(body[:200])
`),
              note: "The status line and headers you print here are exactly what curl -v shows.",
            },
          ],
        },
        l5: {
          question: "A user reports that after logging out, pressing the browser back button still shows their dashboard. Walk me through what is happening at the HTTP level and how you would fix it.",
          hint: "Think about which layer served that page on back navigation, and which headers control it.",
          answer: p(
            "The back button usually does not hit the server at all: the browser shows the page from its back/forward cache or HTTP cache, which was populated while the user was logged in. So logout (which cleared the session cookie server-side) never gets a chance to reject the request.",
            "I would confirm it in DevTools: the Network tab shows the document served \"from disk cache\" or no request at all. The fix is to mark authenticated pages as non-storable with `Cache-Control: no-store` (and `private` for anything user-specific that must never land in a shared CDN cache). I would also make sure the logout response expires the cookie with `Set-Cookie` and `Max-Age=0`, and that any API calls on that page return 401 so the client redirects to login.",
            "The underlying principle: HTTP is stateless and caches are allowed to replay responses, so anything user-specific must say explicitly who may store it and for how long."
          ),
        },
      },
      commonMistakes: [
        "Using `GET` for actions that change data (`GET /delete?id=4`). Crawlers, prefetchers and retries will happily trigger it.",
        "Returning `200 OK` with `{\"error\": \"...\"}` in the body. Clients, monitoring and retries all key off the status code; errors must use 4xx/5xx.",
        "Confusing `401` and `403`: 401 means \"I do not know who you are\", 403 means \"I know who you are and the answer is no\".",
        "Reading only the response body when debugging. The answer is often in a header: `location`, `cache-control`, `www-authenticate`, `x-vercel-cache`.",
      ],
      tryThis: "Run `curl -sI https://1goutham.space` twice in a row and compare the `x-vercel-cache` and `age` headers. You just watched a CDN cache warm up.",
      miniTask: {
        title: "Dissect one GET request on 1goutham.space",
        kind: "observe",
        minutes: 15,
        steps: [
          "Open Chrome DevTools (Cmd/Ctrl + Option/Alt + I), go to the Network tab and tick \"Disable cache\".",
          "Visit https://1goutham.space and let the page finish loading.",
          "Filter by \"Doc\" or \"Fetch/XHR\" and click one GET request (the HTML document itself is a good first choice).",
          "In the Headers pane, write down the full request URL, the request method and the status code.",
          "Open the Response (or Preview) pane and note what came back: HTML, JSON or something else, and roughly how big it was.",
          "Back in Headers, note three response headers and write one sentence each on what they tell the browser.",
        ],
        checklist: [
          "I recorded the exact URL and confirmed the method is GET",
          "I recorded the status code and can say which family it belongs to",
          "I looked at the actual response content, not just the headers",
          "I can explain three response headers (e.g. content-type, cache-control, x-vercel-cache) in my own words",
        ],
        deliverable: "A short note with URL, method, status, response type/size and three explained headers.",
      },
      quiz: [
        {
          q: "Your API receives the same `PUT /users/42` request twice because of a network retry. What should happen?",
          options: [
            "Two users are created",
            "The second request fails with 409",
            "The end state is the same as if it ran once, because PUT is idempotent",
            "The server must reject all retries",
          ],
          answer: 2,
          explain: "PUT replaces the resource at a known URL, so repeating it leaves the same state. That is exactly why retries are safe for PUT and risky for POST.",
        },
        {
          q: "A logged-in user requests an admin-only endpoint they are not allowed to use. Which status fits best?",
          options: ["400", "401", "403", "404"],
          answer: 2,
          explain: "The server knows who they are (they are authenticated) but refuses the action: 403 Forbidden. 401 is for missing or invalid credentials.",
        },
        {
          q: "What changed between HTTP/1.1 and HTTP/2?",
          options: [
            "Methods and status codes were redesigned",
            "The wire format became binary frames with multiplexing, while semantics stayed the same",
            "HTTP/2 removed headers",
            "HTTP/2 only works for APIs, not web pages",
          ],
          answer: 1,
          explain: "HTTP/2 keeps GET, 200, content-type and friends, but sends them as compressed binary frames and multiplexes many requests on one connection.",
        },
      ],
      explainPrompt: "Explain to a junior engineer what happens between clicking a link and seeing the page, naming the method, status code and three headers involved, in five sentences.",
      implementPrompt: "From memory, write a Python script that sends a raw HTTP/1.1 GET over a socket to example.com and prints the status line and headers.",
      videos: [
        {
          title: "HTTP crash course / how HTTP works",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+http+crash+course",
          kind: "search",
          reason: "Watch this if you want a backend engineer's walkthrough of requests, headers and HTTP/1.1 vs HTTP/2 beyond this page.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "dns-tcp-tls",
    title: "DNS, TCP & TLS: before the first byte",
    week: 1,
    domain: "backend",
    skills: ["http"],
    difficulty: "medium",
    minutes: 60,
    summary: "The three handshakes that happen before any HTTP is sent, and why they dominate latency.",
    prerequisites: ["http-request-lifecycle"],
    tags: ["dns", "tcp", "tls", "latency", "networking"],
    lesson: {
      hook: p(
        "Open DevTools on 1goutham.space, hover the Waterfall bar of the first request, and you will see phases called DNS Lookup, Initial connection and SSL, all before \"Waiting for server response\".",
        "On a cold connection from India to a US region those phases can cost more than your entire handler. Your FastAPI endpoint might answer in 8 ms while the user waited 400 ms before the request even arrived.",
        "When you later put Cortex behind a domain and call LLM APIs from it, knowing what happens before the first byte is how you tell \"my code is slow\" apart from \"the network is slow\"."
      ),
      whyItMatters:
        "Connection setup is a hidden latency tax on every LLM call and every API hop. Connection reuse and keep-alive are some of the cheapest performance wins in AI backends.",
      levels: {
        l1: "Before your browser can ask a server for anything, it needs three things: the server's address (DNS), a reliable line to it (TCP), and a way to make that line private and verified (TLS). Each one needs messages to travel back and forth, and each trip takes time.",
        l2: {
          analogy:
            "DNS is looking up a friend's number in your contacts. TCP is calling and both saying \"hello, can you hear me?\" before talking. TLS is agreeing on a secret code language and checking their ID before sharing anything sensitive.",
          text: p(
            "The cost is counted in **round trips** (RTT). DNS is usually one round trip (often zero, thanks to caching). TCP is one round trip. TLS 1.3 adds one more. Only then does the HTTP request go out, costing another round trip for the response.",
            "So a brand-new HTTPS request is roughly 3 to 4 RTTs. At 100 ms RTT that is 300 to 400 ms of pure waiting. Reusing an open connection skips all of it."
          ),
          diagram: {
            type: "flow",
            title: "Cold vs warm connection",
            lanes: [
              {
                label: "Cold (new connection)",
                tone: "bad",
                steps: [
                  { label: "DNS lookup", note: "~1 RTT" },
                  { label: "TCP SYN / SYN-ACK / ACK", note: "1 RTT" },
                  { label: "TLS 1.3 handshake", note: "1 RTT" },
                  { label: "HTTP request/response", note: "1 RTT", accent: true },
                ],
              },
              {
                label: "Warm (keep-alive)",
                tone: "good",
                steps: [
                  { label: "Reuse open TLS connection", note: "0 RTT setup" },
                  { label: "HTTP request/response", note: "1 RTT", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**DNS** turns `1goutham.space` into an IP address. Your OS asks a recursive resolver (your ISP, 1.1.1.1 or 8.8.8.8) which walks root, `.space` TLD and authoritative servers, then caches the answer for its **TTL**. Record types you will use: `A` (IPv4), `AAAA` (IPv6), `CNAME` (alias to another name, which is how Vercel custom domains often work), `TXT` (verification, SPF).",
            "**TCP** gives you an ordered, reliable byte stream on top of lossy IP packets, via the SYN, SYN-ACK, ACK handshake, sequence numbers, acknowledgements and retransmission.",
            "**TLS** encrypts that stream and proves the server's identity with a certificate chain your OS trusts. TLS 1.3 needs one round trip; TLS 1.2 needed two.",
            "The practical rule for backend code: **reuse connections**. Create one HTTP client and share it. A new client per request means a new DNS + TCP + TLS dance per request."
          ),
          code: [
            {
              title: "Measure each phase with curl",
              lang: "bash",
              code: code(`
curl -o /dev/null -s -w "dns:      %{time_namelookup}s
connect:  %{time_connect}s
tls:      %{time_appconnect}s
ttfb:     %{time_starttransfer}s
total:    %{time_total}s
" https://1goutham.space

dig +short 1goutham.space          # A records
dig 1goutham.space CNAME +short    # alias, if any
`),
              note: "Each curl timing is cumulative from the start, so tls minus connect is the TLS handshake cost.",
            },
            {
              title: "New client per call vs one shared client",
              lang: "python",
              code: code(`
# pip install httpx
import time
import httpx

URL = "https://httpbin.org/get"

start = time.perf_counter()
for _ in range(5):
    with httpx.Client() as client:  # new connection every time
        client.get(URL)
print(f"new client each call: {time.perf_counter() - start:.2f}s")

start = time.perf_counter()
with httpx.Client() as client:      # one pooled keep-alive connection
    for _ in range(5):
        client.get(URL)
print(f"shared client:        {time.perf_counter() - start:.2f}s")
`),
            },
          ],
        },
        l4: {
          text: p(
            "**TCP handshake:** the client sends SYN with a random initial sequence number, the server replies SYN-ACK with its own, the client ACKs. Both sides now agree on sequence numbers, so every byte can be acknowledged and lost segments retransmitted. **Slow start** means a new connection begins with a small congestion window and ramps up, another reason warm connections are faster for large responses.",
            "**TLS 1.3 handshake:** the ClientHello already includes a key share (an ephemeral Diffie-Hellman public key) and the SNI (the hostname, so one Vercel IP can serve thousands of domains). The server replies with its key share, certificate and a signature proving it owns the certificate's private key. Both sides derive the same session keys from the Diffie-Hellman exchange. The long-term key only signs; it never encrypts the traffic, which is what gives **forward secrecy**.",
            "**HTTP/3** runs over QUIC on UDP and merges the transport and TLS handshakes into one round trip, with 0-RTT resumption for repeat visits."
          ),
          diagram: {
            type: "stack",
            title: "What wraps an HTTPS request",
            layers: [
              { label: "HTTP", note: "GET /api/projects, headers, JSON", accent: true },
              { label: "TLS", note: "encryption + certificate identity" },
              { label: "TCP", note: "ordered, reliable byte stream (port 443)" },
              { label: "IP", note: "packets addressed to 76.76.21.21-style IPs" },
              { label: "Link", note: "Wi-Fi / Ethernet frames" },
            ],
          },
        },
        l5: {
          question: "Your FastAPI service calls the OpenAI API and p50 latency is fine but you see an extra 150 to 300 ms on some requests. How do you investigate and what is a likely fix?",
          hint: "Which requests are slow: the first ones after idle, or random ones?",
          answer: p(
            "I would first separate network setup from model time. Logging per-phase timings (or using httpx event hooks or an OpenTelemetry trace) shows whether the extra time is in connect/TLS or in time to first byte.",
            "A very common cause is creating a new HTTP client per request, so every call pays DNS, TCP and TLS again, or idle pooled connections being closed and re-established. The fix is a single long-lived client created at app startup (for example in FastAPI's lifespan) with a connection pool and sensible keep-alive, and the SDK client reused across requests.",
            "If the slow ones correlate with cold starts, that is a deployment concern instead: warm instances or a region closer to the API. I would verify the fix by comparing latency histograms before and after, not just averages."
          ),
        },
      },
      commonMistakes: [
        "Creating a new `httpx.Client` or SDK client inside every request handler, paying a full handshake each time.",
        "Blaming your code for latency that DevTools clearly shows in the DNS, Initial connection or SSL phase.",
        "Setting a 24-hour DNS TTL right before a migration, then waiting a day for clients to see the new IP.",
        "Thinking HTTPS encrypts the hostname. SNI in the ClientHello is still visible to the network unless Encrypted Client Hello is used.",
      ],
      tryThis: "Run the curl timing command twice against the same URL with `--next` between two URLs of the same host, and notice connect and tls drop to near zero on the second.",
      miniTask: {
        title: "Time the invisible phases",
        kind: "observe",
        minutes: 20,
        steps: [
          "Run the curl `-w` timing command against https://1goutham.space and against https://api.openai.com (a 404 or 401 response is fine; you only need the timings).",
          "Compute DNS, TCP (connect minus dns) and TLS (appconnect minus connect) for each.",
          "Run `dig 1goutham.space` and note the record type, value and TTL.",
          "Run the shared-client vs new-client Python script and record both numbers.",
        ],
        checklist: [
          "I have per-phase timings for two hosts",
          "I can say which phase dominated and why",
          "I know my domain's DNS record type and TTL",
          "I measured the difference connection reuse makes",
        ],
        deliverable: "A four-line table of dns / tcp / tls / ttfb for two hosts plus the reuse comparison.",
      },
      quiz: [
        {
          q: "Roughly how many round trips does a brand-new HTTPS (TLS 1.3, HTTP/1.1 or HTTP/2) request cost before the response starts, assuming a DNS cache miss?",
          options: ["1", "2", "About 4", "About 10"],
          answer: 2,
          explain: "DNS (~1) + TCP (1) + TLS 1.3 (1) + the HTTP request itself (1).",
        },
        {
          q: "What does SNI let a server do?",
          options: [
            "Encrypt the request body",
            "Serve the right certificate when many domains share one IP address",
            "Skip the TCP handshake",
            "Cache DNS responses",
          ],
          answer: 1,
          explain: "The client names the hostname in the ClientHello, so a shared edge like Vercel knows which certificate to present.",
        },
        {
          q: "Where should a FastAPI app create its httpx.AsyncClient for calling an external API?",
          options: [
            "Inside each route handler",
            "Once at startup (lifespan) and reuse it",
            "In a new thread per request",
            "It does not matter",
          ],
          answer: 1,
          explain: "A single shared client keeps a connection pool alive, so requests skip DNS, TCP and TLS setup.",
        },
      ],
      explainPrompt: "Explain to a junior engineer why the first request to a new host is slower than the second, naming DNS, TCP and TLS, in five sentences.",
      implementPrompt: "From memory, write a Python snippet that measures the time of five GET requests with a new client each time vs a shared client.",
      videos: [
        {
          title: "TCP three-way handshake and TLS explained",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+tcp+three+way+handshake+tls+1.3",
          kind: "search",
          reason: "Watch this if the SYN / SYN-ACK / ACK and TLS 1.3 key exchange are still abstract.",
        },
        {
          title: "How DNS works",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+how+does+dns+work",
          kind: "search",
          reason: "Watch this for a short visual of recursive resolvers, TLDs and caching.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "big-o-complexity",
    title: "Big-O: thinking in growth",
    week: 1,
    domain: "dsa",
    skills: ["complexity", "arrays"],
    difficulty: "easy",
    minutes: 60,
    summary: "How to predict what happens to your code when the input gets 1,000 times bigger.",
    tags: ["big-o", "complexity", "arrays", "dsa"],
    lesson: {
      hook: p(
        "FabricNest has 200 products and your \"related products\" function compares every product with every other one. It runs in 4 ms. Nobody notices.",
        "Then a supplier uploads 50,000 products. The same function now does 2.5 billion comparisons and the page times out.",
        "The code did not change. The **growth** did. Big-O is the tool for seeing that coming before production does."
      ),
      whyItMatters:
        "Retrieval over thousands of chunks, deduplicating documents, comparing embeddings: AI systems are full of loops over data that grows. Big-O tells you which ones will hurt.",
      levels: {
        l1: "Big-O describes how the amount of work grows as the input grows. If doubling the input doubles the work, that is linear. If doubling the input quadruples the work, that is quadratic, and it gets painful fast.",
        l2: {
          analogy:
            "Finding a name in a phone book by reading every page is O(n). Opening it in the middle and halving each time is O(log n). Checking whether any two people in the book share a birthday by comparing every pair is O(n squared).",
          text: p(
            "Big-O ignores constants and small terms, because at scale only the dominant shape matters. `3n + 20` and `n` are both O(n). What matters is the family: O(1), O(log n), O(n), O(n log n), O(n^2), O(2^n).",
            "At a million items the difference between families is not a percentage, it is the difference between milliseconds and days."
          ),
          diagram: {
            type: "compare",
            title: "Operations at n = 1,000,000",
            left: {
              label: "Fine at scale",
              points: [
                "O(1): 1 step (dict lookup)",
                "O(log n): ~20 steps (binary search)",
                "O(n): 1,000,000 steps (one pass)",
                "O(n log n): ~20,000,000 steps (sorting)",
              ],
            },
            right: {
              label: "Breaks at scale",
              points: [
                "O(n^2): 10^12 steps (all pairs), hours of CPU",
                "O(2^n): more steps than atoms in the universe",
                "Nested loop over the same list is the usual culprit",
                "Hidden: \"x in list\" inside a loop is O(n) per check",
              ],
            },
          },
        },
        l3: {
          text: p(
            "To find the complexity of code, count how many times the innermost work runs as a function of n. One loop over n: O(n). A loop inside a loop over the same data: O(n^2). Halving the problem each step: O(log n).",
            "Watch for **hidden loops**: `x in some_list` is O(n), `list.index`, `list.remove` and `list.insert(0, x)` are O(n), slicing copies. `x in some_set` and `d[key]` are O(1) on average.",
            "Space complexity counts extra memory the same way. Trading memory for time (a set, a dict, a cache) is the most common optimisation you will ever make."
          ),
          code: [
            {
              title: "Find duplicate document IDs: quadratic",
              lang: "python",
              variant: "bad",
              code: code(`
def has_duplicate(ids: list[str]) -> bool:
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if ids[i] == ids[j]:
                return True
    return False
`),
              note: "O(n^2) time, O(1) extra space. 100k ids means about 5 billion comparisons.",
            },
            {
              title: "Find duplicate document IDs: linear",
              lang: "python",
              variant: "good",
              code: code(`
import random
import time


def has_duplicate(ids: list[str]) -> bool:
    seen: set[str] = set()
    for doc_id in ids:
        if doc_id in seen:  # O(1) average
            return True
        seen.add(doc_id)
    return False


ids = [f"doc-{i}" for i in range(1_000_000)]
random.shuffle(ids)
start = time.perf_counter()
print(has_duplicate(ids), f"{time.perf_counter() - start:.3f}s")
`),
              note: "O(n) time, O(n) space. A million ids in well under a second.",
            },
          ],
        },
        l4: {
          text: p(
            "Formally, f(n) is O(g(n)) if there are constants c and n0 such that f(n) is at most c times g(n) for all n beyond n0. It is an **upper bound** on growth. Interviewers usually mean the tight bound, so say \"O(n log n)\" for merge sort, not \"O(n^2)\" even though that is technically also true.",
            "**Amortised** analysis explains why `list.append` is O(1) even though Python sometimes has to copy the whole array: CPython over-allocates (growing capacity by roughly 1.125x plus a constant), so the rare O(n) copy is spread across many cheap appends. The same idea makes hash table resizing O(1) amortised.",
            "Python lists are dynamic arrays of pointers: index access is O(1) because the address is `base + i * 8`. Inserting at the front is O(n) because every pointer shifts. That is why `collections.deque` exists for queues."
          ),
          code: [
            {
              title: "Watch list over-allocation happen",
              lang: "python",
              code: code(`
import sys

items: list[int] = []
last_size = sys.getsizeof(items)
for i in range(64):
    items.append(i)
    size = sys.getsizeof(items)
    if size != last_size:
        print(f"len={len(items):>3}  bytes={size}  (resized)")
        last_size = size
`),
              note: "Resizes happen at increasing intervals, which is exactly what makes append amortised O(1).",
            },
          ],
        },
        l5: {
          question: "You have 1 million document chunks, each with a content hash. Design a function that returns groups of duplicate chunks. What is its time and space complexity, and what would you do if the data did not fit in memory?",
          hint: "Group by key; then think about what to do when one machine is not enough.",
          answer: p(
            "In memory, I would do one pass building a dict from hash to list of chunk ids, then return the lists with more than one entry. That is O(n) time on average and O(n) extra space, versus O(n^2) for pairwise comparison.",
            "If the data did not fit in memory, I would push the grouping into the database with `GROUP BY content_hash HAVING count(*) > 1`, backed by an index on the hash, or do an external sort by hash (O(n log n)) and scan adjacent rows, which only needs to hold a small window in memory.",
            "I would also mention that a hash collision is possible in theory, so for exact deduplication you confirm equality within each group, which is cheap because groups are tiny."
          ),
        },
      },
      commonMistakes: [
        "Writing `if x in my_list` inside a loop and calling the result O(n). It is O(n^2).",
        "Keeping constants: saying O(2n) or O(n + 5). Drop them; say O(n).",
        "Forgetting space complexity. The set-based solution is faster but uses O(n) memory.",
        "Assuming the complexity of a library call without checking. `sorted` is O(n log n), `list.pop(0)` is O(n), `deque.popleft()` is O(1).",
      ],
      tryThis: "Time the quadratic `has_duplicate` on 1,000, 2,000 and 4,000 ids. Each doubling should roughly quadruple the time. That is O(n^2) you can feel.",
      miniTask: {
        title: "Measure growth, then predict it",
        kind: "code",
        minutes: 25,
        steps: [
          "Copy both `has_duplicate` versions into one file.",
          "Time each on unique-id lists of size 1,000, 2,000, 4,000 and 8,000 using `time.perf_counter`.",
          "Print a small table of n vs time for both versions.",
          "Before running 16,000, predict the quadratic version's time from your table, then check.",
          "Write the Big-O of each version (time and space) as a comment at the top of the file.",
        ],
        checklist: [
          "Both versions run and return the same answer",
          "My table shows roughly 4x growth per doubling for the quadratic version",
          "My 16,000 prediction was within about 2x of the real time",
          "I wrote time and space complexity for both",
        ],
        deliverable: "A Python file with both functions, a timing table and complexity comments.",
      },
      quiz: [
        {
          q: "What is the time complexity of this loop? `for x in a: if x in b: count += 1` where a and b are both lists of length n.",
          options: ["O(n)", "O(n log n)", "O(n^2)", "O(1)"],
          answer: 2,
          explain: "`x in b` scans the list, O(n), and it runs n times. Converting b to a set first makes it O(n).",
        },
        {
          q: "Why is list.append amortised O(1) in Python?",
          options: [
            "Python lists are linked lists",
            "The list over-allocates capacity, so the rare O(n) copy is spread over many appends",
            "Python compiles appends away",
            "Append is actually O(log n)",
          ],
          answer: 1,
          explain: "Growth by a constant factor means total copying work over n appends is O(n), so each append averages O(1).",
        },
        {
          q: "Binary search on a sorted array of 1 billion items needs at most about how many comparisons?",
          options: ["30", "1,000", "31,623", "1 billion"],
          answer: 0,
          explain: "log2(10^9) is about 30. Halving is incredibly powerful.",
        },
      ],
      explainPrompt: "Explain Big-O to a junior engineer using a real example from one of your apps, including one hidden O(n) operation, in five sentences.",
      implementPrompt: "From memory, write a function that returns the first repeated element in a list in O(n) time, and state its space complexity.",
      videos: [
        {
          title: "Big-O notation in 100 seconds / Big-O explained",
          channel: "NeetCode",
          url: "https://www.youtube.com/results?search_query=neetcode+big+o+notation",
          kind: "search",
          reason: "Watch this if you want the interview-oriented framing of time and space complexity.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "devtools-request-autopsy",
    title: "DevTools request autopsy",
    week: 1,
    duration: "20m",
    minutes: 20,
    difficulty: "easy",
    domain: "backend",
    skills: ["http", "api-design"],
    prerequisites: ["HTTP & the request lifecycle", "DNS, TCP & TLS: before the first byte"],
    topicSlugs: ["http-request-lifecycle", "dns-tcp-tls"],
    objective: "Dissect five real requests across 1goutham.space and one of your Vercel apps, and explain every field that matters.",
    expectedOutput: "A markdown table with five rows (URL, method, status, content-type, cache header, timing breakdown) plus one surprising finding.",
    steps: [
      {
        title: "Set up the Network tab",
        detail: "Open DevTools, Network tab, tick \"Disable cache\" and \"Preserve log\". Right-click the column header and enable Protocol, Remote Address and Priority columns.",
      },
      {
        title: "Capture 1goutham.space",
        detail: "Load https://1goutham.space. Pick three requests of different types: the HTML document, one JS or font asset, and one Fetch/XHR or image. For each, record URL, method, status, protocol (h2/h3), content-type, cache-control and x-vercel-cache.",
      },
      {
        title: "Capture a Vercel app with an API",
        detail: "Open one of your deployed apps (IdeaGuard, ZtudyLock or FabricNest) and trigger an action that calls an API route. Record that request plus one other. For the API call, also note the request body and the response JSON shape.",
      },
      {
        title: "Read the timing waterfall",
        detail: "Click the Timing tab for the slowest of the five. Record Queueing, DNS Lookup, Initial connection, SSL, Waiting for server response (TTFB) and Content Download. Decide which phase dominated.",
      },
      {
        title: "Replay one request with curl",
        detail: "Right-click the API request, Copy as cURL, paste into a terminal and add `-v`. Confirm you get the same status. Then remove the cookie header and observe what changes.",
      },
      {
        title: "Write it up",
        detail: "Fill in the five-row table and add a one-paragraph finding: something that surprised you (a missing cache header, a slow TTFB, an unexpected redirect, an API returning 200 for an error).",
      },
    ],
    hints: [
      "If the HTML document shows 304, you forgot to disable cache; that is a conditional request using etag.",
      "x-vercel-cache: HIT means the edge served it without touching your function.",
      "Waiting for server response is where your backend code lives; everything before it is network setup.",
    ],
    stretch: "Throttle to \"Slow 4G\" in DevTools and compare the waterfall. Which requests would benefit most from caching or preloading?",
    learned: [
      "Reading method, status, headers and protocol from real traffic",
      "Separating network setup time from server time",
      "How Vercel's edge cache shows up in headers",
      "Replaying and modifying requests with curl",
    ],
    starter: {
      title: "Autopsy table template",
      lang: "text",
      code: code(`
| # | URL | Method | Status | Protocol | Content-Type | Cache-Control | x-vercel-cache | TTFB | Total |
|---|-----|--------|--------|----------|--------------|---------------|----------------|------|-------|
| 1 |     |        |        |          |              |               |                |      |       |
| 2 |     |        |        |          |              |               |                |      |       |
| 3 |     |        |        |          |              |               |                |      |       |
| 4 |     |        |        |          |              |               |                |      |       |
| 5 |     |        |        |          |              |               |                |      |       |

Surprising finding:
`),
    },
  },
];
