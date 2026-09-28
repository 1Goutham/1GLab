import type { LabSeed, TopicSeed } from "../../types";

const p = (...parts: string[]) => parts.join("\n\n");

export const topics: TopicSeed[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "scaling-load-balancing",
    title: "Scaling: load balancers & horizontal scale",
    week: 21,
    domain: "systems",
    skills: ["scalability"],
    difficulty: "medium",
    minutes: 70,
    summary: "Stateless servers, L4 vs L7 balancers, and why round-robin quietly fails for long LLM streams.",
    tags: ["load-balancing", "horizontal-scaling", "consistent-hashing", "stateless"],
    lesson: {
      hook: p(
        "Cortex runs on one FastAPI container. A friend posts it on LinkedIn, 300 people try it in an hour, and every answer now takes 40 seconds because one Python process is juggling 300 open LLM streams.",
        "The obvious fix is \"run more copies\". But the moment you have two copies, new questions appear: who decides which copy gets the request? What happens to the user whose session lived in copy #1's memory? What happens when copy #2 dies mid-stream?",
        "Vercel answered all of this for you on your Next.js projects. This week you learn what it was doing, because your Python backend will not get it for free.",
      ),
      whyItMatters:
        "Every AI backend eventually needs more than one instance. Knowing how traffic is spread, and why LLM traffic breaks naive balancing, is the difference between scaling linearly and scaling your bugs.",
      levels: {
        l1: "Vertical scaling means buying a bigger machine; horizontal scaling means running many identical machines. A load balancer sits in front and hands each incoming request to one of them. It only works cleanly if any machine can answer any request, so the machines must not keep important state in their own memory.",
        l2: {
          text: p(
            "Think of the balancer as the host at a restaurant door. A bad host seats guests table by table in strict rotation, even if table 3 is still on a four-course meal. A good host looks at how busy each waiter is right now.",
            "LLM requests are four-course meals: one request can hold a connection for 30-60 seconds while tokens stream. Rotation (round-robin) spreads *requests* evenly, but what you need to spread is *in-flight work*.",
          ),
          analogy: "Round-robin is dealing cards evenly; least-connections is watching which player still has the most cards in hand.",
          diagram: {
            type: "flow",
            title: "Same traffic, two balancing strategies",
            lanes: [
              {
                label: "Round-robin",
                tone: "bad",
                steps: [
                  { label: "Mixed traffic", note: "2 ms health checks + 45 s streams" },
                  { label: "Rotate A, B, C" },
                  { label: "A holds 40 streams", note: "C holds 3", accent: true },
                  { label: "p99 spikes on A" },
                ],
              },
              {
                label: "Least-connections / P2C",
                tone: "good",
                steps: [
                  { label: "Mixed traffic" },
                  { label: "Pick least in-flight" },
                  { label: "A, B, C ~ 15 streams each", accent: true },
                  { label: "Flat p99" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**L4 vs L7.** An L4 balancer (AWS NLB, HAProxy in TCP mode) forwards TCP connections and never reads HTTP. It is fast and protocol-agnostic, but it balances *connections*, so one HTTP/2 connection carrying 100 requests lands on one server. An L7 balancer (nginx, Envoy, AWS ALB) parses HTTP, so it can route by path or header, retry, terminate TLS and balance per request.",
            "**Stateless first.** Before adding instances, move state out of process: sessions to Redis or signed cookies, uploads to S3/R2, background jobs to a queue. Sticky sessions (\"always send this user to server B\") are a crutch: they create hot servers and lose state when B restarts.",
            "**Algorithms that matter:** round-robin (fine for uniform, short requests), least-connections (right default for streaming), and *power of two choices*: pick two servers at random and send to the less loaded one. P2C gets almost all the benefit of least-connections without every balancer needing a perfect global view, which is why Envoy and many service meshes use it.",
            "**Health checks and draining.** Active checks hit `/healthz` every few seconds; passive checks eject a server after N consecutive 5xx. On deploy, a server should stop accepting new requests but finish in-flight streams (connection draining) before it exits, otherwise every deploy cuts off answers mid-sentence.",
          ),
          code: [
            {
              title: "nginx: least-connections in front of 3 FastAPI instances, SSE-safe",
              lang: "text",
              code: `upstream cortex_api {
    least_conn;
    server api1:8000 max_fails=3 fail_timeout=10s;
    server api2:8000 max_fails=3 fail_timeout=10s;
    server api3:8000 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://cortex_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Request-Id $request_id;
        # streaming: do not buffer tokens, allow long answers
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}`,
              note: "proxy_buffering off is the line people forget: without it nginx collects the whole SSE stream and your 'streaming' UI receives everything at once.",
            },
            {
              title: "Simulate: random vs power-of-two-choices with long-tailed request durations",
              lang: "python",
              code: `import heapq, random

SERVERS, REQUESTS, RATE = 10, 50_000, 30.0  # arrivals per second

def simulate(pick, seed=1):
    random.seed(seed)
    inflight = [0] * SERVERS
    ends = []                                # heap of (finish_time, server)
    t, peak = 0.0, 0
    for _ in range(REQUESTS):
        t += random.expovariate(RATE)
        while ends and ends[0][0] <= t:      # release finished requests
            _, s = heapq.heappop(ends)
            inflight[s] -= 1
        s = pick(inflight)
        inflight[s] += 1
        peak = max(peak, inflight[s])
        dur = 0.05 if random.random() < 0.7 else random.uniform(10, 40)  # quick vs LLM stream
        heapq.heappush(ends, (t + dur, s))
    return peak

def rand_pick(load):
    return random.randrange(len(load))

def p2c(load):
    a, b = random.sample(range(len(load)), 2)
    return a if load[a] <= load[b] else b

print("random  peak in-flight on one server:", simulate(rand_pick))
print("p2c     peak in-flight on one server:", simulate(p2c))`,
              note: "Average in-flight per server is about 22 here. Random assignment peaks near 2x that on its unluckiest server; P2C cuts the peak substantially with just one extra comparison.",
            },
          ],
        },
        l4: {
          text: p(
            "Sometimes you *want* a key to land on the same server: a per-user cache, a WebSocket room, a shard. The naive `hash(key) % N` remaps almost every key when N changes (going from 3 to 4 servers moves ~75% of keys), which empties every cache at once.",
            "**Consistent hashing** places servers on a ring of hash values. A key walks clockwise to the first server it meets. Adding a server only steals keys from its neighbours, so roughly `1/N` of keys move. Each server is placed many times (virtual nodes) so the arcs even out.",
            "The lookup is a binary search over a sorted array of ring positions, which is exactly this week's DSA pattern: `bisect` finds the first position greater than the key's hash in O(log V).",
          ),
          code: [
            {
              title: "Consistent hash ring with virtual nodes (binary search inside)",
              lang: "python",
              code: `import bisect, hashlib

def h(s: str) -> int:
    return int.from_bytes(hashlib.md5(s.encode()).digest()[:8], "big")

class HashRing:
    def __init__(self, nodes, vnodes=150):
        self.vnodes, self.points, self.owner = vnodes, [], {}
        for n in nodes:
            self.add(n)

    def add(self, node):
        for i in range(self.vnodes):
            p = h(f"{node}#{i}")
            bisect.insort(self.points, p)
            self.owner[p] = node

    def get(self, key):
        i = bisect.bisect(self.points, h(key)) % len(self.points)  # wrap around
        return self.owner[self.points[i]]

ring = HashRing(["api1", "api2", "api3"])
keys = [f"user:{i}" for i in range(20_000)]
before = {k: ring.get(k) for k in keys}
ring.add("api4")
moved = sum(before[k] != ring.get(k) for k in keys)
print(f"consistent hashing moved {moved / len(keys):.1%}")          # ~25%
naive = sum(h(k) % 3 != h(k) % 4 for k in keys)
print(f"hash % N moved {naive / len(keys):.1%}")                    # ~75%`,
            },
          ],
          diagram: {
            type: "stack",
            title: "Where each layer of a request is balanced",
            layers: [
              { label: "DNS / anycast", note: "picks a region or edge POP" },
              { label: "L4 balancer (NLB)", note: "spreads TCP connections, no HTTP awareness" },
              { label: "L7 proxy (nginx / Envoy / ALB)", note: "per-request routing, retries, TLS, least_conn", accent: true },
              { label: "App instances", note: "stateless FastAPI / Node, drained on deploy" },
              { label: "Shared state", note: "Postgres, Redis, object storage" },
            ],
          },
        },
        l5: {
          question:
            "Your FastAPI RAG service streams answers that take 20-60 seconds. You scaled from 2 to 6 instances behind a round-robin load balancer, but p99 latency got worse on some instances while others sit idle. Explain what is happening and what you would change.",
          hint: "What does round-robin balance, and what is actually scarce on each instance?",
          answer: p(
            "Round-robin equalises the number of requests each instance *receives*, not the amount of work each one is *holding*. With a mix of 5 ms requests and 60 s streams, some instances accumulate many long streams by chance and saturate their event loop or worker pool, while others have finished their short requests and sit idle.",
            "I would switch to least-connections or power-of-two-choices so routing uses in-flight count, and cap concurrency per instance so an overloaded one sheds load with a fast 503 instead of slowing everyone. I would also autoscale on concurrent requests or queue depth rather than CPU, because LLM-bound services are mostly waiting on I/O and CPU stays low while users suffer.",
            "Then I would check the boring causes: proxy buffering disabled for SSE, long enough read timeouts, connection draining on deploy so rollouts do not cut streams, and no per-instance state (in-memory sessions or caches) that forces stickiness.",
          ),
        },
      },
      commonMistakes: [
        "Autoscaling an LLM-bound service on CPU. CPU sits at 10% while every worker is blocked waiting on the provider; scale on in-flight requests or latency instead.",
        "Keeping sessions or rate-limit counters in process memory, then adding a second instance and seeing users randomly logged out or limits doubled.",
        "Forgetting `proxy_buffering off` (or the platform equivalent) so streaming responses arrive all at once.",
        "Deploying without connection draining, so every release kills in-flight streams mid-answer.",
      ],
      tryThis:
        "Run the P2C simulation, then change the 70/30 split to 95/5 and to 0/100. Notice the gap between random and P2C is largest when request durations are most uneven.",
      miniTask: {
        title: "Balance two FastAPI instances with nginx and watch the spread",
        kind: "build",
        minutes: 35,
        steps: [
          "Write a tiny FastAPI app with `GET /work?s=N` that does `await asyncio.sleep(N)` and returns its hostname (`socket.gethostname()`).",
          "Write a docker-compose file with two replicas of the app (`api1`, `api2`) and nginx using the upstream config from L3 but with `round_robin` (the default, just remove `least_conn`).",
          "Fire 10 requests of `s=20` and 40 requests of `s=0.1` concurrently (e.g. `xargs -P 50 curl`), and record which host served each slow request.",
          "Switch nginx to `least_conn`, reload, repeat, and compare how the 10 slow requests were spread.",
        ],
        checklist: [
          "Both instances answer through nginx on one port",
          "I recorded the host distribution of slow requests under round-robin",
          "I recorded the distribution under least_conn and can explain the difference",
          "I can say why the app has no in-memory state that would break with more replicas",
        ],
        deliverable: "A compose file plus a 3-line note comparing the slow-request spread under the two algorithms.",
      },
      quiz: [
        {
          q: "You scale a stateless API from 3 to 4 instances and use hash(user_id) % N to pick an instance for per-user caching. Roughly what fraction of users land on a different instance?",
          options: ["About 25%", "About 75%", "About 33%", "None, hashing is stable"],
          answer: 1,
          explain: "A key stays put only if h mod 3 equals h mod 4, which is true for about a quarter of keys. Consistent hashing reduces movement to about 1/N (25%).",
        },
        {
          q: "Why can an L4 load balancer leave one backend overloaded when clients use HTTP/2?",
          options: [
            "L4 balancers cannot handle TLS",
            "HTTP/2 multiplexes many requests on one TCP connection, and L4 balances connections, not requests",
            "HTTP/2 disables health checks",
            "L4 balancers always use sticky sessions",
          ],
          answer: 1,
          explain: "An L4 balancer never sees individual HTTP requests; a single long-lived HTTP/2 connection carrying many requests is pinned to one backend.",
        },
        {
          q: "What is the main advantage of power-of-two-choices over true least-connections?",
          options: [
            "It guarantees perfectly equal load",
            "It needs no health checks",
            "It gets most of the balancing benefit while tolerating stale or partial load information across many balancers",
            "It keeps users on the same server",
          ],
          answer: 2,
          explain: "With many balancers, a global least-loaded view is expensive and stale; everyone herds onto the same 'least loaded' server. Sampling two at random avoids herding and is still exponentially better than random.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, why round-robin works for a typical REST API but fails for an LLM streaming API, and what to use instead.",
      implementPrompt:
        "From memory, implement a consistent hash ring with virtual nodes using bisect, and show that adding a 4th node moves about a quarter of 10,000 keys.",
      videos: [
        {
          title: "Load balancing and consistent hashing (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+consistent+hashing",
          kind: "search",
          reason: "Watch this if the ring and virtual-node picture in L4 is not clicking yet.",
        },
        {
          title: "Layer 4 vs Layer 7 load balancing (Hussein Nasser)",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+layer+4+vs+layer+7+load+balancing",
          kind: "search",
          reason: "Watch this for a protocol-level look at what each balancer can and cannot see.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "databases-at-scale",
    title: "Databases at scale: replication, sharding & CAP",
    week: 21,
    domain: "systems",
    skills: ["distributed-data", "sql-postgres"],
    difficulty: "hard",
    minutes: 80,
    summary: "Read replicas and replication lag, partitioning vs sharding, and what CAP actually forces you to choose.",
    tags: ["replication", "sharding", "partitioning", "cap", "postgres"],
    lesson: {
      hook: p(
        "A user uploads a PDF to Cortex, the API writes the document row, and the UI immediately refreshes the library. The PDF is not there. Refresh again, and it appears.",
        "Nothing is broken. You added a read replica last week to take load off the primary, the library query went to the replica, and the replica was 300 ms behind. Welcome to distributed data: every copy of your data is a promise about *when* it will agree with the others.",
        "In MongoDB you may have seen this as `readPreference: secondary`. Same trade-off, same bug.",
      ),
      whyItMatters:
        "AI products are read-heavy (chat, search, retrieval) and bursty on writes (ingestion). Knowing when to add replicas, when to partition, and when you truly need to shard keeps one Postgres alive far longer than you think.",
      levels: {
        l1: "Replication means keeping several copies of the same data so more machines can answer reads and one can take over if another dies. Sharding means splitting the data so each machine holds only part of it, which you do when one machine can no longer hold or write everything. Both make the system bigger, and both mean the copies can briefly disagree.",
        l2: {
          text: p(
            "Replication is a teacher (the primary) writing on the board while students (replicas) copy it into their notebooks. Anyone can read from a notebook, but a notebook may be a line behind the board.",
            "Sharding is splitting the class into rooms by surname. Each room is smaller and faster, but a question that spans all surnames now needs someone to visit every room.",
            "CAP says that when the hallway between rooms is blocked (a network partition), each room must either refuse to answer (stay Consistent) or answer with what it has (stay Available).",
          ),
          analogy: "Replicas are photocopies: cheap to read, never newer than the original.",
          diagram: {
            type: "compare",
            title: "Replication vs sharding",
            left: {
              label: "Replication (copies)",
              points: [
                "Every node has all the data",
                "Scales reads, not writes",
                "Gives failover and high availability",
                "Cost: replication lag, stale reads",
              ],
            },
            right: {
              label: "Sharding (splits)",
              points: [
                "Each node has a slice, chosen by a shard key",
                "Scales writes and storage",
                "Cross-shard queries and transactions get hard",
                "Cost: hot keys, resharding, app complexity",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**The scaling ladder for Postgres**, in the order you should climb it: add the right indexes, then a connection pooler (PgBouncer, because Python workers open many connections), then a bigger machine, then read replicas, then table partitioning, and only then sharding (Citus, or application-level shards). Most products never need the last rung.",
            "**Replication in Postgres** is streaming WAL: the primary sends its write-ahead log to replicas, which replay it. By default it is *asynchronous*, so a commit returns before replicas have it. Synchronous replication (`synchronous_commit = on` with `synchronous_standby_names`) removes data loss on failover but adds a network round trip to every commit.",
            "**Read-your-writes.** The fix for the hook bug: after a user writes, route *that user's* reads to the primary for a few seconds (or until the replica's replay position passes the write's LSN). Everyone else can keep reading from replicas.",
            "**Partitioning vs sharding.** Declarative partitioning splits one table into child tables *on the same server*; queries that include the partition key only touch one child (partition pruning), and old partitions can be dropped instantly. Sharding puts the pieces on *different* servers.",
          ),
          code: [
            {
              title: "Measure replication lag (run on primary, then on a replica)",
              lang: "sql",
              code: `-- On the primary: one row per connected replica
SELECT client_addr,
       state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind,
       replay_lag
FROM pg_stat_replication;

-- On a replica: how old is the last transaction I have applied?
SELECT now() - pg_last_xact_replay_timestamp() AS replica_lag;`,
              note: "replica_lag grows on an idle primary too (no new transactions to replay), so alert on bytes_behind or on lag while the primary is busy.",
            },
            {
              title: "Read-your-writes routing (psycopg 3)",
              lang: "python",
              code: `import os, time
import psycopg

primary = psycopg.connect(os.environ["PRIMARY_URL"], autocommit=True)
replica = psycopg.connect(os.environ["REPLICA_URL"], autocommit=True)
STICKY_SECONDS = 5
last_write = {}                         # user_id -> monotonic time (use Redis in prod)

def write(user_id, sql, params=()):
    primary.execute(sql, params)
    last_write[user_id] = time.monotonic()

def read(user_id, sql, params=()):
    recent = time.monotonic() - last_write.get(user_id, 0) < STICKY_SECONDS
    conn = primary if recent else replica
    return conn.execute(sql, params).fetchall()

write(42, "INSERT INTO documents (user_id, title) VALUES (%s, %s)", (42, "notes.pdf"))
print(read(42, "SELECT title FROM documents WHERE user_id = %s", (42,)))   # primary
print(read(7, "SELECT title FROM documents WHERE user_id = %s", (7,)))     # replica`,
            },
          ],
        },
        l4: {
          text: p(
            "**How a replica stays close.** Every change is first written to the WAL, an append-only log addressed by LSN (log sequence number, a byte offset). The replica's `walreceiver` streams WAL bytes over a replication connection and the startup process replays them into the data files. Lag is literally `primary LSN - replica replay LSN` in bytes. Long-running queries on a replica can pause replay (they conflict with vacuum), which is why analytics on a hot-standby can make it fall minutes behind.",
            "**Choosing a shard key** is the one decision you cannot cheaply undo. For Cortex the natural key is `user_id` (or `workspace_id`): nearly every query is scoped to one user, so it hits one shard, and one user's documents, chunks and embeddings stay together. The failure mode is a hot key: one enterprise workspace with 1000x the data of anyone else.",
            "**CAP, precisely.** During a partition you must pick consistency or availability for operations that cross it. The more useful framing is PACELC: *if Partition, choose A or C; Else, choose Latency or Consistency*. Async Postgres replicas are an 'else latency' choice: fast commits, stale reads. DynamoDB and Cassandra let you choose per request with consistency levels.",
          ),
          code: [
            {
              title: "Hash-partition the chunks table by user_id (same server, pruned queries)",
              lang: "sql",
              code: `CREATE TABLE chunks (
    id         bigint GENERATED ALWAYS AS IDENTITY,
    user_id    bigint NOT NULL,
    doc_id     bigint NOT NULL,
    content    text   NOT NULL,
    PRIMARY KEY (user_id, id)          -- must include the partition key
) PARTITION BY HASH (user_id);

CREATE TABLE chunks_p0 PARTITION OF chunks FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE chunks_p1 PARTITION OF chunks FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE chunks_p2 PARTITION OF chunks FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE chunks_p3 PARTITION OF chunks FOR VALUES WITH (MODULUS 4, REMAINDER 3);

INSERT INTO chunks (user_id, doc_id, content)
SELECT g % 100, g, 'chunk ' || g FROM generate_series(1, 10000) g;

-- Only one partition appears in the plan:
EXPLAIN SELECT count(*) FROM chunks WHERE user_id = 42;`,
              note: "Unique constraints on a partitioned table must include the partition key. This is the same rule a sharded system imposes, just enforced earlier.",
            },
          ],
        },
        l5: {
          question:
            "Cortex grows to 50,000 users, each with about 2,000 document chunks plus embeddings. Chat and search are read-heavy; ingestion causes write bursts. Walk me through how you would scale the Postgres layer, and what you would not do yet.",
          hint: "Climb the ladder in order and put a number on each step.",
          answer: p(
            "First I would size it: 50k users x 2k chunks is 100M rows; with 1536-dim float32 embeddings that is about 6 KB each, so roughly 600 GB of vectors. That fits on one large Postgres node, but the vector index is the real memory pressure, so I would check whether halfvec or smaller-dimension embeddings cut it in half.",
            "Then in order: correct indexes and PgBouncer in transaction mode, move ingestion to a queue so write bursts are smoothed, add one or two read replicas for chat and search with read-your-writes after uploads, and hash-partition chunks by user_id so queries prune to one partition and deletes of a user are a partition-local operation.",
            "I would not shard yet. Sharding adds cross-shard query and migration costs, and one well-tuned primary handles thousands of writes per second. The trigger to shard would be a measured limit: write throughput or storage on the primary, or vector index memory, and user_id would be the shard key because nearly every query is already scoped by it.",
          ),
        },
      },
      commonMistakes: [
        "Sending reads to a replica right after a write and calling the resulting 'missing data' a bug in the ORM.",
        "Sharding before exhausting indexes, pooling, vertical scale and replicas. The complexity bill arrives on day one; the benefit arrives maybe never.",
        "Picking a shard key with low cardinality or skew (country, created_at month), creating one hot shard that does all the work.",
        "Treating CAP as a one-time database choice, when real systems pick per operation (e.g. strong for payments, eventual for view counts).",
      ],
      tryThis:
        "In the partitioning example, run EXPLAIN on `WHERE user_id = 42` and then on `WHERE doc_id = 42`. Count the partitions scanned in each plan.",
      miniTask: {
        title: "See partition pruning and measure it",
        kind: "code",
        minutes: 30,
        steps: [
          "Start Postgres locally (`docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16`) and connect with psql.",
          "Run the L4 script to create the hash-partitioned chunks table and insert 10,000 rows.",
          "Run `EXPLAIN ANALYZE SELECT count(*) FROM chunks WHERE user_id = 42;` and note how many partitions appear.",
          "Run the same with `WHERE doc_id = 42` and note the difference.",
          "Write down which Cortex queries would prune and which would scan every partition.",
        ],
        checklist: [
          "The partitioned table and 4 partitions exist",
          "I saw a plan touching exactly one partition for the user_id query",
          "I saw a plan touching all partitions for the doc_id query",
          "I listed at least two Cortex queries and whether they prune",
        ],
        deliverable: "Two EXPLAIN outputs and a short list of Cortex queries labelled 'prunes' or 'scans all'.",
      },
      quiz: [
        {
          q: "Postgres streaming replication is asynchronous by default. What does that mean when the primary crashes?",
          options: [
            "Nothing is lost because WAL is written first",
            "Transactions committed on the primary but not yet received by the replica can be lost on failover",
            "The replica refuses to be promoted",
            "Clients see duplicate rows",
          ],
          answer: 1,
          explain: "The commit returns once the primary's WAL is flushed locally. If it dies before shipping those bytes, a promoted replica never saw them.",
        },
        {
          q: "Which is the best shard key for a multi-tenant RAG product where almost every query is 'this workspace's documents'?",
          options: ["created_at", "document type", "workspace_id", "a random UUID per chunk"],
          answer: 2,
          explain: "workspace_id keeps each tenant's data together so queries hit one shard. created_at creates a hot latest shard; random UUIDs scatter one tenant's query across all shards.",
        },
        {
          q: "In PACELC terms, what does using async read replicas for search choose when there is no partition?",
          options: ["Consistency over latency", "Latency over consistency", "Availability over partition tolerance", "Nothing, PACELC only applies during partitions"],
          answer: 1,
          explain: "The 'Else' branch: with no partition you still trade fresh reads (consistency) for faster commits and cheaper reads (latency).",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, why a user might not see a document they just uploaded, and two ways to fix it.",
      implementPrompt:
        "From memory, write the SQL for a table hash-partitioned by user_id with 4 partitions, and the query that shows replication lag on the primary.",
      videos: [
        {
          title: "Database sharding and replication explained (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+database+sharding+replication",
          kind: "search",
          reason: "Watch this for a visual recap of replication topologies and shard-key trade-offs.",
        },
        {
          title: "Database partitioning vs sharding (Hussein Nasser)",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+database+partitioning+vs+sharding",
          kind: "search",
          reason: "Watch this if the difference between partitioning on one server and sharding across servers is still blurry.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "event-driven-architecture",
    title: "Message queues & event-driven design",
    week: 21,
    domain: "systems",
    skills: ["event-driven", "queues"],
    difficulty: "medium",
    minutes: 75,
    summary: "Queues vs logs, at-least-once delivery, idempotent consumers, dead letters and the outbox pattern.",
    tags: ["queues", "redis-streams", "kafka", "idempotency", "outbox"],
    lesson: {
      hook: p(
        "A user drops a 300-page PDF into Cortex. Parsing takes 20 seconds, chunking 2, embedding 800 chunks takes 40 more. If all of that happens inside the upload request, the browser times out, the user retries, and now you are embedding the same book twice.",
        "The fix is to say \"got it\" in 100 ms and do the work later. The upload handler writes a row and publishes an event; workers pick it up, and the UI shows progress.",
        "This is the same idea as a Vercel background function or a cron job, but with a durable buffer in the middle. That buffer changes everything about failure handling.",
      ),
      whyItMatters:
        "Ingestion, re-embedding, evals, webhooks and agent tasks are all slow and failure-prone. Queues let AI products absorb bursts, retry safely and scale workers independently of the API.",
      levels: {
        l1: "A queue is a to-do list shared between programs. The web server adds jobs to the list and returns immediately; worker programs take jobs off the list and do them. If a worker crashes, the job goes back on the list so another worker can try again.",
        l2: {
          text: p(
            "A work queue is a restaurant ticket rail: the waiter clips an order and walks away, any free cook grabs it, and the ticket is only thrown away when the dish is done.",
            "A log (Kafka, Redis Streams) is more like a newspaper archive: events are appended forever (or for a retention period) and each consumer group keeps its own bookmark. The indexer, the analytics pipeline and the notification service can all read the same `doc.uploaded` event at their own pace.",
          ),
          analogy: "A queue hands each job to one worker; a log lets many teams read the same history with their own bookmarks.",
          diagram: {
            type: "flow",
            title: "Cortex ingestion, before and after",
            lanes: [
              {
                label: "Synchronous",
                tone: "bad",
                steps: [
                  { label: "POST /upload" },
                  { label: "parse 20s" },
                  { label: "embed 40s" },
                  { label: "gateway timeout", note: "user retries, duplicate work", accent: true },
                ],
              },
              {
                label: "Event-driven",
                tone: "good",
                steps: [
                  { label: "POST /upload", note: "row + event, 202 in 100 ms" },
                  { label: "stream: ingest" },
                  { label: "workers: parse, chunk, embed", note: "retry, idempotent", accent: true },
                  { label: "status = ready", note: "UI polls or gets SSE" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Delivery guarantees.** At-most-once loses messages on crashes. Exactly-once end-to-end is mostly marketing: the broker can deliver once, but your side effect (a DB write, an email, an LLM call) can still run twice if the worker crashes between doing it and acknowledging. Real systems use **at-least-once delivery + idempotent consumers**.",
            "**Idempotency** means processing a message twice has the same effect as once. Use natural keys and upserts (`ON CONFLICT (doc_id, chunk_index) DO UPDATE`), or a processed-message table checked in the same transaction as the side effect.",
            "**Redis Streams** is a good first log: `XADD` appends, consumer groups track which entries each consumer has read, and unacknowledged entries sit in a Pending Entries List until `XACK`. `XAUTOCLAIM` lets a healthy worker steal entries from a crashed one. **Dead-letter**: after N delivery attempts, move the message aside instead of retrying forever.",
          ),
          code: [
            {
              title: "Non-idempotent consumer: a retry duplicates every chunk",
              lang: "python",
              variant: "bad",
              code: `def handle(conn, doc_id: int, chunks: list[str]):
    for i, text in enumerate(chunks):
        conn.execute(
            "INSERT INTO chunks (doc_id, chunk_index, content) VALUES (%s, %s, %s)",
            (doc_id, i, text),
        )
    # worker crashes here, before XACK -> message redelivered -> 2x chunks`,
            },
            {
              title: "Idempotent consumer on Redis Streams with retries and a dead-letter stream",
              lang: "python",
              variant: "good",
              code: `import json, redis

r = redis.Redis(decode_responses=True)
STREAM, GROUP, DLQ, MAX_TRIES = "ingest", "embedders", "ingest:dead", 5
try:
    r.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
except redis.ResponseError as e:
    if "BUSYGROUP" not in str(e):
        raise

def handle(conn, doc_id: int, chunks: list[str]):
    with conn.transaction():
        for i, text in enumerate(chunks):
            conn.execute(
                "INSERT INTO chunks (doc_id, chunk_index, content) VALUES (%s, %s, %s) "
                "ON CONFLICT (doc_id, chunk_index) DO UPDATE SET content = EXCLUDED.content",
                (doc_id, i, text),
            )

def run(conn, consumer: str):
    while True:
        # first reclaim messages another worker left pending for > 60 s
        _, claimed, _ = r.xautoclaim(STREAM, GROUP, consumer, min_idle_time=60_000, count=10)
        fresh = r.xreadgroup(GROUP, consumer, {STREAM: ">"}, count=10, block=5000)
        batch = claimed + [m for _, msgs in fresh for m in msgs]
        for msg_id, fields in batch:
            info = r.xpending_range(STREAM, GROUP, msg_id, msg_id, 1)
            if info and info[0]["times_delivered"] > MAX_TRIES:
                r.xadd(DLQ, fields)
                r.xack(STREAM, GROUP, msg_id)
                continue
            job = json.loads(fields["job"])
            handle(conn, job["doc_id"], job["chunks"])
            r.xack(STREAM, GROUP, msg_id)       # ack only after the side effect commits`,
              note: "Requires a UNIQUE (doc_id, chunk_index) constraint. In real Cortex the message carries only doc_id; the worker loads the file from storage.",
            },
          ],
        },
        l4: {
          text: p(
            "**Queue vs log internals.** RabbitMQ and SQS are queues: a message is delivered to one consumer and deleted on ack; ordering is best-effort. Kafka is a partitioned, replicated append-only log: each partition is ordered, consumers commit an *offset*, and messages stay until retention expires, so you can replay history to rebuild an index. Ordering is only per partition, so you choose a partition key (e.g. `doc_id`) to keep related events ordered.",
            "**The dual-write problem.** The upload handler must insert the document row *and* publish an event. If it commits the row and crashes before publishing, the document is stuck forever; if it publishes first and the insert fails, workers chase a document that does not exist.",
            "**Transactional outbox** fixes this: write the event into an `outbox` table in the *same* database transaction as the row, then a relay process reads unpublished outbox rows and publishes them. `FOR UPDATE SKIP LOCKED` lets several relays run without double-publishing the same row concurrently (duplicates can still happen on crash, which idempotent consumers already handle).",
            "**Backpressure.** A queue hides overload until it doesn't: monitor queue depth and consumer lag (age of the oldest pending message), and scale workers on that number, not on CPU.",
          ),
          code: [
            {
              title: "Transactional outbox: atomic write + relay",
              lang: "sql",
              code: `CREATE TABLE outbox (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    topic        text        NOT NULL,
    payload      jsonb       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);

-- In the upload handler: one transaction, two inserts
BEGIN;
INSERT INTO documents (id, user_id, status) VALUES (9001, 42, 'uploaded');
INSERT INTO outbox (topic, payload)
VALUES ('doc.uploaded', jsonb_build_object('doc_id', 9001, 'user_id', 42));
COMMIT;

-- In the relay loop: claim a batch, publish each row to the broker, then mark it
BEGIN;
SELECT id, topic, payload FROM outbox
WHERE published_at IS NULL
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;
-- (app publishes the rows here)
UPDATE outbox SET published_at = now() WHERE id = ANY('{1,2,3}'::bigint[]);
COMMIT;`,
            },
          ],
        },
        l5: {
          question:
            "Design the ingestion pipeline for Cortex so that a user can upload 50 PDFs at once, see progress per document, and never end up with duplicate or missing chunks, even if workers crash.",
          hint: "Cover the write path, the delivery guarantee, idempotency, failure handling and what the UI reads.",
          answer: p(
            "The upload endpoint stores each file in object storage, inserts a documents row with status 'queued' and an outbox event in the same transaction, and returns 202 with the document ids. A relay publishes outbox rows to a Redis Stream (or SQS/Kafka at larger scale) partitioned or keyed by doc_id.",
            "Workers in a consumer group process documents with at-least-once semantics: parse, chunk, embed in batches, and upsert chunks keyed by (doc_id, chunk_index) inside a transaction that also advances the document's status. They ack only after commit, so a crash means redelivery, and the upsert makes redelivery harmless. Messages that fail five times go to a dead-letter stream with the error, and the document is marked 'failed' so the UI can offer a retry.",
            "The UI reads status from the documents table via polling or SSE. I would alert on consumer lag rather than CPU, cap concurrent embedding calls per worker to respect provider rate limits, and scale workers on the age of the oldest pending message.",
          ),
        },
      },
      commonMistakes: [
        "Acknowledging the message before the side effect commits, which silently drops work on crashes.",
        "Assuming the broker's 'exactly-once' makes the consumer safe; the database write or LLM call can still happen twice.",
        "Publishing to the queue and writing the DB row as two separate steps (the dual-write problem) instead of using an outbox.",
        "Retrying poison messages forever with no dead-letter queue, blocking a partition or burning LLM credits.",
      ],
      tryThis:
        "Start the good consumer, kill it with Ctrl+C in the middle of a batch, then run `XPENDING ingest embedders` in redis-cli and watch a second consumer reclaim those entries after 60 seconds.",
      miniTask: {
        title: "Crash a worker and prove idempotency",
        kind: "build",
        minutes: 40,
        steps: [
          "Run Redis and Postgres in Docker; create `chunks` with a UNIQUE (doc_id, chunk_index) constraint.",
          "Paste the good consumer, add a producer that `XADD`s 20 jobs with fake chunk lists, and start one consumer.",
          "Add `if random.random() < 0.2: os._exit(1)` right before `xack`, and restart the worker until the stream is drained.",
          "Count rows per doc_id in Postgres and confirm each document has exactly its chunk count.",
          "Remove the ON CONFLICT clause, repeat, and observe the duplicates or unique violations.",
        ],
        checklist: [
          "Workers crashed at least three times mid-batch",
          "All 20 jobs were eventually acknowledged (XPENDING shows 0)",
          "Chunk counts are exact with the upsert version",
          "I saw the failure mode without the upsert and can explain it",
        ],
        deliverable: "A short script plus the SQL count output from both runs.",
      },
      quiz: [
        {
          q: "A worker writes chunks to Postgres, then crashes before XACK. What happens with Redis Streams consumer groups?",
          options: [
            "The message is lost",
            "The message stays in the Pending Entries List and can be reclaimed and redelivered",
            "Redis automatically rolls back the Postgres write",
            "The whole stream is blocked forever",
          ],
          answer: 1,
          explain: "Unacked entries remain pending for that consumer; XAUTOCLAIM or XCLAIM lets another consumer take them after an idle time. That is at-least-once delivery.",
        },
        {
          q: "What problem does the transactional outbox pattern solve?",
          options: [
            "Slow consumers",
            "Keeping a database write and an event publish consistent without a distributed transaction",
            "Message ordering across partitions",
            "Encrypting messages at rest",
          ],
          answer: 1,
          explain: "The event is written in the same local transaction as the business row; a relay publishes it later. Either both exist or neither does.",
        },
        {
          q: "In Kafka, how do you guarantee that all events for one document are processed in order?",
          options: [
            "Use a single consumer for the whole topic",
            "Set acks=all",
            "Use doc_id as the message key so all its events go to the same partition",
            "Kafka orders all messages globally by default",
          ],
          answer: 2,
          explain: "Kafka guarantees ordering within a partition. Keying by doc_id routes a document's events to one partition, while other documents still process in parallel.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, why 'at-least-once plus idempotent consumers' beats chasing exactly-once delivery.",
      implementPrompt:
        "From memory, write a Redis Streams consumer that uses XREADGROUP, acks after an upsert, and moves messages to a dead-letter stream after 5 deliveries.",
      videos: [
        {
          title: "Kafka vs RabbitMQ and message queues explained (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+kafka+vs+rabbitmq+message+queue",
          kind: "search",
          reason: "Watch this if the difference between a queue and a log is still fuzzy.",
        },
        {
          title: "Transactional outbox pattern",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+outbox+pattern",
          kind: "search",
          reason: "Watch this for a second explanation of the dual-write problem and why the outbox fixes it.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "token-bucket-rate-limiter",
    title: "Redis-backed token bucket rate limiter",
    week: 21,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "systems",
    skills: ["scalability", "caching", "testing"],
    prerequisites: ["Scaling: load balancers & horizontal scale", "Basic Redis commands", "pytest"],
    topicSlugs: ["scaling-load-balancing", "event-driven-architecture"],
    objective:
      "Build a distributed token bucket rate limiter backed by Redis and an atomic Lua script, then prove with tests that it allows bursts up to capacity, refills at the right rate, and stays correct when many instances hit it concurrently.",
    expectedOutput:
      "A `ratelimit.py` module with `allow(key, cost=1) -> (bool, remaining)`, a FastAPI dependency that returns 429 with a `Retry-After` header, and a passing pytest suite covering burst, refill, cost > 1, and a 50-thread concurrency test.",
    steps: [
      {
        title: "Run Redis and set up the project",
        detail:
          "`docker run -d -p 6379:6379 redis:7`, then create a venv with `redis`, `fastapi`, `uvicorn`, `pytest`. Keep the limiter in `ratelimit.py` and tests in `test_ratelimit.py`. Use Redis database 15 in tests and `flushdb()` in a fixture so tests are isolated.",
      },
      {
        title: "Write the Lua script",
        detail:
          "Store two fields per key in a hash: `tokens` and `ts` (ms). On each call: read both, compute `elapsed = now - ts`, refill `tokens = min(capacity, tokens + elapsed * rate)`, and if `tokens >= cost` subtract and allow. Write both fields back and set a PEXPIRE of roughly the time to refill fully so idle keys disappear. Doing this in Lua makes read-modify-write atomic: Redis runs a script without interleaving other commands.",
      },
      {
        title: "Wrap it in Python with an injectable clock",
        detail:
          "Register the script once with `r.register_script(LUA)`. `allow(key, cost=1, now_ms=None)` passes `now_ms` (defaulting to `time.time() * 1000`). The injectable clock is what makes refill tests deterministic: no `sleep()` in tests.",
      },
      {
        title: "Test burst and refill",
        detail:
          "With capacity 10 and rate 5/s: 10 calls at t=0 are allowed, the 11th is denied. At t=+200 ms exactly one more is allowed (5/s x 0.2 s = 1 token). At t=+10 s the bucket is full again but never above 10. Add a test that cost=3 consumes 3 tokens and is denied when only 2 remain.",
      },
      {
        title: "Test concurrency",
        detail:
          "Spin up 50 threads with a `ThreadPoolExecutor`, each calling `allow('user:1')` 4 times with a fixed `now_ms`. Exactly 10 of the 200 calls must be allowed. Then replace the Lua call with a naive Python GET-then-SET version and watch the test fail, which is the race you are protecting against.",
      },
      {
        title: "Expose it as a FastAPI dependency",
        detail:
          "Write `def rate_limited(request: Request)` that keys on the API key header (fall back to client IP), calls `allow`, and raises `HTTPException(429, headers={'Retry-After': str(seconds)})` where seconds is `ceil((cost - remaining) / rate)`. Add `X-RateLimit-Remaining` to successful responses.",
      },
    ],
    hints: [
      "Lua numbers returned to Redis are truncated to integers. Return `tostring(tokens)` if you want fractional remaining tokens in Python.",
      "Clock skew between app servers can make buckets refill unevenly. The production fix is `redis.call('TIME')` inside the script (Redis 7 replicates script effects, so this is allowed); keep the injectable clock for tests.",
      "If a test is flaky, you are probably sleeping. Pass `now_ms` explicitly.",
    ],
    stretch:
      "Add a second limit on LLM tokens per minute (cost = estimated prompt tokens) on the same key, and make the request pass only if both buckets allow it, atomically, in one script.",
    learned: [
      "Why read-modify-write on shared counters needs atomicity, and how Lua scripts give it in Redis",
      "The token bucket model: capacity controls burst, refill rate controls sustained throughput",
      "How to make time-dependent code testable with an injectable clock",
      "How a limiter surfaces to clients: 429, Retry-After and remaining-quota headers",
    ],
    starter: {
      title: "ratelimit.py starter (Lua script + Python wrapper)",
      lang: "python",
      code: `import time
import redis

LUA = """
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])   -- tokens per second
local now_ms   = tonumber(ARGV[3])
local cost     = tonumber(ARGV[4])

local data   = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts     = tonumber(data[2]) or now_ms

local elapsed = math.max(0, now_ms - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now_ms)
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)
return {allowed, tostring(tokens)}
"""

class TokenBucket:
    def __init__(self, r: redis.Redis, capacity: int, rate: float):
        self.r, self.capacity, self.rate = r, capacity, rate
        self.script = r.register_script(LUA)

    def allow(self, key: str, cost: int = 1, now_ms: int | None = None):
        now_ms = int(time.time() * 1000) if now_ms is None else now_ms
        allowed, remaining = self.script(
            keys=["rl:" + key], args=[self.capacity, self.rate, now_ms, cost]
        )
        return bool(allowed), float(remaining)`,
    },
  },
];
