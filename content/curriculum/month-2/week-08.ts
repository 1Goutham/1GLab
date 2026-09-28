import type { LabSeed, TopicSeed } from "../../types";

/**
 * Week 8 — Advanced backend.
 * Background jobs, Docker, and rate limiting: the plumbing that turns an
 * LLM call into an AI API that survives real traffic.
 */

export const topics: TopicSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "queues-background-jobs",
    title: "Queues & background jobs",
    week: 8,
    domain: "backend",
    skills: ["queues", "async-concurrency"],
    difficulty: "medium",
    minutes: 75,
    summary: "Take slow work out of the request: accept, enqueue, return 202, let a worker do it with retries, and make the job safe to run twice.",
    tags: ["queues", "background-jobs", "rq", "celery", "skip-locked", "idempotency", "retries"],
    lesson: {
      hook: `A user drops a 120-page PDF into Cortex. Processing it means extracting text, splitting it into 400 chunks, calling an embeddings API 400 times and writing vectors to Postgres. That takes 40 seconds on a good day.

If you do that inside the HTTP request, the browser spins, a Vercel function hits its timeout, the user refreshes and uploads it again, and now you are processing it twice. If the embeddings API hiccups at chunk 380, all the work is lost.

The fix every serious backend uses: the request only **records the intent** ("process doc 42"), puts a message on a **queue**, and returns \`202 Accepted\` in 50 ms. A separate **worker** process picks it up, does the slow work with retries, and updates a status the UI can poll or stream.

You have seen this from the outside: Vercel's build queue, Stripe webhooks, email sending. Today you build one.`,
      whyItMatters:
        "Document ingestion, embedding backfills, eval runs, agent tasks and webhook handling are all background jobs. Doing them reliably (no lost jobs, no double charges, bounded retries) is what separates an AI demo from an AI product.",
      levels: {
        l1: `Some work is too slow to make a user wait for. So the web server writes the task on a to-do list and immediately says "got it, working on it". Separate worker programs take tasks off the list one by one, do them, and mark them done. If a worker crashes, the task goes back on the list for someone else.`,
        l2: {
          analogy: `A restaurant. The waiter (API) takes your order, pins the ticket on the kitchen rail (queue) and goes to serve other tables. Cooks (workers) pull tickets, cook, and ring the bell (status update). If the kitchen gets busy you hire more cooks, not more waiters. And if a cook drops a dish halfway, the ticket is still on the rail, so it gets cooked again rather than forgotten.`,
          text: `The pieces:

- **Producer**: the API endpoint that enqueues a job and returns a job id.
- **Broker / queue**: durable storage for pending jobs. Redis (RQ, Celery, arq, BullMQ in Node), Postgres (\`FOR UPDATE SKIP LOCKED\`), or managed (SQS, Cloud Tasks, Inngest, QStash).
- **Worker**: a separate process that claims jobs, runs them and records the result.
- **Status**: stored where the API can read it (job table or broker), exposed via polling or SSE.

Real queues give **at-least-once** delivery: a job can run twice (a worker finishes the work but crashes before acknowledging). So jobs must be **idempotent**: running twice has the same effect as once.`,
          diagram: {
            type: "flow",
            title: "Processing an uploaded document",
            lanes: [
              {
                label: "Inline (bad)",
                tone: "bad",
                steps: [
                  { label: "POST /upload", note: "request held open" },
                  { label: "extract + chunk + embed", note: "40 s, 400 API calls" },
                  { label: "timeout / refresh", note: "work lost or duplicated", accent: true },
                ],
              },
              {
                label: "Queued (good)",
                tone: "good",
                steps: [
                  { label: "POST /upload", note: "store file, insert job" },
                  { label: "202 + job_id", note: "returns in ~50 ms" },
                  { label: "Worker claims job", note: "retries with backoff" },
                  { label: "status = done", note: "UI polls /jobs/:id", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `**FastAPI's BackgroundTasks is not a queue.** It runs the function in the same process after the response is sent. If the server restarts during a deploy, the job silently vanishes, and a slow CPU-bound job still steals capacity from requests. Fine for "send a log line", not for "process a document".

The good version below uses **RQ** (Redis Queue): the simplest real queue in Python. The function lives in a module both the API and the worker can import. The API enqueues and returns immediately; the worker runs in its own process:

\`rq worker documents --with-scheduler --url redis://localhost:6379/0\`

(\`--with-scheduler\` is needed for delayed retries.) Celery is the heavyweight alternative with routing and schedules; arq is the asyncio-native one. The concepts are identical.`,
          code: [
            {
              title: "Slow work inside the request",
              lang: "python",
              variant: "bad",
              code: `import time

from fastapi import FastAPI

app = FastAPI()

def process_document(doc_id: str) -> int:
    time.sleep(30)          # stand-in for: extract text, chunk, embed 400 chunks, store vectors
    return 400

@app.post("/documents/{doc_id}/process")
def process(doc_id: str):
    chunks = process_document(doc_id)   # client waits 30 s; proxy or serverless timeout kills it
    return {"doc_id": doc_id, "chunks": chunks}`,
              note: "Also bad: a failure at chunk 380 loses everything, and a user refresh starts a duplicate run.",
            },
            {
              title: "tasks.py: the job, importable by API and worker",
              lang: "python",
              variant: "good",
              code: `import time

from rq import get_current_job

def process_document(doc_id: str) -> dict:
    job = get_current_job()
    for stage in ["extract", "chunk", "embed", "store"]:
        job.meta["stage"] = stage
        job.save_meta()          # progress the API can read
        time.sleep(5)            # stand-in for the real work of each stage
    return {"doc_id": doc_id, "chunks": 400}`,
            },
            {
              title: "api.py: enqueue, return 202, expose status",
              lang: "python",
              variant: "good",
              code: `from fastapi import FastAPI, HTTPException
from redis import Redis
from rq import Queue, Retry
from rq.exceptions import NoSuchJobError
from rq.job import Job

from tasks import process_document

app = FastAPI()
redis = Redis.from_url("redis://localhost:6379/0")
queue = Queue("documents", connection=redis)

@app.post("/documents/{doc_id}/process", status_code=202)
def enqueue(doc_id: str):
    job = queue.enqueue(process_document, doc_id, job_timeout=600,
                        retry=Retry(max=3, interval=[10, 30, 90]))
    return {"job_id": job.id, "status": job.get_status()}

@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    try:
        job = Job.fetch(job_id, connection=redis)
    except NoSuchJobError:
        raise HTTPException(status_code=404, detail="unknown job")
    return {"status": job.get_status(), "stage": job.meta.get("stage"), "result": job.return_value()}`,
              note: "Run uvicorn api:app in one terminal and the rq worker in another. POST returns instantly; poll GET /jobs/{id} to watch the stage change.",
            },
          ],
        },
        l4: {
          text: `**You may not need Redis at all.** Postgres can be a perfectly good queue for thousands of jobs per second using \`SELECT ... FOR UPDATE SKIP LOCKED\`. Each worker locks one pending row; other workers skip locked rows instead of waiting, so N workers claim N different jobs with no coordination. The job and your data live in one database, so "insert document and enqueue its job" can be a single transaction: no job is ever lost or created for a rolled-back upload. That is the **transactional outbox** benefit, and it is why libraries like Procrastinate, pg-boss (Node) and Oban (Elixir) exist.

**Delivery semantics.** A worker claims a job, does work, then acknowledges. Crash after the work but before the ack, and the job is redelivered: **at-least-once**. Exactly-once delivery is not achievable in general; exactly-once *effects* are, by making the handler idempotent:

- Use natural keys and upserts: \`INSERT ... ON CONFLICT (doc_id, chunk_idx) DO UPDATE\`.
- Record completion in the same transaction as the side effect.
- For external calls that charge money, pass an idempotency key (Stripe, and many LLM batch APIs, support this).

**Stuck jobs.** A worker that dies mid-job leaves a row in \`running\` forever. The fix is a **lease** (a.k.a. visibility timeout in SQS): store \`locked_at\`, and a reaper re-queues jobs whose lease expired. Set the lease longer than your worst-case job, or have workers heartbeat.

**Retries and poison messages.** Retry transient failures (timeouts, 429s, 5xx) with exponential backoff and jitter; do not retry bugs forever. After N attempts move the job to a **dead-letter** state for a human to inspect. Log the error with the job id.`,
          code: [
            {
              title: "A Postgres job queue in three statements",
              lang: "sql",
              code: `CREATE TABLE jobs (
  id          bigserial PRIMARY KEY,
  document_id bigint NOT NULL,
  status      text NOT NULL DEFAULT 'queued',   -- queued | running | done | dead
  attempts    int  NOT NULL DEFAULT 0,
  run_at      timestamptz NOT NULL DEFAULT now(),
  locked_at   timestamptz,
  last_error  text
);
CREATE INDEX jobs_ready ON jobs (run_at) WHERE status = 'queued';

-- Claim one job. Concurrent workers skip rows another worker has locked.
UPDATE jobs
SET status = 'running', attempts = attempts + 1, locked_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'queued' AND run_at <= now()
  ORDER BY run_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, document_id, attempts;

-- Reaper: re-queue jobs whose worker died (lease expired after 10 minutes).
UPDATE jobs SET status = 'queued', locked_at = NULL
WHERE status = 'running' AND locked_at < now() - interval '10 minutes';`,
              note: "The partial index keeps the claim query fast even with millions of finished jobs in the table.",
            },
          ],
        },
        l5: {
          question: "Design the document-processing pipeline for Cortex at 10,000 uploads per hour. How do you guarantee a document is never lost and never processed into duplicate chunks?",
          hint: "Transactional enqueue, at-least-once delivery, idempotent writes, leases, dead letters.",
          answer: `Uploads go to object storage first, then in one database transaction I insert the document row and a job row, so a job exists if and only if the document does; that removes the 'saved but never enqueued' failure. Workers claim jobs with FOR UPDATE SKIP LOCKED (or an SQS-style queue) under a lease, and a reaper re-queues jobs whose lease expired, so a crashed worker never loses a job. Because delivery is at-least-once, the handler is idempotent: chunks are keyed by (document_id, chunk_index) and written with upserts, or I delete-and-reinsert the document's chunks inside one transaction, and the job is marked done in that same transaction. Embedding calls are batched and retried on 429s and 5xx with exponential backoff and jitter, with a global concurrency cap so workers do not stampede the provider. After a fixed number of attempts the job moves to a dead state with the last error, surfaced on a dashboard and in the document status the user sees. 10k per hour is about 3 per second, which Postgres handles easily; I would scale by adding worker replicas, and watch queue depth and job age as the key metrics.`,
        },
      },
      commonMistakes: [
        "Using FastAPI BackgroundTasks or an un-awaited promise for important work. It dies with the process on every deploy.",
        "Assuming exactly-once delivery. Every real queue can deliver twice; write idempotent handlers.",
        "Retrying forever with no backoff. A poison job loops, burns API credits, and hides the real bug. Cap attempts and dead-letter.",
        "Passing huge payloads (the whole PDF) through the queue. Enqueue an id; the worker reads the data from storage.",
      ],
      tryThis:
        "Start two RQ workers on the same queue, enqueue 10 jobs quickly, and watch in both terminals how the jobs are split between workers. Then kill one worker with Ctrl+C mid-job and see what RQ does with its job.",
      miniTask: {
        title: "Move a slow endpoint onto a queue",
        kind: "build",
        minutes: 45,
        steps: [
          "Start Redis locally (docker run -d -p 6379:6379 redis:7-alpine) and pip install fastapi uvicorn rq redis.",
          "Save tasks.py and api.py from l3. Run uvicorn api:app --reload and, in a second terminal, rq worker documents --with-scheduler.",
          "POST to /documents/42/process and confirm it returns 202 with a job id in well under a second.",
          "Poll GET /jobs/{id} every few seconds and record the stage transitions until status is finished.",
          "Make process_document raise an exception on its first attempt only (store a flag in job.meta) and confirm the Retry policy re-runs it after 10 seconds.",
        ],
        checklist: [
          "The POST returns 202 in under 200 ms",
          "I observed extract → chunk → embed → store via the status endpoint",
          "A failing first attempt was retried automatically and then finished",
          "I can explain why the worker is a separate process from the API",
        ],
        deliverable: "A short screen recording or log excerpt showing the 202 response, stage polling and the automatic retry.",
      },
      quiz: [
        {
          q: "Why must background job handlers be idempotent?",
          options: [
            "Because queues run jobs in random order",
            "Because at-least-once delivery means a job can run more than once, e.g. after a crash before acknowledgement",
            "Because Python functions cannot be retried otherwise",
            "Because Redis stores jobs in memory",
          ],
          answer: 1,
          explain: "If a worker completes the work but dies before acknowledging, the job is redelivered. Idempotent handlers make the second run harmless.",
        },
        {
          q: "What does FOR UPDATE SKIP LOCKED do in a job-claim query?",
          options: [
            "Locks the whole table so only one worker runs",
            "Skips rows already locked by other transactions, so concurrent workers claim different jobs without blocking",
            "Deletes the job after reading it",
            "Retries the job automatically",
          ],
          answer: 1,
          explain: "Without SKIP LOCKED, workers would queue up waiting on the same row lock. With it, each worker grabs the next unlocked row.",
        },
        {
          q: "What is the right HTTP status for 'I accepted your request and will process it asynchronously'?",
          options: ["200 OK", "201 Created", "202 Accepted", "204 No Content"],
          answer: 2,
          explain: "202 means accepted for processing, not yet completed. Return a job id or a status URL (often in a Location header) with it.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences why Cortex processes uploads in a background worker, what at-least-once delivery means, and how idempotency protects you.",
      implementPrompt:
        "From memory, write the Postgres jobs table and the SKIP LOCKED claim query, plus a Python worker loop that claims a job, runs it, marks it done or schedules a retry with exponential backoff.",
      videos: [
        {
          title: "Hussein Nasser on message queues",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+message+queue+when+to+use",
          kind: "search",
          reason: "Watch this for the backend engineer's view of when a queue is worth its complexity and what can go wrong.",
        },
        {
          title: "Postgres as a queue with SKIP LOCKED",
          channel: "Various",
          url: "https://www.youtube.com/results?search_query=postgres+skip+locked+job+queue",
          kind: "search",
          reason: "Watch one if you want to see concurrent workers claiming rows live before you build the lab version.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "docker-essentials",
    title: "Docker: shipping the environment",
    week: 8,
    domain: "cloud",
    skills: ["docker"],
    difficulty: "medium",
    minutes: 70,
    summary: "Package the app with its exact Python, libraries and OS files into an image, run it as an isolated process, and compose it with Postgres and Redis.",
    tags: ["docker", "dockerfile", "docker-compose", "containers", "layers"],
    lesson: {
      hook: `On Vercel you never thought about the machine: push, and Next.js runs. Cortex is different. It is a Python API, a worker process, Postgres with pgvector, and Redis. Four processes with specific versions, system libraries (PDF parsing needs some) and environment variables.

"Works on my machine" is now a real risk: your laptop has Python 3.12 and a pip cache; the server has 3.10 and a missing C library; the worker was started with a different .env.

Docker packages **the whole environment** (OS files, Python version, installed packages, your code, the start command) into one immutable **image**. The image that passed on your laptop is byte-for-byte the image that runs in production. And \`docker compose up\` starts all four services with one command.`,
      whyItMatters:
        "Every AI backend you deploy (Cloud Run, ECS, Fly.io, Kubernetes, Modal) runs containers. Model servers, vector databases and workers all ship as images, and interviewers expect you to write a sane Dockerfile.",
      levels: {
        l1: `A Docker image is a snapshot of everything your app needs to run: the operating system files, the right Python, the libraries and your code. A container is that snapshot running as an isolated program. Because the snapshot never changes, it behaves the same on your laptop, your teammate's laptop and the server.`,
        l2: {
          analogy: `A shipping container. Before containers, every port had to know how to load barrels, sacks and crates differently. After, every ship, crane and truck handles the same box, and nobody cares what is inside. A Docker image is that box for software: Cloud Run, your laptop and a CI runner all know how to run it without knowing it is FastAPI plus pypdf plus Python 3.12.

The **Dockerfile** is the packing list. Each instruction adds a **layer**, and layers are cached. Order the list so things that rarely change (the OS, dependencies) are packed first, and your code (changes every commit) last.`,
          text: `Core vocabulary:

- **Image**: a read-only, layered filesystem plus metadata (start command, env, ports). Built from a Dockerfile, tagged like \`cortex-api:0.2\`.
- **Container**: a running (or stopped) instance of an image with a thin writable layer on top.
- **Volume**: storage that outlives containers (Postgres data must live in one).
- **Port mapping**: \`-p 8000:8000\` is host port → container port.
- **Compose**: a YAML file declaring several services, their networks, volumes and dependencies. Services reach each other by service name (\`postgresql://db:5432\`), not localhost.`,
          diagram: {
            type: "stack",
            title: "Layers of a FastAPI image (top = most frequently changed)",
            layers: [
              { label: "Container writable layer", note: "runtime files; gone when the container is removed" },
              { label: "COPY . .  (your code)", note: "changes every commit: keep it last", accent: true },
              { label: "RUN pip install -r requirements.txt", note: "cached until requirements.txt changes" },
              { label: "COPY requirements.txt", note: "tiny layer; its hash decides the cache above" },
              { label: "FROM python:3.12-slim", note: "Debian slim + CPython, shared across images" },
            ],
          },
        },
        l3: {
          text: `The bad Dockerfile works, which is why it is everywhere. Its problems: the full \`python:3.12\` base is around 1 GB; \`COPY . .\` before \`pip install\` invalidates the dependency layer on **every** code change (six-minute rebuilds); it copies \`.env\`, \`.git\` and your local venv into the image; it runs as root; and shell-form \`CMD\` with \`--reload\` is a dev server that may not receive SIGTERM, so every deploy waits for a hard kill.

The good version fixes each of those. Pair it with a \`.dockerignore\`, which works like \`.gitignore\` for the build context, and is also a security control: secrets you never send to the builder cannot leak into a layer.

Build and run:
\`docker build -t cortex-api .\` then \`docker run --rm -p 8000:8000 --env-file .env cortex-api\`.`,
          code: [
            {
              title: "Works, slowly and unsafely",
              lang: "dockerfile",
              variant: "bad",
              code: `FROM python:3.12
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD uvicorn app.main:app --reload --host 0.0.0.0`,
            },
            {
              title: "Cache-friendly, slim, non-root",
              lang: "dockerfile",
              variant: "good",
              code: `FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first: this layer is reused until requirements.txt changes
COPY requirements.txt .
RUN pip install -r requirements.txt

# Code last: a code change only rebuilds from here
COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`,
              note: "Exec-form CMD (a JSON array) makes uvicorn PID 1, so it receives SIGTERM and shuts down gracefully. PYTHONUNBUFFERED makes logs appear immediately in docker logs.",
            },
            {
              title: ".dockerignore",
              lang: "text",
              code: `.git
.env
.env.*
.venv
__pycache__/
*.pyc
.pytest_cache/
node_modules/
data/
*.ipynb_checkpoints`,
              note: "Without this, COPY . . sends your .env (API keys) into the image, and anyone who pulls the image can read it.",
            },
          ],
        },
        l4: {
          text: `**A container is just a Linux process** with two kernel features applied:

- **Namespaces** change what it can *see*: its own PID tree (it thinks it is PID 1), its own network interfaces, mount table, hostname and users.
- **cgroups** limit what it can *use*: memory, CPU shares, number of processes. \`--memory=512m\` is a cgroup setting; exceed it and the kernel's OOM killer ends the process (exit code 137).

There is no guest OS and no hypervisor, which is why a container starts in milliseconds. On macOS and Windows, Docker Desktop runs a small Linux VM and the containers live inside it.

**Images are stacks of content-addressed layers.** Each Dockerfile instruction that changes files produces a tarball of the diff, identified by its SHA-256. At run time, **overlayfs** stacks the layers read-only and adds a writable layer on top; modifying a file copies it up into that layer (copy-on-write). Layers are shared: ten images on \`python:3.12-slim\` store the base once.

**The build cache rule**: an instruction is reused if its text and inputs are unchanged and every layer before it was reused. For \`COPY\`, the inputs are the checksums of the copied files. One changed byte in any copied file invalidates that layer and everything after it.

**Multi-stage builds** use one stage with compilers to build wheels or a venv, then \`COPY --from=builder\` just the results into a slim final stage, so build tools never ship. A deleted file in a later layer still exists in the earlier layer, so \`RUN rm secret.txt\` does not remove a secret from the image. Use build secrets (\`RUN --mount=type=secret\`) instead.`,
          code: [
            {
              title: "See layers and prove a container is a process",
              lang: "bash",
              code: `docker build -t cortex-api .
docker history cortex-api                 # one row per layer, with its size
docker run -d --name api -p 8000:8000 cortex-api
docker top api                            # processes inside, as the host sees them
docker exec api cat /proc/1/cmdline | tr "\\0" " "; echo   # PID 1 is uvicorn
docker stats --no-stream api              # live cgroup accounting: CPU and memory
docker run --rm --memory=64m python:3.12-slim python -c "b = bytearray(200 * 1024 * 1024)"
echo "exit code: $?"                      # 137: killed by the OOM killer (cgroup limit)
docker rm -f api`,
              note: "On Linux you can also find the same uvicorn process in the host's ps aux output. It is an ordinary process with a different view of the world.",
            },
          ],
        },
        l5: {
          question: "Our API image is 2.1 GB and CI rebuilds take six minutes for a one-line code change. How would you fix it?",
          hint: "Layer order, base image, build context, multi-stage.",
          answer: `The six minutes almost certainly comes from layer ordering: if the code is copied before dependencies are installed, any code change invalidates the pip install layer, so I would copy only the requirements or lock file first, install, then copy the source. CI also needs a warm cache, so I would enable BuildKit's registry or GitHub Actions cache so builds do not start cold. For size, I would switch from the full python base to python:3.12-slim, add a .dockerignore so .git, virtualenvs, datasets and notebooks never enter the build context, and use pip with no cache. If some packages need compilers, a multi-stage build installs into a venv in a builder stage and copies only that venv into the slim runtime stage. Then I would inspect the remaining size with docker history or dive: in AI images the usual culprit is a CUDA-enabled torch wheel of several gigabytes for a service that only calls hosted APIs, or model weights baked into the image that should be pulled at startup or mounted instead. I would expect a few hundred megabytes and a sub-30-second incremental build afterwards.`,
        },
      },
      commonMistakes: [
        "COPY . . before installing dependencies, so every code change reinstalls everything.",
        "No .dockerignore: .env and API keys end up baked into image layers, readable by anyone who can pull the image.",
        "Using localhost inside a container to reach another service. In Compose, use the service name (db, redis).",
        "Storing Postgres data in the container filesystem instead of a named volume, so docker compose down -v (or recreating the container) wipes the database.",
      ],
      tryThis:
        "Build the good Dockerfile, change one line in your code and rebuild, timing both builds. Then move COPY . . above the pip install, repeat, and compare how many steps say CACHED.",
      miniTask: {
        title: "Containerise a FastAPI hello-world",
        kind: "build",
        minutes: 40,
        steps: [
          "Create app/main.py with a FastAPI app exposing GET /health returning {\"ok\": true}, and a requirements.txt with fastapi and uvicorn.",
          "Write the good Dockerfile and the .dockerignore from l3. Build it as cortex-api:dev and note the image size from docker images.",
          "Run it with -p 8000:8000 and curl http://localhost:8000/health.",
          "Change the health response, rebuild, and confirm the pip install step shows CACHED.",
          "Run docker exec on the container to check whoami returns appuser, and confirm no .env file exists in /app.",
        ],
        checklist: [
          "Image is based on python:3.12-slim and is under 250 MB",
          "Incremental rebuild after a code change reuses the dependency layer",
          "The container runs as a non-root user",
          "No .env or .git inside the image",
        ],
        deliverable: "Dockerfile, .dockerignore and a note with the image size and the rebuild time before and after a code change.",
      },
      quiz: [
        {
          q: "Why should COPY requirements.txt and RUN pip install come before COPY . . in a Dockerfile?",
          options: [
            "Docker requires dependencies to be installed first",
            "So code changes do not invalidate the cached dependency layer",
            "To make the image smaller",
            "So the app runs as non-root",
          ],
          answer: 1,
          explain: "A layer's cache is invalidated when its inputs change, and so is every layer after it. Code changes constantly; requirements rarely.",
        },
        {
          q: "A container exits with code 137 under load. What most likely happened?",
          options: [
            "A Python exception",
            "It was killed by SIGKILL, typically the OOM killer enforcing a memory limit",
            "The image is corrupt",
            "The port was already in use",
          ],
          answer: 1,
          explain: "137 = 128 + 9 (SIGKILL). With a memory cgroup limit, exceeding it gets the process OOM-killed. Check docker inspect for OOMKilled: true.",
        },
        {
          q: "In docker compose, how should the api service connect to the Postgres service named db?",
          options: [
            "postgresql://localhost:5432",
            "postgresql://db:5432",
            "postgresql://127.0.0.1:5432",
            "Through the host's published port only",
          ],
          answer: 1,
          explain: "Compose puts services on a shared network with DNS by service name. Inside the api container, localhost is the api container itself.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences what an image, a container and a layer are, and why Dockerfile instruction order matters.",
      implementPrompt:
        "From memory, write a production-ready Dockerfile for a FastAPI app (slim base, cache-friendly order, non-root user, exec-form CMD) and a matching .dockerignore.",
      videos: [
        {
          title: "Docker Tutorial for Beginners",
          channel: "TechWorld with Nana",
          url: "https://www.youtube.com/results?search_query=techworld+with+nana+docker+tutorial+for+beginners",
          kind: "search",
          reason: "Watch the images, containers and compose sections if you have only used Docker by copying commands.",
        },
        {
          title: "Containers from scratch",
          channel: "Liz Rice",
          url: "https://www.youtube.com/results?search_query=liz+rice+containers+from+scratch",
          kind: "search",
          reason: "Watch this to see namespaces and cgroups used directly in about 30 lines of Go; afterwards containers stop feeling like VMs.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "rate-limiting-concurrency",
    title: "Rate limiting & concurrency control",
    week: 8,
    domain: "backend",
    skills: ["async-concurrency", "api-design"],
    difficulty: "hard",
    minutes: 80,
    summary: "Protect your wallet and your providers: token buckets per user, bounded concurrency to the LLM, and retries that back off with jitter.",
    prerequisites: ["queues-background-jobs"],
    tags: ["rate-limiting", "token-bucket", "semaphore", "backoff", "jitter", "429", "redis"],
    lesson: {
      hook: `You tweet a link to Cortex. Someone writes a script that hits \`/ask\` 50 times a second. Each call costs you an LLM request. By morning you have a four-figure bill, and your provider account is throttled so real users get errors too.

Meanwhile your own worker is embedding a 400-chunk document with \`asyncio.gather\` over 400 calls at once, and the embeddings API answers most of them with **429 Too Many Requests**. Your naive retry fires them all again immediately, and you DDoS your own provider.

Both are the same problem seen from two sides: **incoming** traffic you must limit, and **outgoing** traffic you must pace. AI APIs make it acute because every request is expensive and every provider enforces requests-per-minute and tokens-per-minute limits.`,
      whyItMatters:
        "Rate limiting controls cost and abuse; concurrency control and backoff keep you inside provider quotas. Any AI product with real users needs both, and 'design a rate limiter' is one of the most common system design interview questions.",
      levels: {
        l1: `A rate limiter is a bouncer that lets each user in only so often, and politely tells the rest to come back later. Concurrency control is a cap on how many things you do at the same time, like having only five checkout lanes open. Backoff means that when someone says "too busy", you wait a bit longer each time before trying again, instead of hammering them.`,
        l2: {
          analogy: `A **token bucket** is a coffee loyalty card that refills itself. You hold at most 20 stamps (capacity, which allows a burst); one stamp drips back every 3 seconds (refill rate, the sustained speed). Each request spends a stamp. No stamps, no coffee: come back when one has dripped in, and the barista tells you exactly when (the Retry-After header).

A **semaphore** is the five checkout lanes: however many customers arrive, only five are served at once, the rest queue.`,
          text: `The algorithms, from simplest:

- **Fixed window**: count requests per minute bucket. Simple, but allows 2x bursts at window edges (end of one minute + start of the next).
- **Sliding window log/counter**: smooths the edge; the log version stores every timestamp (exact, memory-heavy).
- **Token bucket**: capacity + refill rate. Allows controlled bursts, cheap to store (two numbers per key). What Stripe, AWS and most APIs use.
- **Leaky bucket**: a queue drained at a constant rate; smooths output.

Where to apply them: **per user/API key** at your API edge (cost and fairness), **global** on outgoing provider calls (stay under RPM/TPM), and **bounded concurrency** inside workers.`,
          diagram: {
            type: "compare",
            title: "Incoming vs outgoing control",
            left: {
              label: "Incoming: protect yourself",
              points: [
                "Token bucket per user or API key, stored in Redis",
                "Reject with 429 and a Retry-After header",
                "Different limits per plan (free vs paid)",
                "Also cap cost: tokens per day per user",
              ],
            },
            right: {
              label: "Outgoing: respect providers",
              points: [
                "asyncio.Semaphore caps in-flight LLM calls",
                "Retry 429/5xx with exponential backoff + jitter",
                "Honour the provider's Retry-After",
                "Budget TPM as well as RPM for LLM APIs",
              ],
            },
          },
        },
        l3: {
          text: `The bad snippet is the natural first attempt at embedding many chunks: fire everything at once. The good one adds the two controls you need on any outbound AI call.

1. **\`asyncio.Semaphore(5)\`** caps in-flight calls. It is the async equivalent of a connection pool limit. Note the backoff sleep happens **outside** the \`async with\`, so a waiting retry does not hold a slot.
2. **Exponential backoff with full jitter**: wait a random time between 0 and \`base * 2^attempt\` (capped). The randomness matters: without it, all the requests that failed together retry together, in synchronised waves (the thundering herd). If the provider sends \`Retry-After\`, trust it.

Only retry what is retryable: 429, 408, 500, 502, 503, 504 and network timeouts. A 400 (bad request) or 401 will fail identically every time.

The provider is simulated so the snippet runs anywhere; it fails 20% of calls with a 429.`,
          code: [
            {
              title: "Unbounded fan-out",
              lang: "python",
              variant: "bad",
              code: `import asyncio

async def embed(chunk: str) -> list[float]:
    await asyncio.sleep(0.2)          # stand-in for an embeddings API call
    return [0.0] * 384

async def main():
    chunks = [f"chunk {i}" for i in range(400)]
    # 400 simultaneous requests: instant 429s from the provider, and a naive
    # retry loop re-sends all failures at the same moment
    vectors = await asyncio.gather(*(embed(c) for c in chunks))
    print(len(vectors))

asyncio.run(main())`,
            },
            {
              title: "Bounded concurrency plus backoff with jitter",
              lang: "python",
              variant: "good",
              code: `import asyncio
import random

class RateLimited(Exception):
    def __init__(self, retry_after: float | None = None):
        self.retry_after = retry_after

async def call_llm(prompt: str) -> str:            # simulated provider: 20% of calls get a 429
    await asyncio.sleep(0.2)
    if random.random() < 0.2:
        raise RateLimited(retry_after=None)
    return "answer to " + prompt

sem = asyncio.Semaphore(5)                         # at most 5 in-flight calls

async def call_with_retry(prompt: str, max_attempts: int = 6) -> str:
    for attempt in range(max_attempts):
        try:
            async with sem:
                return await call_llm(prompt)
        except RateLimited as e:
            if attempt == max_attempts - 1:
                raise
            cap = min(8.0, 0.25 * 2 ** attempt)    # 0.25, 0.5, 1, 2, 4, 8 seconds
            delay = e.retry_after if e.retry_after else random.uniform(0, cap)   # full jitter
            await asyncio.sleep(delay)             # sleeping OUTSIDE the semaphore
    raise RuntimeError("unreachable")

async def main():
    results = await asyncio.gather(*(call_with_retry(f"chunk {i}") for i in range(40)))
    print(len(results), results[0])

asyncio.run(main())`,
              note: "40 calls at 5 concurrent and 0.2 s each take about 1.6 s plus retries. Libraries like tenacity package this pattern; write it once by hand first.",
            },
          ],
        },
        l4: {
          text: `**Distributed limits need shared, atomic state.** With three API replicas, an in-memory counter per process allows three times the limit. So the bucket lives in Redis. But "read tokens, compute, write tokens" from Python is a race: two replicas read 1 token at the same time and both allow. The fix is to run the whole read-modify-write **atomically inside Redis** with a Lua script: Redis executes a script start to finish with nothing interleaved.

**The token bucket as maths.** Store \`tokens\` and \`ts\` (last update). On each request: \`tokens = min(capacity, tokens + (now - ts) * rate)\`; if \`tokens >= cost\`, subtract and allow. Nothing runs in the background; refill is computed lazily on read. The time until the next token is \`(cost - tokens) / rate\`, which is exactly your \`Retry-After\`. Set a TTL so idle users' keys disappear.

**Details that bite.** Redis converts Lua numbers to integers in replies, truncating fractional tokens, so return them as strings. Using the client's clock across several servers adds skew; you can read \`redis.call('TIME')\` inside the script instead. And decide your failure mode: if Redis is down, do you fail open (allow, risk cost) or fail closed (reject, risk availability)? For a paid LLM endpoint, most teams fail closed or fall back to a conservative local limit.

**LLM-specific**: providers limit **tokens per minute** as well as requests. Charge the bucket with the estimated tokens (prompt length plus max_tokens) instead of a cost of 1, then correct with the actual usage the response reports.`,
          code: [
            {
              title: "Atomic Redis token bucket as a FastAPI dependency",
              lang: "python",
              code: `import math
import time

from fastapi import Depends, FastAPI, HTTPException, Request
from redis import Redis

r = Redis.from_url("redis://localhost:6379/0")
bucket = r.register_script("""
local cap, rate, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local s = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = math.min(cap, (tonumber(s[1]) or cap) + (now - (tonumber(s[2]) or now)) * rate)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('EXPIRE', KEYS[1], math.ceil(cap / rate) + 1)
return {allowed, tostring(tokens)}
""")

CAPACITY, RATE = 20, 20 / 60          # burst of 20, refill 20 per minute

def rate_limit(request: Request):
    user = request.headers.get("x-api-key") or request.client.host
    allowed, tokens = bucket(keys=["rl:ask:" + user], args=[CAPACITY, RATE, time.time()])
    if not allowed:
        wait = math.ceil((1 - float(tokens)) / RATE)
        raise HTTPException(429, "rate limit exceeded", headers={"Retry-After": str(wait)})

app = FastAPI()

@app.post("/ask", dependencies=[Depends(rate_limit)])
def ask():
    return {"answer": "rate limit passed"}`,
              note: "register_script uses EVALSHA with the script's hash and reloads it automatically if Redis restarted. The Lua runs atomically, so replicas never double-spend a token.",
            },
          ],
        },
        l5: {
          question: "Design rate limiting for Cortex's /ask endpoint: free users get 20 requests per minute, and the whole system must stay under the LLM provider's 500 RPM and 200k tokens-per-minute quota.",
          hint: "Two layers: per-user at the edge, global on the way out. Think tokens, not just requests.",
          answer: `I would use two independent layers. At the API edge, a token bucket per API key in Redis, updated atomically with a Lua script, with capacity 20 and a refill of 20 per minute; over the limit returns 429 with a Retry-After computed from the bucket state, and plan tiers just change capacity and rate. That protects cost and fairness per user. On the outbound side, a global limiter shared by all API replicas and workers: a Redis token bucket for requests at 500 per minute and a second one for tokens at 200k per minute, charged with an estimate (prompt tokens plus max_tokens) before the call and reconciled with the actual usage afterwards; I would set both to around 80 to 90% of the quota for headroom. Inside each process a semaphore bounds in-flight calls, and provider 429s are retried with exponential backoff and full jitter, honouring Retry-After and with a capped number of attempts. Interactive requests get priority over background ingestion, for example by giving the worker queue its own smaller share of the budget, so a big upload cannot starve users. Finally I would emit metrics for limiter rejections and provider 429s, and decide the fail mode explicitly: if Redis is unavailable, fall back to conservative per-process limits rather than failing fully open.`,
        },
      },
      commonMistakes: [
        "Keeping rate-limit counters in process memory when running multiple replicas or serverless instances. Each has its own counter.",
        "Doing read-then-write in application code instead of an atomic INCR or Lua script, which lets concurrent requests slip through.",
        "Retrying without jitter, so failed requests retry in synchronised waves and trigger the next wave of 429s.",
        "Holding the semaphore (or a DB connection) while sleeping in backoff, which starves everyone else.",
      ],
      tryThis:
        "In the good snippet, print a timestamp at every retry and change the Semaphore to 1, then 20. Then remove the jitter (use cap instead of random.uniform(0, cap)) and look at how retries cluster in time.",
      miniTask: {
        title: "Rate-limit an endpoint and prove it",
        kind: "build",
        minutes: 45,
        steps: [
          "Run Redis in Docker and save the token-bucket FastAPI app from l4. Start it with uvicorn.",
          "Write a small Python script with httpx that sends 30 POSTs to /ask as fast as possible with the same x-api-key, and counts 200s and 429s.",
          "Confirm the first 20 succeed and the rest get 429, and print the Retry-After header from the first 429.",
          "Wait 6 seconds and send 3 more requests. Predict how many succeed (about 2 tokens refilled) before running.",
          "Send requests with two different API keys and confirm they have independent buckets.",
        ],
        checklist: [
          "Exactly 20 of the first 30 requests returned 200",
          "The 429 responses include a sensible Retry-After",
          "My refill prediction after waiting matched the result",
          "Two API keys were limited independently",
        ],
        deliverable: "load_test.py and its output showing the 200/429 split, the Retry-After value and the refill check.",
      },
      quiz: [
        {
          q: "A token bucket has capacity 10 and refills 1 token per second. It is empty. A client waits 4 seconds, then sends 6 requests instantly. How many are allowed?",
          options: ["6", "4", "10", "0"],
          answer: 1,
          explain: "After 4 seconds the bucket holds 4 tokens. Four requests spend them; the other two get 429 until more tokens drip in.",
        },
        {
          q: "Why add random jitter to exponential backoff?",
          options: [
            "To make retries faster on average",
            "To de-synchronise clients that failed at the same moment, so they do not retry in waves",
            "Because providers require it",
            "To reduce the number of retries",
          ],
          answer: 1,
          explain: "Without jitter, every request that got a 429 together retries together at 1 s, 2 s, 4 s, re-creating the same spike each time.",
        },
        {
          q: "Three API replicas each keep an in-memory limiter of 20 requests per minute per user. What limit does a user actually get?",
          options: [
            "20 per minute",
            "Up to about 60 per minute, depending on the load balancer",
            "Around 7 per minute",
            "Unlimited",
          ],
          answer: 1,
          explain: "Each replica counts independently. Shared state (Redis) with atomic updates is required for a true global limit.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences how a token bucket works and why Cortex needs both a per-user limiter and a global limiter for its LLM provider.",
      implementPrompt:
        "From memory, write an async function that runs 100 LLM calls with at most 8 in flight, retrying 429s with exponential backoff and full jitter, capped at 5 attempts.",
      videos: [
        {
          title: "Design a rate limiter",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+rate+limiter+system+design",
          kind: "search",
          reason: "Watch this for the interview framing: the algorithms side by side and where the limiter sits in the architecture.",
        },
        {
          title: "Hussein Nasser on rate limiting",
          channel: "Hussein Nasser",
          url: "https://www.youtube.com/results?search_query=hussein+nasser+rate+limiting",
          kind: "search",
          reason: "Watch this if you want the backend trade-offs, such as where to enforce limits and what happens under failure.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "docker-compose-stack",
    title: "FastAPI + Postgres + Redis with Docker Compose",
    week: 8,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "cloud",
    skills: ["docker", "fastapi", "sql-postgres", "caching"],
    prerequisites: ["Docker: shipping the environment", "Basic FastAPI"],
    topicSlugs: ["docker-essentials"],
    objective:
      "Run Cortex's backend stack (API, Postgres, Redis) with one docker compose up, with healthchecks so the API only starts once its dependencies are genuinely ready.",
    expectedOutput:
      "docker compose ps shows api, db and redis all 'healthy'. GET http://localhost:8000/health returns {\"ok\": true, \"db\": true, \"redis\": true}. Data survives docker compose down and up (but not down -v).",
    steps: [
      {
        title: "Write the API with a real health endpoint",
        detail:
          "app/main.py: GET /health opens a connection to Postgres (psycopg, SELECT 1) and pings Redis (redis-py ping()), returning booleans for each and HTTP 503 if either fails. Read DATABASE_URL and REDIS_URL from the environment. requirements.txt: fastapi, uvicorn[standard], psycopg[binary], redis.",
      },
      {
        title: "Dockerfile and .dockerignore",
        detail:
          "Reuse the good Dockerfile from the Docker lesson: python:3.12-slim, requirements first, code last, non-root user, exec-form CMD running uvicorn on 0.0.0.0:8000.",
      },
      {
        title: "compose.yaml with healthchecks",
        detail:
          "Use the starter. Postgres uses pg_isready, Redis uses redis-cli ping, and the API uses a Python one-liner (slim images have no curl). depends_on with condition: service_healthy makes the API wait for real readiness, not merely for the container to start.",
      },
      {
        title: "Bring it up and inspect",
        detail:
          "docker compose up --build -d, then docker compose ps (watch the status go from 'starting' to 'healthy'), docker compose logs -f api, and curl localhost:8000/health.",
      },
      {
        title: "Prove persistence and networking",
        detail:
          "docker compose exec db psql -U cortex -c 'CREATE TABLE notes(id serial, n int); INSERT INTO notes(n) VALUES (1);' — then docker compose down and up again and confirm the row is still there. Then docker compose down -v and confirm it is gone. Explain the difference.",
      },
      {
        title: "Break it on purpose",
        detail:
          "docker compose stop redis and hit /health: you should get 503 with redis false, and after the healthcheck retries the api status should become unhealthy. Start redis again and watch it recover.",
      },
    ],
    hints: [
      "Inside the compose network the hosts are db and redis, never localhost. From your laptop you reach them through the published ports.",
      "Healthcheck commands run inside the container, so use tools that exist in that image.",
      "If the API crash-loops at startup, docker compose logs api almost always shows a connection string or import error.",
      "Put secrets in a .env file next to compose.yaml (Compose reads it automatically) and keep it in .gitignore and .dockerignore.",
    ],
    stretch:
      "Switch the db image to pgvector/pgvector:pg16, run CREATE EXTENSION vector in an init script mounted into /docker-entrypoint-initdb.d, and add a worker service that reuses the api image with a different command. Add resource limits (mem_limit) and restart: unless-stopped.",
    learned: [
      "Composing multiple services with networking by service name",
      "Using healthchecks and depends_on conditions for real startup ordering",
      "Named volumes for persistent database data",
      "Designing a health endpoint that checks dependencies and returns 503 when degraded",
    ],
    starter: {
      title: "compose.yaml",
      lang: "yaml",
      code: `services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://cortex:cortex@db:5432/cortex
      REDIS_URL: redis://redis:6379/0
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 3s
      retries: 3

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: cortex
      POSTGRES_PASSWORD: cortex
      POSTGRES_DB: cortex
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cortex -d cortex"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:`,
      note: "urlopen raises on a 503, so the API healthcheck fails whenever /health reports a broken dependency.",
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "background-embedding-worker",
    title: "A background worker for document processing",
    week: 8,
    duration: "45m",
    minutes: 45,
    difficulty: "medium",
    domain: "backend",
    skills: ["queues", "async-concurrency", "sql-postgres"],
    prerequisites: ["Queues & background jobs", "FastAPI + Postgres + Redis with Docker Compose"],
    topicSlugs: ["queues-background-jobs", "rate-limiting-concurrency"],
    objective:
      "Process uploaded documents asynchronously with a Postgres SKIP LOCKED queue (or RQ if you prefer): the API returns 202 immediately, workers chunk the text, and failures retry with backoff and end in a dead state.",
    expectedOutput:
      "Uploading 10 text files returns 10 job ids instantly. Two worker processes split the jobs (visible in their logs), every document ends with status done and chunk rows in the database, and a deliberately broken file ends as dead after 5 attempts with its error recorded.",
    steps: [
      {
        title: "Schema",
        detail:
          "Create documents(id, filename, content text, status, created_at), chunks(document_id, chunk_index, text, PRIMARY KEY (document_id, chunk_index)) and the jobs table from the queues lesson. The composite primary key on chunks is what makes re-processing idempotent.",
      },
      {
        title: "Transactional enqueue",
        detail:
          "POST /documents accepts an UploadFile, and in ONE transaction inserts the document (status 'queued') and a job row pointing at it. Return 202 with document_id and job_id. GET /documents/{id} returns status and chunk count.",
      },
      {
        title: "Worker loop",
        detail:
          "Use the starter. Claim with the SKIP LOCKED query, process, then mark done. Processing splits content into roughly 500-character chunks on paragraph boundaries and upserts them with INSERT ... ON CONFLICT (document_id, chunk_index) DO UPDATE. Add time.sleep(2) to simulate the embedding calls you will add next month.",
      },
      {
        title: "Retries and dead letters",
        detail:
          "On exception: if attempts < 5, set status back to 'queued' with run_at = now() + 2^attempts seconds and store last_error; otherwise set status 'dead'. Mirror the final status onto the documents row. Make processing raise for any file containing the word POISON to test it.",
      },
      {
        title: "Run two workers and a reaper",
        detail:
          "Start two worker processes in separate terminals (or as two compose replicas). Upload 10 files and confirm from the logs that each job was processed by exactly one worker. Add the reaper query to run every 30 seconds in the worker loop; kill a worker with kill -9 mid-job and confirm the job is re-queued and finished by the other.",
      },
    ],
    hints: [
      "Use autocommit for the claim statement so the lock is released as soon as the status is 'running'; the status column, not the row lock, is what marks ownership while the job runs.",
      "Log the worker's PID with every claimed job id so duplicate processing is easy to spot.",
      "Idempotency test: manually set a done job back to queued and let it run again. The chunk count must not double.",
    ],
    stretch:
      "Replace the time.sleep with real batched embedding calls (batches of 64 chunks) through a semaphore with backoff on 429, storing vectors in a pgvector column. Or switch the whole thing to arq for an asyncio-native worker and compare the code.",
    learned: [
      "Using Postgres FOR UPDATE SKIP LOCKED as a reliable job queue",
      "Transactional enqueue so jobs and data never disagree",
      "Idempotent handlers via natural keys and upserts",
      "Leases, retries with backoff and dead-lettering for failed jobs",
    ],
    starter: {
      title: "worker.py",
      lang: "python",
      code: `import os
import time

import psycopg

DSN = os.environ.get("DATABASE_URL", "postgresql://cortex:cortex@localhost:5432/cortex")
CLAIM = """
UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_at = now()
WHERE id = (
  SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now()
  ORDER BY run_at LIMIT 1 FOR UPDATE SKIP LOCKED
)
RETURNING id, document_id, attempts
"""
MAX_ATTEMPTS = 5

def process(conn: psycopg.Connection, document_id: int) -> None:
    (content,) = conn.execute("SELECT content FROM documents WHERE id = %s", (document_id,)).fetchone()
    if "POISON" in content:
        raise ValueError("poison document")
    parts = [p.strip() for p in content.split("\\n\\n") if p.strip()]
    for i, text in enumerate(parts):
        conn.execute(
            "INSERT INTO chunks (document_id, chunk_index, text) VALUES (%s, %s, %s) "
            "ON CONFLICT (document_id, chunk_index) DO UPDATE SET text = EXCLUDED.text",
            (document_id, i, text),
        )

def main() -> None:
    with psycopg.connect(DSN, autocommit=True) as conn:
        print("worker", os.getpid(), "started")
        while True:
            row = conn.execute(CLAIM).fetchone()
            if row is None:
                time.sleep(1)
                continue
            job_id, document_id, attempts = row
            print("worker", os.getpid(), "claimed job", job_id)
            try:
                with conn.transaction():
                    process(conn, document_id)
                    conn.execute("UPDATE jobs SET status = 'done' WHERE id = %s", (job_id,))
            except Exception as exc:
                status = "dead" if attempts >= MAX_ATTEMPTS else "queued"
                conn.execute(
                    "UPDATE jobs SET status = %s, last_error = %s, "
                    "run_at = now() + make_interval(secs => %s) WHERE id = %s",
                    (status, repr(exc), float(2 ** attempts), job_id),
                )

if __name__ == "__main__":
    main()`,
      note: "The chunk writes and the 'done' update commit together in one transaction. Mirroring status onto the documents table and the reaper are left for you.",
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "flagship-v2-ai-api",
    title: "Cortex v0.2: the AI API",
    week: 8,
    duration: "weekend",
    minutes: 720,
    difficulty: "hard",
    domain: "backend",
    skills: ["llm-apis", "fastapi", "queues", "docker", "async-concurrency", "api-design"],
    prerequisites: [
      "Queues & background jobs",
      "Docker: shipping the environment",
      "Rate limiting & concurrency control",
      "FastAPI + Postgres + Redis with Docker Compose",
      "A background worker for document processing",
    ],
    topicSlugs: ["queues-background-jobs", "docker-essentials", "rate-limiting-concurrency"],
    objective:
      "Ship Cortex v0.2: a Dockerised FastAPI service with an /ask endpoint backed by a provider-agnostic LLM layer (Gemini, OpenAI or Anthropic chosen by environment variable), document upload processed by a background worker, per-key rate limiting, and resilient outbound calls.",
    expectedOutput:
      "docker compose up starts api, worker, db and redis, all healthy. POST /documents returns 202 and the document reaches status done. POST /ask returns an answer with the provider and model used, switching providers needs only a changed LLM_PROVIDER value and a restart, the 21st request in a minute from one key gets 429 with Retry-After, and a README documents it all with a curl walkthrough.",
    steps: [
      {
        title: "Provider abstraction",
        detail:
          "Create cortex/llm.py from the starter: an LLMProvider Protocol with async complete(system, prompt, max_tokens) and one adapter per provider. get_provider() reads LLM_PROVIDER and LLM_MODEL. Choose current model ids from each provider's docs and keep them in .env, never in code. Add a FakeProvider that returns a canned answer, for tests and for running without keys.",
      },
      {
        title: "Resilient calls",
        detail:
          "Wrap provider calls with a process-wide asyncio.Semaphore (LLM_MAX_CONCURRENCY, default 4), a timeout (asyncio.wait_for, 30 s) and retry with exponential backoff and full jitter on rate-limit, timeout and 5xx errors only. Normalise each SDK's rate-limit exception into your own ProviderRateLimited, so retry logic is written once.",
      },
      {
        title: "/ask endpoint",
        detail:
          "POST /ask with a Pydantic body {question: str, document_ids: list[int] | None}. For now, build context from the first chunks of the given documents (retrieval arrives next month) and instruct the model to answer only from that context and cite chunk ids like [doc 3, chunk 2]. Return {answer, provider, model, latency_ms}. Validate question length to protect your token budget.",
      },
      {
        title: "Document ingestion via the worker",
        detail:
          "Reuse the background-embedding-worker lab: POST /documents stores the file and enqueues a job in one transaction and returns 202; the worker chunks it idempotently; GET /documents/{id} shows the status. Run the worker as its own compose service from the same image with a different command.",
      },
      {
        title: "Rate limiting",
        detail:
          "Add the Redis token-bucket dependency to /ask (20 per minute per x-api-key) and a looser one to /documents. Return 429 with Retry-After. Emit a structured log line for every rejection.",
      },
      {
        title: "Compose, config and tests",
        detail:
          "compose.yaml with api, worker, db and redis, all with healthchecks and a .env file holding keys (in .gitignore and .dockerignore). Write pytest tests using FakeProvider: /ask returns an answer, the rate limiter returns 429 on the 21st call, and the provider switch picks the right adapter for each LLM_PROVIDER value.",
      },
      {
        title: "Document and demo",
        detail:
          "README: architecture diagram (API → Redis limiter → provider layer; API → jobs table → worker → Postgres), how to switch providers, the curl walkthrough, and known limitations. Record a 2-minute demo switching from Gemini to Anthropic without code changes.",
      },
    ],
    hints: [
      "Keep SDK imports inside each adapter's __init__ so the app does not need every SDK installed just to run one provider.",
      "Anthropic requires max_tokens and takes the system prompt as a top-level system parameter; OpenAI puts it in messages; Gemini's google-genai SDK uses config=GenerateContentConfig(system_instruction=...). The adapter hides these differences.",
      "Test the provider switch and rate limiter with FakeProvider and a real Redis from compose, so tests cost nothing.",
      "Log provider, model, latency and token usage for every call; you will need that data for evals and cost tracking in later months.",
    ],
    stretch:
      "Add streaming: an /ask/stream endpoint returning Server-Sent Events, with each adapter exposing an async generator. Add automatic fallback: if the primary provider returns repeated 5xx or 429 errors, retry once on a secondary provider and record that in the response.",
    learned: [
      "Designing a provider-agnostic LLM layer with the adapter pattern",
      "Composing API, worker, database and cache into one Dockerised system",
      "Protecting an AI endpoint with per-key rate limits and resilient outbound calls",
      "Testing LLM-backed code deterministically with a fake provider",
    ],
    starter: {
      title: "cortex/llm.py",
      lang: "python",
      code: `import os
from typing import Protocol

class LLMProvider(Protocol):
    name: str
    model: str
    async def complete(self, system: str, prompt: str, max_tokens: int = 512) -> str: ...

class OpenAIProvider:
    name = "openai"
    def __init__(self, model: str):
        from openai import AsyncOpenAI
        self.client, self.model = AsyncOpenAI(), model            # reads OPENAI_API_KEY
    async def complete(self, system: str, prompt: str, max_tokens: int = 512) -> str:
        r = await self.client.chat.completions.create(
            model=self.model, max_completion_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}])
        return r.choices[0].message.content or ""

class AnthropicProvider:
    name = "anthropic"
    def __init__(self, model: str):
        from anthropic import AsyncAnthropic
        self.client, self.model = AsyncAnthropic(), model         # reads ANTHROPIC_API_KEY
    async def complete(self, system: str, prompt: str, max_tokens: int = 512) -> str:
        r = await self.client.messages.create(
            model=self.model, max_tokens=max_tokens, system=system,
            messages=[{"role": "user", "content": prompt}])
        return "".join(block.text for block in r.content if block.type == "text")

class GeminiProvider:
    name = "gemini"
    def __init__(self, model: str):
        from google import genai
        self.client, self.model = genai.Client(), model           # reads GEMINI_API_KEY
    async def complete(self, system: str, prompt: str, max_tokens: int = 512) -> str:
        from google.genai import types
        r = await self.client.aio.models.generate_content(
            model=self.model, contents=prompt,
            config=types.GenerateContentConfig(system_instruction=system, max_output_tokens=max_tokens))
        return r.text or ""

class FakeProvider:
    name = "fake"
    def __init__(self, model: str = "fake-1"):
        self.model = model
    async def complete(self, system: str, prompt: str, max_tokens: int = 512) -> str:
        return "fake answer [doc 1, chunk 0]"

PROVIDERS = {"openai": OpenAIProvider, "anthropic": AnthropicProvider, "gemini": GeminiProvider, "fake": FakeProvider}

def get_provider() -> LLMProvider:
    name = os.environ.get("LLM_PROVIDER", "fake")
    return PROVIDERS[name](model=os.environ.get("LLM_MODEL", "fake-1"))`,
      note: "Set LLM_PROVIDER and LLM_MODEL in .env. Model ids change often, so look up the current ones in each provider's docs rather than hard-coding them.",
    },
  },
];
