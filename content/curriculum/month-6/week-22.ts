import type { LabSeed, TopicSeed } from "../../types";

const p = (...parts: string[]) => parts.join("\n\n");

export const topics: TopicSeed[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "system-design-method",
    title: "The system design method",
    week: 22,
    domain: "systems",
    skills: ["sd-practice"],
    difficulty: "medium",
    minutes: 75,
    summary: "A repeatable seven-step method, worked end to end on a distributed rate limiter.",
    tags: ["system-design", "estimation", "rate-limiter", "interviews"],
    lesson: {
      hook: p(
        "\"Design a rate limiter.\" Most people hear that and start drawing Redis. Twenty minutes later the interviewer asks \"limit by what, per user or per IP? What happens when Redis is down?\" and the whole design wobbles.",
        "Strong system designers are not people who know more boxes. They are people who ask the right questions in the right order, so every box on the whiteboard has a reason to exist.",
        "You already do this informally when you scope a feature for IdeaGuard. This topic makes it a method you can run under pressure.",
      ),
      whyItMatters:
        "A repeatable method is what turns system design from improvisation into engineering, in interviews and in the design docs you will write for Cortex.",
      levels: {
        l1: "Before you build anything big, you agree on what it must do, estimate how much traffic and data it must handle, decide how clients talk to it and how data is stored, sketch the main parts, then zoom into the hardest part. Finally you say what you gave up to get what you wanted. Doing it in that order stops you solving the wrong problem well.",
        l2: {
          text: p(
            "Think of an architect designing a house. They ask how many people live there and how they live (requirements), check the plot size and budget (estimates), decide where the doors go (API), plan the rooms (data model), draw the floor plan (high-level), engineer the tricky staircase (deep dive), and explain why the kitchen is small (trade-offs).",
            "Skipping straight to the staircase is how you get a beautiful staircase in the wrong house.",
          ),
          analogy: "Requirements and estimates are the plot survey; you do not pour foundations before it.",
          diagram: {
            type: "flow",
            title: "The seven steps (budget for a 45-minute interview)",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "1. Requirements", note: "functional + non-functional, 5 min" },
                  { label: "2. Estimates", note: "QPS, storage, bandwidth, 3 min" },
                  { label: "3. API", note: "endpoints + payloads, 3 min" },
                  { label: "4. Data model", note: "entities, keys, access patterns, 4 min" },
                  { label: "5. High-level", note: "boxes + arrows, 10 min", accent: true },
                  { label: "6. Deep dives", note: "1-2 hard parts, 15 min", accent: true },
                  { label: "7. Trade-offs", note: "what you gave up, failure modes, 5 min" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Worked example: a rate limiter for the Cortex public API.**",
            "**1. Requirements.** Functional: limit requests per API key (e.g. 100/min with bursts of 20), return 429 with `Retry-After`, configurable per plan. Non-functional: adds under 5 ms p99, works across many API instances, fails *open* if the limiter store is down (availability over strictness for this product), limits are approximately correct (a few percent over is fine).",
            "**2. Estimates.** 1M API keys, 10k peak requests/s. One limiter check per request = 10k Redis ops/s: a single Redis node handles 100k+ simple ops/s, so one primary plus a replica is enough. State per key is two numbers, about 100 bytes with Redis overhead: 1M keys = ~100 MB.",
            "**3. API.** Internal: `allow(key, cost) -> {allowed, remaining, retry_after_ms}`. External: standard headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.",
            "**4. Data model.** Redis hash `rl:{key}` with `tokens` and `ts`, TTL so idle keys expire. Plan limits live in Postgres and are cached in-process for 60 s.",
            "**5. High-level.** Middleware in every API instance calls Redis with an atomic Lua script; on timeout it allows the request and increments a `ratelimit_fail_open` metric.",
            "**6. Deep dive: the algorithm.** Fixed window (count per minute) lets a client send 2x the limit across a window boundary. Sliding log (store every timestamp) is exact but costs memory per request. Sliding window counter approximates well. **Token bucket** gives an explicit burst size and a sustained rate with O(1) state, which is why most API providers, including LLM providers with their RPM/TPM limits, describe their limits this way.",
            "**7. Trade-offs.** Fail-open means a Redis outage removes limits; acceptable here, not acceptable for a payments API. Centralised Redis adds a network hop; at much larger scale you would keep local buckets and sync periodically, trading accuracy for latency.",
          ),
          code: [
            {
              title: "Token bucket in 20 lines (single process) to internalise the algorithm",
              lang: "python",
              code: `import time

class TokenBucket:
    def __init__(self, capacity: float, rate: float, clock=time.monotonic):
        self.capacity, self.rate, self.clock = capacity, rate, clock
        self.tokens, self.ts = capacity, clock()

    def allow(self, cost: float = 1.0) -> tuple[bool, float]:
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.ts) * self.rate)
        self.ts = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True, 0.0
        return False, (cost - self.tokens) / self.rate   # seconds until allowed

t = [0.0]
bucket = TokenBucket(capacity=5, rate=1, clock=lambda: t[0])
print([bucket.allow()[0] for _ in range(6)])  # 5 x True, then False
t[0] += 2.5
print(bucket.allow(), bucket.allow(), bucket.allow())  # True, True, then denied with ~0.5 s wait`,
            },
          ],
        },
        l4: {
          text: p(
            "**Estimation is a skill with a small toolkit.** Memorise a few numbers and the rest is multiplication:",
            "- 1 day is about 86,400 s, so ~100k s. 1M requests/day is ~12 req/s average; peak is typically 2-5x average.\n- Memory read ~100 ns, SSD random read ~100 us, same-datacentre round trip ~0.5 ms, cross-continent round trip ~150 ms.\n- One Postgres node: thousands of simple writes/s, tens of thousands of indexed reads/s. One Redis node: ~100k ops/s. One LLM call: 0.5-30 s and cents, not microseconds and fractions of a cent.",
            "**For AI systems add three estimates** that classic system design ignores: tokens per request (drives cost and latency), provider rate limits (RPM and TPM caps are often your real throughput ceiling), and GPU or provider concurrency.",
            "The point of estimates is to make decisions. \"10k QPS\" decides that you need a shared fast store; \"100 MB of state\" decides that it fits in one Redis; \"2 KB x 100M rows\" decides that you need to think about storage tiers.",
          ),
          code: [
            {
              title: "Back-of-envelope for Cortex, written as a checkable script",
              lang: "python",
              code: `DAU = 20_000
QUESTIONS_PER_USER_PER_DAY = 5
PEAK_FACTOR = 4
TOKENS_IN, TOKENS_OUT = 6_000, 500          # retrieved context + answer
PRICE_IN, PRICE_OUT = 0.15e-6, 0.60e-6      # $/token, a small model (check current pricing)
PROVIDER_TPM_LIMIT = 2_000_000

q_per_day = DAU * QUESTIONS_PER_USER_PER_DAY
avg_qps = q_per_day / 86_400
peak_qps = avg_qps * PEAK_FACTOR
peak_tpm = peak_qps * 60 * (TOKENS_IN + TOKENS_OUT)
cost_per_day = q_per_day * (TOKENS_IN * PRICE_IN + TOKENS_OUT * PRICE_OUT)

print(f"questions/day   {q_per_day:,}")
print(f"avg / peak QPS  {avg_qps:.1f} / {peak_qps:.1f}")
print(f"peak TPM        {peak_tpm:,.0f}  (limit {PROVIDER_TPM_LIMIT:,})")
print(f"LLM cost/day    USD {cost_per_day:,.2f}")
if peak_tpm > PROVIDER_TPM_LIMIT:
    print("-> provider TPM is the bottleneck: need a second provider, fewer tokens, or a queue")`,
              note: "At these numbers peak TPM is about 1.8M, uncomfortably close to a 2M limit. That single line is a design decision: trim retrieved context or add a fallback provider.",
            },
          ],
        },
        l5: {
          question: "Design a rate limiter for a public API that runs on 20 stateless instances.",
          hint: "Say requirements and numbers before you say Redis.",
          answer: p(
            "I would first clarify what we limit by (API key, user, IP), the limits (say 100 requests/min with bursts of 20, per plan), whether being slightly over is acceptable, and what should happen if the limiter itself fails. For a typical public API I would fail open and accept approximate limits.",
            "At 10k requests/s peak and 1M keys, the state is ~100 MB and 10k ops/s, so one Redis primary with a replica is enough. Each instance runs middleware that executes a Lua token bucket script atomically (tokens and last-refill timestamp in a hash with a TTL), returns 429 with Retry-After when denied, and sets remaining-quota headers.",
            "I chose token bucket because it expresses both burst and sustained rate with O(1) state; fixed windows allow 2x bursts at boundaries and sliding logs cost memory per request. Trade-offs: Redis adds a sub-millisecond hop and is a dependency, so I would use short timeouts and fail open with an alert; at far larger scale I would shard keys across Redis nodes by hashing the API key, or keep local buckets that sync periodically at the cost of accuracy.",
          ),
        },
      },
      commonMistakes: [
        "Jumping to boxes before agreeing on requirements, then redesigning halfway through when the interviewer reveals a constraint.",
        "Doing estimates and then never using them. Every number should justify or kill a design choice.",
        "Going wide instead of deep: ten shallow boxes impress less than one component explained down to data structures and failure modes.",
        "Never stating trade-offs or failure behaviour (what happens when Redis is down?), which is the most senior signal in the whole interview.",
      ],
      tryThis:
        "Run the estimate script with DAU = 100,000 and see which assumption breaks first. Then change TOKENS_IN to 3,000 (better reranking) and see how much headroom you win back.",
      miniTask: {
        title: "Run the method on a URL shortener in 30 minutes",
        kind: "explain",
        minutes: 35,
        steps: [
          "Set a 30-minute timer and open a blank doc or Excalidraw.",
          "Write 4 functional and 3 non-functional requirements for a URL shortener (e.g. 100M new links/month, 100:1 read:write).",
          "Do the estimates: writes/s, reads/s, storage for 5 years at ~500 bytes per link.",
          "Write the API (2 endpoints) and the data model (one table, its key, one index).",
          "Draw the high-level diagram, then deep-dive on key generation (hash vs counter vs pre-generated keys).",
          "Finish with three trade-offs you made.",
        ],
        checklist: [
          "All seven steps appear in order",
          "Estimates include writes/s, reads/s and total storage with arithmetic shown",
          "At least one design decision explicitly references an estimate",
          "Three trade-offs are written down",
        ],
        deliverable: "A one-page design (doc or image) following the seven steps.",
      },
      quiz: [
        {
          q: "What is the main weakness of a fixed-window rate limiter (count requests per calendar minute)?",
          options: [
            "It needs a database per user",
            "A client can send up to 2x the limit around a window boundary",
            "It cannot return 429",
            "It is O(n) per request",
          ],
          answer: 1,
          explain: "100 requests at 12:00:59 and 100 more at 12:01:00 are both allowed, so 200 pass within about one second.",
        },
        {
          q: "1M requests per day is roughly how many requests per second on average?",
          options: ["~1", "~12", "~120", "~1,200"],
          answer: 1,
          explain: "1,000,000 / 86,400 is about 11.6. Rule of thumb: 1M/day is about 12/s average, so plan peaks at 25-60/s.",
        },
        {
          q: "Why do estimates for an AI system usually include tokens per minute?",
          options: [
            "Tokens determine CPU usage on your servers",
            "Provider TPM limits and per-token pricing are often the real throughput and cost ceilings",
            "Tokens are required to size the load balancer",
            "It is a convention with no design impact",
          ],
          answer: 1,
          explain: "Your own servers are rarely the bottleneck for an LLM app; the provider's rate limits and the per-token bill are.",
        },
      ],
      explainPrompt:
        "Explain the seven-step system design method to a junior engineer in 5 sentences, including why estimates come before the diagram.",
      implementPrompt:
        "From memory, implement a token bucket class with an injectable clock and write two asserts: one for burst, one for refill.",
      videos: [
        {
          title: "System design interview framework (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+system+design+interview+step+by+step+framework",
          kind: "search",
          reason: "Watch this to see the same step-by-step structure applied to a different problem.",
        },
        {
          title: "Design a rate limiter (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+rate+limiter+system+design",
          kind: "search",
          reason: "Watch this for visual comparisons of token bucket, leaky bucket and sliding window.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "design-chat-system",
    title: "Design: a real-time chat system",
    week: 22,
    domain: "systems",
    skills: ["sd-practice", "scalability"],
    difficulty: "hard",
    minutes: 85,
    summary: "WebSocket gateways, cross-server fan-out, presence, per-channel ordering and message storage at scale.",
    tags: ["websockets", "fan-out", "presence", "snowflake-ids", "cassandra"],
    lesson: {
      hook: p(
        "Two users in the same Cortex workspace are chatting about a document. Alice is connected to server A, Bob to server B. Alice hits send. How does a message that arrived on A reach a socket that lives on B, in the right order, exactly once on Bob's screen, and still be there when Bob opens his laptop tomorrow?",
        "Chat looks like a CRUD app with a text box. It is actually a distributed system with long-lived connections, fan-out, ordering and presence, which is why it is one of the most common system design questions.",
        "It is also the backbone of every AI assistant UI: a conversation, streamed messages, multiple devices, history.",
      ),
      whyItMatters:
        "The patterns here (stateful connection tier, pub/sub fan-out, time-ordered IDs, partitioned message storage) reappear in every real-time AI product: collaborative agents, live notifications, multi-device chat history.",
      levels: {
        l1: "Each user keeps a live connection open to one of many chat servers. When someone sends a message, it is saved, given an order number, and broadcast to every server that has a member of that conversation connected, which then pushes it down the open connections. Users who are offline get it when they reconnect by asking for everything after the last message they saw.",
        l2: {
          text: p(
            "Picture a hotel with many front desks (connection servers). Guests (sockets) are checked in at one desk only. A message for a room (channel) is announced over the hotel PA (pub/sub): every desk hears it, and only the desks with guests from that room pass it on.",
            "The hotel log book (message store) records every announcement with a number, so a guest returning from a trip can ask \"what did I miss after #1042?\"",
          ),
          analogy: "Connection servers are switchboards: they hold the lines but don't remember the conversations; the store does.",
          diagram: {
            type: "flow",
            title: "Send path for one message",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "Alice's socket", note: "on gateway A" },
                  { label: "Chat service", note: "auth, validate, assign id" },
                  { label: "Message store", note: "append (channel, id)", accent: true },
                  { label: "Pub/sub: channel topic", note: "Redis / NATS / Kafka" },
                  { label: "Gateway B", note: "has Bob's socket" },
                  { label: "Bob's screen", note: "dedupe by id, order by id" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Requirements.** 1:1 and group chat (up to 500 members), online presence, typing indicators, history on any device, delivery under 200 ms p99 within a region. Estimates: 20M DAU, 40 messages/user/day = 800M messages/day, ~9k/s average and ~30k/s peak. At ~300 bytes per message that is ~240 GB/day, ~90 TB/year before replication, so storage is a write-heavy, append-mostly, time-ordered problem.",
            "**Connection tier.** WebSocket gateways are *stateful* (they hold sockets), so keep them thin: auth on connect, then relay. A tuned box holds tens of thousands to a few hundred thousand idle sockets; with 5M concurrent users and ~50k per box you need ~100 gateways. A registry (Redis) maps `user -> gateway` for direct delivery, or gateways subscribe to channel topics for group fan-out.",
            "**Ordering.** Clocks across servers disagree, so do not order by server timestamp. Give every message a per-channel monotonic sequence (Redis `INCR seq:{channel}`) or a Snowflake-style time-ordered ID, and let clients sort and deduplicate by it. Clients also send a `client_msg_id` so a retried send is deduplicated server-side.",
            "**Presence** is a heartbeat with a TTL: every 30 s the client pings, the gateway sets `presence:{user}` with a 60 s expiry. Offline is simply \"key expired\". Only fan out presence changes to friends or channel members who are online, or it becomes the loudest traffic in the system.",
          ),
          code: [
            {
              title: "Minimal multi-server chat gateway: ws + Redis pub/sub + per-room sequence",
              lang: "typescript",
              code: `import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";

const pub = new Redis();
const sub = new Redis();                            // a subscribed connection cannot run other commands
const rooms = new Map<string, Set<WebSocket>>();    // sockets on THIS gateway only
const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 8080) });

sub.on("message", (channel: string, raw: string) => {
  const room = channel.slice("room:".length);
  for (const ws of rooms.get(room) ?? []) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
});

wss.on("connection", (ws, req) => {
  const room = new URL(req.url ?? "/", "http://localhost").searchParams.get("room") ?? "lobby";
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
    void sub.subscribe("room:" + room);
  }
  rooms.get(room)!.add(ws);

  ws.on("message", async (data) => {
    const { clientMsgId, text } = JSON.parse(data.toString());
    const seq = await pub.incr("seq:" + room);      // per-room order, independent of clocks
    const msg = JSON.stringify({ room, seq, clientMsgId, text, at: Date.now() });
    await pub.xadd("history:" + room, "*", "m", msg);
    await pub.publish("room:" + room, msg);
  });

  ws.on("close", () => {
    const set = rooms.get(room);
    set?.delete(ws);
    if (set && set.size === 0) {
      rooms.delete(room);
      void sub.unsubscribe("room:" + room);
    }
  });
});`,
              note: "Run two copies on ports 8080 and 8081 and connect with wscat to each: messages cross servers. Two senders on different gateways can publish seq 6 before seq 5, which is why clients buffer and sort by seq.",
            },
          ],
        },
        l4: {
          text: p(
            "**Message storage.** Access pattern: \"latest N messages in channel X, then page backwards\". That is a partition key plus a clustering order, the sweet spot of wide-column stores (Cassandra, ScyllaDB). Discord famously stored messages this way, partitioned by channel and a time bucket so a busy channel's partition does not grow forever. Postgres works fine far longer than people think, with an index on `(channel_id, id DESC)` and partitioning by time.",
            "**Snowflake IDs** make ordering and pagination cheap: 64 bits = 41 bits of milliseconds since a custom epoch + 10 bits of machine ID + 12 bits of per-millisecond sequence. They sort by time, are unique without coordination, and double as a cursor (`WHERE id < :cursor`).",
            "**Fan-out choices.** Fan-out on write (push to every member's inbox) makes reads trivial but a 10k-member channel means 10k writes per message. Fan-out on read (store once per channel, members read the channel) is the default for groups; push notifications for offline members are a separate async job off a queue.",
            "**Delivery guarantee.** At-least-once over the socket, with client-side dedupe by message ID and a reconnect protocol: on reconnect the client sends its last seen ID per channel and the server replays the gap from storage.",
          ),
          code: [
            {
              title: "Snowflake-style ID generator",
              lang: "python",
              code: `import threading, time

EPOCH_MS = 1_704_067_200_000          # 2024-01-01, custom epoch

class Snowflake:
    def __init__(self, machine_id: int):
        assert 0 <= machine_id < 1024
        self.machine_id, self.seq, self.last_ms = machine_id, 0, -1
        self.lock = threading.Lock()

    def next_id(self) -> int:
        with self.lock:
            now = int(time.time() * 1000)
            if now < self.last_ms:
                raise RuntimeError("clock moved backwards")
            if now == self.last_ms:
                self.seq = (self.seq + 1) & 0xFFF          # 12 bits
                if self.seq == 0:                          # 4096 ids this ms: wait
                    while now <= self.last_ms:
                        now = int(time.time() * 1000)
            else:
                self.seq = 0
            self.last_ms = now
            return ((now - EPOCH_MS) << 22) | (self.machine_id << 12) | self.seq

gen = Snowflake(machine_id=7)
ids = [gen.next_id() for _ in range(5)]
print(ids, ids == sorted(ids))
print("ms since epoch:", ids[0] >> 22, "machine:", (ids[0] >> 12) & 0x3FF)`,
            },
            {
              title: "Wide-column message table (CQL), partitioned by channel and 10-day bucket",
              lang: "sql",
              code: `CREATE TABLE messages (
    channel_id  bigint,
    bucket      int,          -- (snowflake_ms / (10 * 86400000)): bounds partition size
    message_id  bigint,       -- snowflake, time-ordered
    author_id   bigint,
    content     text,
    PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- latest 50 in a channel, then page with message_id < cursor
SELECT * FROM messages WHERE channel_id = 42 AND bucket = 71 LIMIT 50;`,
            },
          ],
        },
        l5: {
          question:
            "Messages in a group chat sometimes appear out of order, and occasionally twice, for users on flaky mobile networks. Where can this come from in a WebSocket + pub/sub design, and how do you fix it end to end?",
          hint: "Think about the send path, cross-server publish, and reconnects separately.",
          answer: p(
            "Out-of-order comes from ordering by arrival: two senders on different gateways assign IDs and publish concurrently, and pub/sub makes no cross-publisher ordering promise; client clocks are also unreliable. Duplicates come from retries: the client resends after a timeout even though the server already stored the message, or a reconnect replays messages the client already rendered.",
            "The fix is to make the server the single source of order and identity: assign a per-channel sequence or Snowflake ID when the message is persisted, and have clients sort by that ID and keep a small reorder buffer. For duplicates, clients attach a client_msg_id and the server upserts on (channel, client_msg_id) so a resend returns the original message; clients also dedupe rendered messages by server ID.",
            "On reconnect the client sends the last ID it saw per channel, and the server replays everything after it from storage before resuming live delivery. That turns at-least-once delivery plus idempotent rendering into effectively-once from the user's point of view.",
          ),
        },
      },
      commonMistakes: [
        "Ordering messages by server or client timestamp; clocks drift and ties are common at scale.",
        "Treating WebSocket gateways as stateless and load balancing each frame; the socket lives on one box and deploys must drain connections.",
        "Broadcasting every presence change to everyone, making presence the dominant traffic in the system.",
        "Forgetting the reconnect and backfill protocol, so any network blip loses messages.",
      ],
      tryThis:
        "Run two copies of the gateway, open wscat against each, and send from both as fast as you can type. Watch the seq numbers arrive and spot any that come out of order.",
      miniTask: {
        title: "Two gateways, one room",
        kind: "build",
        minutes: 40,
        steps: [
          "Create a Node project with `ws`, `ioredis`, `tsx` and paste the L3 gateway into `gateway.ts`.",
          "Run Redis, then `PORT=8080 npx tsx gateway.ts` and `PORT=8081 npx tsx gateway.ts`.",
          "Connect `npx wscat -c 'ws://localhost:8080/?room=doc-1'` and another to 8081 with the same room.",
          "Send JSON messages from both and confirm each side sees both, with increasing seq.",
          "Run `XRANGE history:doc-1 - +` in redis-cli to see the persisted history.",
        ],
        checklist: [
          "Messages sent on gateway 8080 appear on a client of 8081",
          "Every message has a seq and seqs are unique per room",
          "History is readable from Redis after both clients disconnect",
          "I can explain why the subscriber needs its own Redis connection",
        ],
        deliverable: "A screenshot or log of both wscat sessions plus the XRANGE output.",
      },
      quiz: [
        {
          q: "Why does the gateway use two separate Redis connections (pub and sub)?",
          options: [
            "For load balancing",
            "A connection in subscribe mode can only run subscribe-related commands",
            "Redis limits each connection to 1,000 commands",
            "To encrypt messages",
          ],
          answer: 1,
          explain: "Once a RESP2 connection issues SUBSCRIBE it enters pub/sub mode and cannot run INCR, XADD or PUBLISH, so you need a second connection.",
        },
        {
          q: "What do the 41/10/12 bits of a Snowflake ID encode?",
          options: [
            "User id / channel id / sequence",
            "Milliseconds since epoch / machine id / per-ms sequence",
            "Random / random / checksum",
            "Seconds / region / shard",
          ],
          answer: 1,
          explain: "Timestamp first makes IDs sortable by time; machine id avoids coordination; the sequence allows 4096 IDs per millisecond per machine.",
        },
        {
          q: "For a 10,000-member channel, why is fan-out on read usually preferred over fan-out on write?",
          options: [
            "It is faster for readers",
            "Fan-out on write would do 10,000 inbox writes per message",
            "Fan-out on read works offline",
            "Fan-out on write cannot preserve order",
          ],
          answer: 1,
          explain: "Store once per channel and let members read it. Fan-out on write suits small groups or feeds where read latency matters most.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, how a message sent on one WebSocket server reaches a user connected to another.",
      implementPrompt:
        "From memory, write a Snowflake ID generator and show the IDs it produces are sortable by creation time.",
      videos: [
        {
          title: "Design a chat system like WhatsApp (ByteByteGo)",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+design+chat+system+whatsapp",
          kind: "search",
          reason: "Watch this for a full walkthrough of the connection tier and storage choices.",
        },
        {
          title: "WebSockets in depth (Hussein Nasser)",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+websockets",
          kind: "search",
          reason: "Watch this if you want the protocol view: upgrade handshake, frames and why sockets make servers stateful.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "design-llm-gateway",
    title: "Design: an LLM gateway",
    week: 22,
    domain: "systems",
    skills: ["ai-system-design"],
    difficulty: "hard",
    minutes: 90,
    summary: "One internal endpoint in front of every model: routing, fallbacks, per-key limits, semantic cache, streaming and cost.",
    tags: ["llm-gateway", "fallbacks", "circuit-breaker", "semantic-cache", "cost-tracking"],
    prerequisites: ["system-design-method"],
    lesson: {
      hook: p(
        "IdeaGuard calls Gemini directly. ZtudyLock calls OpenAI directly. Cortex will call two providers plus an embedding model. Each app has its own retry logic, its own API keys in env vars, and nobody can answer \"how much did we spend on LLMs yesterday, and on which feature?\"",
        "Then OpenAI has a bad hour. IdeaGuard is down, because the fallback to another model was never written.",
        "Every company that ships more than one AI feature ends up building the same thing: a single internal endpoint that every app calls, which owns routing, keys, limits, caching and cost. That is an LLM gateway, and designing one is now a standard AI system design question.",
      ),
      whyItMatters:
        "The gateway is where reliability, cost control and observability for AI features live. Designing one forces you to combine rate limiting, caching, streaming and failure handling in a single coherent system.",
      levels: {
        l1: "An LLM gateway is a middleman between your apps and the AI providers. Apps send it a request in one standard format; it decides which provider and model to use, tries another one if the first fails, stops any single user from overspending, reuses answers it has seen before, and records what every call cost.",
        l2: {
          text: p(
            "It is an API gateway plus a travel agent. The API gateway part (auth, rate limits, logging) is what you know from Express middleware. The travel-agent part is new: \"the direct flight is cancelled, I rebooked you through another airline, same arrival time, here is the receipt\".",
            "The gateway is also the one place with a complete view of traffic, so it is where you measure time-to-first-token, tokens per second and cost per feature.",
          ),
          analogy: "Like a payments processor routing a card through backup acquirers when the first declines, while keeping a ledger of every fee.",
          diagram: {
            type: "stack",
            title: "Request path through the gateway",
            layers: [
              { label: "Auth", note: "virtual key -> team, feature, budget" },
              { label: "Rate limit", note: "RPM + TPM token buckets per key" },
              { label: "Cache", note: "exact hash, then semantic (opt-in, temperature 0)" },
              { label: "Router", note: "alias -> ordered providers; circuit breakers", accent: true },
              { label: "Provider adapters", note: "OpenAI-compatible in, provider format out" },
              { label: "Stream relay + usage", note: "SSE passthrough, capture usage at end" },
              { label: "Ledger + traces", note: "cost row, OTel span: TTFT, tokens, model" },
            ],
          },
        },
        l3: {
          text: p(
            "**Requirements.** An OpenAI-compatible `POST /v1/chat/completions` so existing SDKs work by changing `base_url`. Model *aliases* (`cortex-answer`, `cortex-cheap`) that map to ordered provider lists, so you can swap models without redeploying apps. Fallback on 429, 5xx and timeouts, never on 400 (a bad request fails the same everywhere). Per-key RPM and TPM limits and monthly budgets. Streaming passthrough with under 20 ms added TTFT. Cost per request attributed to key, team and feature.",
            "**Estimates.** Say 50 requests/s peak across all apps. The gateway's own work (auth, limit check, cache lookup, logging) is milliseconds; the upstream call is seconds. So the gateway is I/O-bound and holds many concurrent streams: 50 req/s x 15 s average = ~750 concurrent upstream connections. Async Python or Node handles that on a couple of instances; the design must avoid a thread per request.",
            "**Fallback and circuit breaking.** Retrying a dead provider on every request adds its timeout to every request. A circuit breaker counts consecutive failures per provider and, once open, skips that provider for a cool-down window, then lets one trial request through (half-open).",
          ),
          code: [
            {
              title: "Fallback routing with per-provider circuit breakers (httpx, async)",
              lang: "python",
              code: `import os, time, httpx

class Breaker:
    def __init__(self, threshold=3, cooldown=30.0):
        self.threshold, self.cooldown, self.fails, self.opened = threshold, cooldown, 0, 0.0
    def available(self) -> bool:   # closed, or open long enough to allow a trial (half-open)
        return self.fails < self.threshold or time.monotonic() - self.opened > self.cooldown
    def record(self, ok: bool):
        if ok:
            self.fails = 0
        else:
            self.fails += 1
            if self.fails >= self.threshold:
                self.opened = time.monotonic()

ROUTES = {  # alias -> ordered providers; model names are examples, use current ones
    "cortex-answer": [
        ("openai", "https://api.openai.com/v1/chat/completions", "gpt-4o-mini", "OPENAI_API_KEY"),
        ("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
         "gemini-2.0-flash", "GEMINI_API_KEY"),
    ],
}
breakers = {name: Breaker() for route in ROUTES.values() for name, *_ in route}
RETRYABLE = {408, 429, 500, 502, 503, 504}

async def complete(client: httpx.AsyncClient, alias: str, messages: list[dict]):
    for name, url, model, key_env in ROUTES[alias]:
        if not breakers[name].available():
            continue
        try:
            r = await client.post(url, json={"model": model, "messages": messages},
                                  headers={"Authorization": "Bearer " + os.environ[key_env]},
                                  timeout=httpx.Timeout(30.0, connect=3.0))
        except httpx.TransportError:              # includes timeouts
            breakers[name].record(False)
            continue
        if r.status_code in RETRYABLE:
            breakers[name].record(False)
            continue
        breakers[name].record(True)
        r.raise_for_status()                      # other 4xx: caller's bug, do not fall back
        return name, r.json()
    raise RuntimeError("all providers for " + alias + " unavailable")`,
              note: "Both OpenAI and Gemini expose OpenAI-compatible chat endpoints, which is why one request shape works for both. The usage object in each response is what the cost ledger records.",
            },
          ],
        },
        l4: {
          text: p(
            "**Semantic caching** stores (embedding of prompt, response) and serves a cached response when a new prompt's embedding is similar enough. It can cut cost dramatically for FAQ-style traffic, and it can also serve a confidently wrong answer: \"refund policy for EU users\" and \"refund policy for US users\" can be 0.97 similar. Rules: namespace the cache by tenant + model + system prompt + tools, only cache deterministic requests (temperature 0, no user-specific context), use a high threshold (0.95+), and log hits so you can audit them. Exact-match caching on a hash of the full request is always safe and should come first.",
            "**Streaming passthrough.** The gateway must forward SSE chunks as they arrive, not buffer. Two subtleties: once you have started streaming a 200 response you cannot switch to a fallback provider mid-answer, so fallback decisions happen before the first byte; and usage (token counts) arrives only at the end of the stream (with OpenAI you must set `stream_options.include_usage`), so the cost ledger is written when the stream closes, including when the client disconnects early.",
            "**Cost ledger.** One row per request: key, feature, provider, model, input/output/cached tokens, cost computed from a versioned price table, latency, TTFT, cache hit. Budgets are enforced by summing the ledger (or a Redis counter updated alongside it).",
          ),
          code: [
            {
              title: "Minimal semantic cache (numpy), namespaced and thresholded",
              lang: "python",
              code: `import numpy as np

class SemanticCache:
    def __init__(self, embed, threshold: float = 0.95):
        self.embed, self.threshold = embed, threshold
        self.vecs: list[np.ndarray] = []
        self.rows: list[tuple[str, str]] = []           # (namespace, response)

    def _unit(self, text: str) -> np.ndarray:
        v = np.asarray(self.embed(text), dtype=np.float32)
        return v / np.linalg.norm(v)

    def get(self, namespace: str, prompt: str):
        if not self.vecs:
            return None
        sims = np.stack(self.vecs) @ self._unit(prompt)  # cosine: vectors are unit length
        for i in np.argsort(-sims):
            if sims[i] < self.threshold:
                return None
            if self.rows[i][0] == namespace:
                return self.rows[i][1], float(sims[i])
        return None

    def put(self, namespace: str, prompt: str, response: str):
        self.vecs.append(self._unit(prompt))
        self.rows.append((namespace, response))`,
              note: "In production this is a vector index (pgvector or Redis) filtered by namespace, with a TTL. The namespace string is something like tenant + ':' + model + ':' + sha256(system_prompt).",
            },
            {
              title: "Cost ledger table",
              lang: "sql",
              code: `CREATE TABLE llm_calls (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at              timestamptz NOT NULL DEFAULT now(),
    api_key_id      bigint      NOT NULL,
    feature         text        NOT NULL,      -- 'cortex.answer', 'cortex.ingest.summary'
    provider        text        NOT NULL,
    model           text        NOT NULL,
    input_tokens    int         NOT NULL,
    output_tokens   int         NOT NULL,
    cached_tokens   int         NOT NULL DEFAULT 0,
    cost_usd        numeric(12, 6) NOT NULL,   -- computed from a versioned price table
    ttft_ms         int,
    total_ms        int         NOT NULL,
    cache_hit       text        NOT NULL DEFAULT 'none',  -- none | exact | semantic
    status          int         NOT NULL
);
CREATE INDEX ON llm_calls (api_key_id, at);

-- spend per feature, last 7 days
SELECT feature, sum(cost_usd) AS usd, count(*) AS calls
FROM llm_calls WHERE at > now() - interval '7 days'
GROUP BY feature ORDER BY usd DESC;`,
            },
          ],
        },
        l5: {
          question:
            "Design an internal LLM gateway used by 10 product teams. Requirements: provider failover, per-team budgets, streaming, and an answer to 'what did feature X cost last week?'. What are the hardest parts and how do you handle them?",
          hint: "Pick two deep dives: streaming with fallback, and correct cost accounting are good ones.",
          answer: p(
            "I would expose an OpenAI-compatible endpoint so teams only change their base URL, and issue virtual keys that map to a team, a feature tag and a budget. The request path is auth, RPM/TPM token-bucket limits in Redis, exact-match cache, optional semantic cache for opted-in deterministic routes, then a router that maps a model alias to an ordered list of providers with circuit breakers, and finally a streaming relay.",
            "The first hard part is streaming with failover: fallback is only possible before the first byte, so I would use a short connect/TTFT timeout per provider, fail over on 429/5xx/timeout but never on 400, and once streaming starts, surface mid-stream failures to the client as an error event rather than silently switching models.",
            "The second is cost accounting: usage arrives at the end of the stream, so the relay captures it (requesting usage in stream options), writes a ledger row with tokens, provider, model and cost from a versioned price table, and also records partial usage when clients disconnect. Budgets are enforced from a Redis counter updated per call and reconciled with the ledger. Everything emits OpenTelemetry spans with TTFT, tokens/s, provider and cache status so teams can debug their own latency.",
          ),
        },
      },
      commonMistakes: [
        "Falling back on every error, including 400s and content-policy refusals, which doubles cost and hides real bugs.",
        "Buffering the upstream stream in the gateway, destroying time-to-first-token.",
        "Semantic caching without namespacing by tenant, model and system prompt, which can leak one user's answer to another.",
        "Rate limiting only requests per minute when providers limit tokens per minute; a few huge prompts exhaust the real quota.",
      ],
      tryThis:
        "Point the complete() function at an invalid OpenAI key and a valid Gemini key. Is a 401 a reason to fall back? Decide, then adjust RETRYABLE accordingly and justify it.",
      miniTask: {
        title: "Write the gateway's one-page design",
        kind: "explain",
        minutes: 40,
        steps: [
          "List 5 functional and 4 non-functional requirements for a gateway serving IdeaGuard, ZtudyLock and Cortex.",
          "Estimate concurrent upstream connections from peak requests/s and average response duration.",
          "Write the external API (one endpoint plus headers) and the ledger schema.",
          "Draw the request path as boxes, including where streaming and cost logging happen.",
          "Write the fallback policy as a table: status code or error -> fall back? -> trip breaker?",
        ],
        checklist: [
          "Concurrency estimate is written with arithmetic",
          "Fallback table covers 400, 401, 408, 429, 500, 503 and timeout",
          "Cache section states what is never cached",
          "The design says where usage is captured for streamed responses",
        ],
        deliverable: "A one-page design doc for the gateway you will build in the lab.",
      },
      quiz: [
        {
          q: "Your gateway is streaming a response from provider A, which dies after 200 tokens. What is the correct behaviour?",
          options: [
            "Silently continue the answer with provider B",
            "Restart from scratch with provider B inside the same stream",
            "Send an error event to the client and log partial usage; fallback only applies before the first byte",
            "Retry provider A three times mid-stream",
          ],
          answer: 2,
          explain: "Once bytes have been sent you cannot swap providers transparently: the text would not match. Surface the failure and let the client retry.",
        },
        {
          q: "Which request is safe to serve from a semantic cache?",
          options: [
            "A temperature-0 FAQ question to a shared help bot with the same system prompt",
            "A question answered with the user's private retrieved documents",
            "A creative-writing request at temperature 1.0",
            "Any request with cosine similarity above 0.8",
          ],
          answer: 0,
          explain: "Semantic caching only works for deterministic, non-personalised requests within the same namespace; 0.8 is far too loose a threshold.",
        },
        {
          q: "Why should a gateway limit tokens per minute and not only requests per minute?",
          options: [
            "Tokens are easier to count",
            "Provider quotas and costs scale with tokens, and requests vary 100x in size",
            "RPM limits are not supported by Redis",
            "TPM limits improve cache hit rate",
          ],
          answer: 1,
          explain: "A single 100k-token request can use more quota than a thousand small ones. TPM is the limit that matches cost and upstream quotas.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, what an LLM gateway does and why fallbacks must happen before the first streamed byte.",
      implementPrompt:
        "From memory, write a circuit breaker class with closed, open and half-open behaviour, and a fallback loop over two providers that does not fall back on HTTP 400.",
      videos: [
        {
          title: "LLM gateways and routing in production (AI Engineer)",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+llm+gateway+routing+fallback",
          kind: "search",
          reason: "Watch this for how teams running LLMs at scale structure routing, fallbacks and cost controls.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "design-doc-chat-system",
    title: "Write a real design doc: chat system",
    week: 22,
    duration: "3h",
    minutes: 180,
    difficulty: "medium",
    domain: "systems",
    skills: ["sd-practice", "technical-writing", "scalability"],
    prerequisites: ["The system design method", "Design: a real-time chat system"],
    topicSlugs: ["system-design-method", "design-chat-system"],
    objective:
      "Produce the kind of design doc a senior engineer would circulate before building: a chat feature for Cortex workspaces (1:1 and group chat about documents), with requirements, estimates, API, schema, a diagram and explicit trade-offs.",
    expectedOutput:
      "A 3-5 page Markdown doc in `docs/design/chat.md` with every section of the template filled, one architecture diagram (Excalidraw PNG or Mermaid), numbers with arithmetic, and at least three alternatives considered and rejected with reasons.",
    steps: [
      {
        title: "Scope and requirements (20 min)",
        detail:
          "Write goals and explicit non-goals (e.g. no voice, no E2E encryption in v1). Functional: send/receive, groups up to 200, history, unread counts, presence, typing. Non-functional: p99 delivery under 300 ms in-region, no message loss after server ack, 99.9% availability. Non-goals are as important as goals: they stop scope creep in review.",
      },
      {
        title: "Estimates (20 min)",
        detail:
          "Pick numbers and show the arithmetic: DAU, messages per user per day, peak factor, average message size, concurrent connections. Derive messages/s at peak, storage per day and per year, and the number of gateway servers at 50k connections each. Circle the one number that most shapes the design.",
      },
      {
        title: "API and event protocol (30 min)",
        detail:
          "REST for history and channel management (`GET /channels/:id/messages?before=:cursor&limit=50`, `POST /channels`), WebSocket frames for real-time (`send`, `ack`, `message`, `typing`, `presence`, `resume {lastSeenIds}`). Show example JSON for each frame, including `client_msg_id` for idempotent sends.",
      },
      {
        title: "Data model (30 min)",
        detail:
          "Tables for channels, memberships (with `last_read_message_id` for unread counts), messages (key design and index), plus Redis keys for presence and user-to-gateway mapping. For each, write the top query it serves. Decide Postgres vs a wide-column store and justify it with your estimates.",
      },
      {
        title: "Architecture diagram and flows (40 min)",
        detail:
          "Draw gateways, chat service, pub/sub, message store, presence store, push notification worker and queue. Then write two numbered sequences: 'Alice sends a message to a group' and 'Bob reconnects after 2 hours offline'.",
      },
      {
        title: "Trade-offs, failure modes and alternatives (30 min)",
        detail:
          "At least three alternatives rejected (e.g. long polling vs WebSocket, fan-out on write vs read, Kafka vs Redis pub/sub) with reasons. A failure table: Redis down, a gateway crashes, the DB is slow, a client sends 100 messages/s. End with open questions for reviewers.",
      },
    ],
    hints: [
      "Write the doc for a reviewer who has 10 minutes: put a 5-line summary and the diagram at the top.",
      "If a section has no numbers, it is probably hand-waving. Tie at least three decisions to an estimate.",
      "Mermaid sequence diagrams render on GitHub and are easier to keep in sync with the doc than images.",
    ],
    stretch:
      "Add a section on an AI participant in the channel (Cortex answering @cortex mentions with citations): how its streamed reply is delivered to all members and how you stop it from being triggered in a loop.",
    learned: [
      "How to turn a vague feature into requirements, non-goals and numbers",
      "How to express a real-time protocol as concrete frames and flows",
      "How to argue for a design with alternatives and failure modes, not just a diagram",
      "What a reviewable design doc looks like",
    ],
    starter: {
      title: "docs/design/chat.md skeleton",
      lang: "text",
      code: `# Design: Workspace chat for Cortex
Author: Goutham G    Status: Draft    Reviewers: (you, future me)

## Summary (5 lines)
## Goals / Non-goals
## Requirements
- Functional:
- Non-functional (latency, availability, durability, scale):
## Estimates (show arithmetic)
| Quantity | Assumption | Result |
## API
### REST
### WebSocket frames (JSON examples)
## Data model
| Store | Key / table | Serves query |
## Architecture (diagram)
## Key flows
1. Send message to a group
2. Reconnect after being offline
## Alternatives considered
| Option | Why not |
## Failure modes
| Failure | Impact | Mitigation |
## Open questions`,
    },
  },
  {
    slug: "llm-gateway",
    title: "Build a small LLM gateway",
    week: 22,
    duration: "1d",
    minutes: 420,
    difficulty: "hard",
    domain: "systems",
    skills: ["ai-system-design", "fastapi", "streaming", "caching", "observability"],
    prerequisites: ["Design: an LLM gateway", "Redis-backed token bucket rate limiter", "FastAPI basics"],
    topicSlugs: ["design-llm-gateway", "system-design-method"],
    objective:
      "Build a FastAPI service with an OpenAI-compatible endpoint that routes model aliases to providers with fallback and circuit breakers, enforces per-key rate limits, caches exact-match responses, streams SSE without buffering, and writes a cost ledger row for every call. Cortex will call its LLMs through it from now on.",
    expectedOutput:
      "`POST /v1/chat/completions` works with the official OpenAI Python SDK by setting `base_url`; killing the primary provider (bad key or blocked URL) transparently routes to the secondary; per-key limits return 429; repeated identical requests hit the cache; `GET /admin/costs` shows spend per key and feature.",
    steps: [
      {
        title: "Skeleton and virtual keys",
        detail:
          "Start from the starter. Add a `keys` table (or a dict for now) mapping a virtual key like `sk-cortex-dev` to `{team, feature, rpm, tpm}`. Reject unknown keys with 401. Provider keys live only in the gateway's environment, never in apps.",
      },
      {
        title: "Routing with fallback and circuit breakers",
        detail:
          "Implement `ROUTES` (alias -> ordered providers) and the breaker from the topic. For non-streaming requests, loop through providers; fall back on 408/429/5xx/transport errors only. Add an `X-Gateway-Provider` response header so you can see who answered.",
      },
      {
        title: "Streaming passthrough with fallback before first byte",
        detail:
          "For `stream: true`, open the upstream stream, check its status *before* returning the StreamingResponse, and only then relay lines. If the status is retryable, close it and try the next provider. Set `stream_options: {include_usage: true}` and parse the final chunk's usage while relaying.",
      },
      {
        title: "Per-key limits",
        detail:
          "Reuse your week-21 token bucket: one bucket for requests per minute and one for tokens per minute (estimate prompt tokens as characters / 4 before the call). Return 429 with Retry-After from the gateway itself, which is distinct from a provider 429.",
      },
      {
        title: "Exact-match cache",
        detail:
          "Key = sha256 of the canonical JSON of (alias, messages, temperature, max_tokens, tools). Only cache when temperature is 0 and stream is false. Store in Redis with a 24 h TTL; mark hits with `X-Gateway-Cache: hit`.",
      },
      {
        title: "Cost ledger and admin endpoint",
        detail:
          "Create the `llm_calls` table from the topic. Keep a price table dict per model (input/output USD per million tokens, with a comment on the date you checked). Write one row per call, including cache hits (cost 0) and failures. `GET /admin/costs?days=7` groups by key and feature.",
      },
      {
        title: "Prove it",
        detail:
          "Write a script that uses the OpenAI SDK against the gateway: a normal call, a streamed call, the same call twice (cache), 100 quick calls (429s), and a call after breaking the primary key (fallback). Save the output as `DEMO.md` with screenshots of the ledger query.",
      },
    ],
    hints: [
      "Create one `httpx.AsyncClient` at startup and reuse it; a client per request loses connection pooling and adds TLS handshakes.",
      "You cannot change the HTTP status after a StreamingResponse starts. Do all fallback decisions before returning it.",
      "Canonicalise JSON for cache keys with `json.dumps(obj, sort_keys=True, separators=(',', ':'))`.",
      "Test fallback without waiting for an outage: point the primary at `http://127.0.0.1:9` (nothing listens there) to get an instant connection error.",
    ],
    stretch:
      "Add OpenTelemetry tracing with a span per upstream attempt (attributes: provider, model, status, ttft_ms, tokens) and view traces in Jaeger or Langfuse. Then add a semantic cache behind a per-route flag.",
    learned: [
      "How fallback, circuit breaking and streaming interact in a real proxy",
      "Why TPM limits and usage capture at the end of a stream matter for cost",
      "How to make a service drop-in compatible with an existing SDK",
      "How a single choke point gives you cost and latency observability for every AI feature",
    ],
    starter: {
      title: "gateway.py starter: auth + streaming passthrough (single provider)",
      lang: "python",
      code: `import os
import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI()
client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0))
UPSTREAM = "https://api.openai.com/v1/chat/completions"
KEYS = {"sk-cortex-dev": {"team": "cortex", "feature": "answer"}}

@app.post("/v1/chat/completions")
async def chat(request: Request, authorization: str = Header(default="")):
    vkey = authorization.removeprefix("Bearer ").strip()
    if vkey not in KEYS:
        raise HTTPException(401, "unknown gateway key")
    body = await request.json()
    headers = {"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]}

    if not body.get("stream"):
        r = await client.post(UPSTREAM, json=body, headers=headers)
        # TODO: fallback, cache, ledger row from r.json()["usage"]
        return JSONResponse(r.json(), status_code=r.status_code)

    body["stream_options"] = {"include_usage": True}
    upstream = await client.send(
        client.build_request("POST", UPSTREAM, json=body, headers=headers), stream=True
    )
    if upstream.status_code != 200:                 # decide BEFORE streaming starts
        await upstream.aread()
        await upstream.aclose()
        return JSONResponse(upstream.json(), status_code=upstream.status_code)

    async def relay():
        try:
            async for line in upstream.aiter_lines():
                if line:
                    yield line + "\\n\\n"          # re-frame SSE events
                    # TODO: parse the final chunk's usage for the ledger
        finally:
            await upstream.aclose()

    return StreamingResponse(relay(), media_type="text/event-stream")`,
    },
  },
];
