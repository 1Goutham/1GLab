import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "ci-cd-github-actions",
    title: "CI/CD with GitHub Actions",
    week: 20,
    domain: "cloud",
    skills: ["ci-cd"],
    difficulty: "medium",
    minutes: 60,
    summary: "Workflows, jobs, runners, secrets and caching — and how to make tests plus evals a required check on every pull request.",
    tags: ["ci-cd", "github-actions", "devops", "quality-gate"],
    lesson: {
      hook: `Vercel already builds every push of your portfolio and gives you a preview URL. That is CD. What it does not do is refuse to merge when the tests fail, or when the prompt change you just made drops Cortex's groundedness by 10 points.

That is CI's job: every pull request gets a clean machine that installs, type-checks, tests and evaluates the code, and GitHub blocks the merge button until it passes.

GitHub Actions is the default place to do this. The YAML is short; the judgement is in what runs when, what secrets it can touch, and how fast it stays.`,
      whyItMatters: "Every team you join will have CI. Being able to write, speed up and secure a workflow — and wire evals into it — is table stakes for owning an AI service in production.",
      levels: {
        l1: "A workflow is a recipe GitHub runs on a fresh computer whenever something happens in your repo, like opening a pull request. The recipe installs your project, runs checks, and reports pass or fail. You can tell GitHub not to allow merging until it passes.",
        l2: {
          text: `The vocabulary maps cleanly:

- **Workflow**: a YAML file in \`.github/workflows/\`, triggered by events (\`pull_request\`, \`push\`, \`schedule\`, \`workflow_dispatch\`).
- **Job**: a set of steps on one fresh **runner** (a VM). Jobs run in parallel unless one \`needs\` another.
- **Step**: a shell command (\`run:\`) or a reusable **action** (\`uses: actions/checkout@v4\`).
- **Secrets**: encrypted values injected as environment variables.
- **Required status checks** (branch protection): which jobs must be green before merging.`,
          analogy: "Husky pre-commit hooks, except they run on GitHub's machines for everyone, cannot be skipped with --no-verify, and their result gates the merge button.",
          diagram: {
            type: "flow",
            title: "Cortex PR pipeline",
            lanes: [
              {
                tone: "good",
                steps: [
                  { label: "PR opened" },
                  { label: "test job", note: "typecheck, lint, unit tests" },
                  { label: "evals job", note: "needs: test · cached calls", accent: true },
                  { label: "gate.py", note: "exit 1 on regression" },
                  { label: "Required check", note: "merge unlocked" },
                  { label: "Vercel deploy on main" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `The workflow below runs two jobs on every PR. \`test\` is fast and needs no secrets. \`evals\` runs only after \`test\` passes, restores the response cache so unchanged prompts cost nothing, and fails the job when \`gate.py\` exits non-zero.

Details worth copying:

- \`permissions: contents: read\` — the default \`GITHUB_TOKEN\` gets the least access it needs.
- \`concurrency\` with \`cancel-in-progress\` — pushing a new commit cancels the stale run instead of queueing it.
- \`cache:\` in the setup actions — dependency caching cuts minutes off every run.
- The API key comes from \`secrets\`, never from the repo.`,
          code: [
            {
              title: ".github/workflows/ci.yml",
              lang: "yaml",
              code: `name: ci
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test

  evals:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r evals/requirements.txt
      - uses: actions/cache@v4
        with:
          path: .evalcache
          key: evalcache-\${{ hashFiles('evals/golden.jsonl', 'prompts/**') }}
          restore-keys: evalcache-
      - run: python evals/run_eval.py prompts/system.txt evals/results.json
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
      - run: python evals/gate.py`,
              note: "Then in GitHub: Settings -> Branches (or Rules) -> require the test and evals checks on main.",
            },
          ],
        },
        l4: {
          text: `**What a runner is.** Each job gets a fresh, ephemeral VM (\`ubuntu-latest\`), clones nothing until \`actions/checkout\` runs, and is destroyed afterwards. Nothing survives between jobs unless you pass it explicitly with \`actions/upload-artifact\` / \`download-artifact\` or a cache. That isolation is why CI catches "works on my machine" bugs.

**Security model.** Workflows triggered by \`pull_request\` from a *fork* get a read-only token and **no secrets** — otherwise anyone could open a PR that prints your API key. \`pull_request_target\` runs with secrets in the context of the base repo; checking out and running a fork's code under it is a well-known way to leak secrets. For deploying to a cloud, prefer **OIDC** (the workflow requests a short-lived cloud credential) over long-lived access keys stored as secrets. Third-party actions run with your token, so pin them to a full commit SHA for anything sensitive.

**Readable results.** A red X with a 400-line log is ignored. Write a Markdown table to \`$GITHUB_STEP_SUMMARY\` and it appears on the run's summary page.`,
          code: [
            {
              title: "evals/summary.py — eval results on the Actions summary page",
              lang: "python",
              code: `import json
import os
from pathlib import Path

current = json.loads(Path("evals/results.json").read_text())
baseline = json.loads(Path("evals/baseline.json").read_text())

lines = ["## Eval results", "", "| metric | baseline | this PR | delta |", "|---|---|---|---|"]
for metric, base in baseline["metrics"].items():
    now = current["metrics"].get(metric, 0.0)
    lines.append(f"| {metric} | {base:.3f} | {now:.3f} | {now - base:+.3f} |")

failing = [r["id"] for r in current["results"] if not r["pass"]]
lines += ["", f"Failing cases ({len(failing)}): " + (", ".join(failing) or "none")]

summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
text = "\\n".join(lines) + "\\n"
if summary_path:
    with open(summary_path, "a") as f:
        f.write(text)
else:
    print(text)`,
              note: "Run it as a step with if: always() so the table appears even when the gate fails.",
            },
          ],
        },
        l5: {
          question: "Your CI takes 18 minutes and the team is merging without waiting for it. How do you make it fast and trustworthy again?",
          hint: "Measure, cache, parallelise, split by trigger, cancel stale runs, and fix flakiness.",
          answer: `I would start by reading the timing of each job and step to see where the 18 minutes go rather than guessing. Typical wins are dependency caching through the setup actions, caching build outputs, and splitting one long job into parallel jobs — lint, typecheck, unit tests and evals — with needs only where there is a real dependency. I would add concurrency with cancel-in-progress so each push cancels the previous run, and path filters so docs-only changes skip heavy jobs. Expensive suites like the full LLM-judge evals move to a nightly schedule, leaving a fast cached smoke eval on PRs. Flaky tests get quarantined and fixed, because one flaky check teaches people that red means nothing. Finally I would make the fast checks required in branch protection, so waiting is enforced rather than optional, with a target of under five minutes for the PR path.`,
        },
      },
      commonMistakes: [
        "Leaving the workflow token with default write permissions instead of setting permissions: contents: read.",
        "Using pull_request_target and checking out the fork's code, which runs untrusted code with your secrets.",
        "Not marking CI jobs as required checks, so a red build can still be merged.",
        "Running the full expensive eval suite on every push without caching or cancelling superseded runs.",
      ],
      tryThis: "Add a workflow_dispatch trigger to any workflow and run it manually from the Actions tab. Then push twice quickly and watch concurrency cancel the first run.",
      miniTask: {
        title: "Ship a test workflow for one of your repos",
        kind: "build",
        minutes: 30,
        steps: [
          "Pick a repo with at least a typecheck or one test (ZtudyLock, IdeaGuard or Cortex).",
          "Add .github/workflows/ci.yml with a single test job: checkout, setup-node with npm cache, npm ci, typecheck, test.",
          "Add permissions and concurrency blocks as in the example.",
          "Open a PR that breaks a type on purpose, confirm the check fails, then fix it.",
          "Make the check required for main in branch protection or rulesets.",
        ],
        checklist: [
          "Workflow runs on pull_request and push to main",
          "Second run is faster thanks to the npm cache",
          "A deliberately broken PR shows a failing check",
          "Merge button is blocked while the check fails",
        ],
        deliverable: "A merged PR adding ci.yml and a screenshot of the blocked merge button on the broken PR.",
      },
      quiz: [
        {
          q: "Two jobs in the same workflow need to share a built file. What is the right mechanism?",
          options: [
            "Write it to /tmp; jobs share a disk",
            "Upload it as an artifact in one job and download it in the other",
            "Use an environment variable",
            "Put both jobs in the same step",
          ],
          answer: 1,
          explain: "Each job runs on a separate fresh runner. Artifacts (or caches) are the explicit way to pass files between them.",
        },
        {
          q: "Why do pull_request workflows from forks not receive repository secrets?",
          options: [
            "Forks are private",
            "Secrets are too large",
            "Otherwise anyone could open a PR with a workflow step that prints or exfiltrates them",
            "GitHub charges extra for secrets",
          ],
          answer: 2,
          explain: "The PR author controls the code that runs. Withholding secrets is what makes accepting outside PRs safe.",
        },
        {
          q: "What does concurrency with cancel-in-progress: true do?",
          options: [
            "Runs all jobs in parallel",
            "Cancels an in-progress run in the same group when a newer run starts",
            "Retries failing jobs",
            "Limits the number of runners per organisation",
          ],
          answer: 1,
          explain: "When you push a new commit, the run for the old commit is no longer useful, so it is cancelled.",
        },
      ],
      explainPrompt: "Explain workflows, jobs, runners and required status checks to a junior engineer in five sentences, including why fork PRs get no secrets.",
      implementPrompt: "From memory, write a GitHub Actions workflow with a test job and an evals job that needs it, uses a secret, caches dependencies, and cancels superseded runs.",
      videos: [
        {
          title: "GitHub Actions tutorial",
          channel: "TechWorld with Nana",
          url: "https://www.youtube.com/results?search_query=techworld+with+nana+github+actions+tutorial",
          kind: "search",
          reason: "Watch this for a full walkthrough of workflows, runners and secrets if the YAML still feels like magic.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "cloud-fundamentals",
    title: "Cloud fundamentals (AWS)",
    week: 20,
    domain: "cloud",
    skills: ["cloud"],
    difficulty: "medium",
    minutes: 80,
    summary: "Compute, storage, networking, IAM and managed databases on AWS — mapped to what Vercel has been doing for you all along.",
    tags: ["aws", "cloud", "iam", "vpc", "s3"],
    lesson: {
      hook: `On Vercel you \`git push\` and a URL appears. Behind that URL are servers, object storage, a CDN, DNS, TLS certificates, networking rules and credentials — all chosen for you.

That works until Cortex needs a GPU for an open model, a queue for ingesting 500-page PDFs, a database in a specific region for a client, or a compliance review asking "who can read the uploaded documents?"

At that point you need to know what the building blocks are. AWS has 200+ services, but about eight of them explain most of what a product engineer touches.`,
      whyItMatters: "AI infrastructure — GPUs, batch jobs, private data stores — lives in cloud accounts, not on Vercel. IAM and networking decisions are also where most real cloud breaches happen.",
      levels: {
        l1: "A cloud provider rents you computers (compute), hard drives (storage), private networks (networking), and a system for deciding who is allowed to do what (identity and access). Everything else is built from those four. Platforms like Vercel assemble them for you; on AWS you assemble them yourself.",
        l2: {
          text: `Map what you know onto the primitives:

- **Compute**: EC2 (virtual machines, including GPU instances), Lambda (functions — what Vercel Functions run on), ECS/Fargate (containers).
- **Storage**: S3 (object storage, like Vercel Blob), EBS (a disk attached to one VM).
- **Databases**: RDS/Aurora (managed Postgres), DynamoDB (key-value), ElastiCache (Redis).
- **Networking**: VPC (your private network), subnets, security groups (per-resource firewalls), load balancers, CloudFront (CDN), Route 53 (DNS).
- **Identity**: IAM users, roles and policies — who can do which action on which resource.`,
          analogy: "Vercel is a furnished flat; AWS is a plot of land with a hardware store next door. More freedom, and now the wiring is your job.",
          diagram: {
            type: "compare",
            title: "What Vercel abstracts vs what AWS exposes",
            left: {
              label: "Vercel (managed for you)",
              points: [
                "Functions -> runs on AWS Lambda-style infra",
                "Blob storage -> object storage like S3",
                "Edge network + TLS + DNS",
                "Env vars -> secrets",
                "Preview deployments per branch",
              ],
            },
            right: {
              label: "AWS (you decide)",
              points: [
                "EC2 / ECS / Lambda, including GPU instances",
                "S3 buckets, lifecycle rules, encryption",
                "VPC, subnets, security groups, NAT",
                "IAM roles and least-privilege policies",
                "RDS Postgres, backups, region choice",
              ],
            },
          },
        },
        l3: {
          text: `**IAM** is the part to learn properly first. A policy is JSON listing Effect, Action and Resource. Evaluation is simple and strict: everything is **denied by default**, an explicit Allow grants access, and an explicit Deny always wins. Workloads should use **roles** (temporary credentials issued automatically) rather than long-lived access keys pasted into env vars.

A common AI-app pattern is **presigned URLs**: instead of streaming a 200 MB PDF through your API, the server signs a short-lived URL that lets the browser upload directly to S3 — only that key, only for five minutes.`,
          code: [
            {
              title: "Least-privilege policy: the Cortex API can read/write only user uploads",
              lang: "json",
              code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CortexUploadsOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::cortex-uploads/users/*"
    }
  ]
}`,
              note: "No s3:* and no Resource: \"*\". Listing, deleting and other buckets are denied by default.",
            },
            {
              title: "Presigned upload URL with boto3",
              lang: "python",
              code: `# pip install boto3 ; needs AWS credentials (a role or aws configure)
import uuid
import boto3

s3 = boto3.client("s3", region_name="ap-south-1")

def upload_url(user_id: str, filename: str) -> dict:
    key = f"users/{user_id}/{uuid.uuid4()}-{filename}"
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": "cortex-uploads", "Key": key, "ContentType": "application/pdf"},
        ExpiresIn=300,
    )
    return {"key": key, "url": url}

print(upload_url("u_123", "report.pdf"))
# browser or curl then does:
# curl -X PUT -H "Content-Type: application/pdf" --upload-file report.pdf "<url>"`,
              note: "The server decides the key (scoped to the user), so a client cannot overwrite someone else's file.",
            },
          ],
        },
        l4: {
          text: `**A request's path through a typical AWS setup:** DNS (Route 53) resolves your domain to CloudFront; CloudFront forwards to an Application Load Balancer in **public subnets**; the ALB forwards to containers in **private subnets** (no public IPs); they talk to RDS in private subnets. Outbound internet access from private subnets (to call the OpenAI API) goes through a **NAT gateway** — which is also a classic surprise line on the bill.

**Security groups** are stateful firewalls attached to resources: allow inbound 5432 on the database only from the app's security group, not from an IP range. **Network ACLs** are stateless, subnet-level, and rarely needed.

**Instance metadata and SSRF.** An EC2 instance's role credentials are served at 169.254.169.254. IMDSv1 answered any GET — which is why SSRF bugs leaked credentials. IMDSv2 requires first obtaining a session token with a PUT request and a custom header, which a typical SSRF cannot do. Require IMDSv2 on every instance.`,
          code: [
            {
              title: "IMDSv2: why a simple SSRF GET no longer gets credentials",
              lang: "bash",
              code: `# Run on an EC2 instance. Step 1 needs a PUT with a special header.
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \\
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")

# Step 2: every metadata read must carry the token.
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \\
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Which identity am I using right now? (works anywhere the CLI is configured)
aws sts get-caller-identity`,
            },
          ],
          diagram: {
            type: "stack",
            title: "Cortex on AWS, outside in",
            layers: [
              { label: "Route 53 + CloudFront", note: "DNS, CDN, TLS" },
              { label: "ALB in public subnets", note: "only 443 open to the internet" },
              { label: "ECS tasks in private subnets", note: "API + ingestion workers, IAM task role", accent: true },
              { label: "RDS Postgres + pgvector, S3", note: "private; SG allows app only" },
              { label: "NAT gateway", note: "egress to LLM APIs" },
            ],
          },
        },
        l5: {
          question: "A client wants Cortex deployed in their own AWS account because their documents cannot leave it. Sketch the architecture and the IAM and network decisions you would make.",
          hint: "Where does each component run, what can talk to what, and which identity does each workload use?",
          answer: `I would put everything in one region the client chooses, inside a VPC with public subnets only for the load balancer and private subnets for the API, ingestion workers and database. Uploads go to an S3 bucket with public access blocked, encryption with a KMS key the client controls, and browser uploads via short-lived presigned URLs scoped to per-user prefixes. The API and workers run on ECS Fargate with separate IAM task roles: the API can put and get user objects and read the database secret; the ingestion worker can read uploads and write embeddings; neither can delete buckets or touch other resources. Postgres with pgvector runs on RDS in private subnets, with a security group allowing only the app's security group on 5432, automated backups and encryption at rest. If documents cannot leave the account at all, the LLM must too — either a model endpoint available in-region such as Bedrock, or a self-hosted open model on GPU instances — and egress through the NAT gateway is restricted to what is needed. CloudTrail logs every API call so the client can audit who accessed what.`,
        },
      },
      commonMistakes: [
        "Creating an IAM user with AdministratorAccess and pasting its long-lived keys into .env files and CI.",
        "Putting the database in a public subnet with a security group open to 0.0.0.0/0 \"just for testing\".",
        "Forgetting NAT gateway and data-transfer costs, then being surprised by the bill.",
        "Leaving an S3 bucket public to make uploads work instead of using presigned URLs.",
      ],
      tryThis: "If you have an AWS account, run aws sts get-caller-identity and look up the policies attached to that identity in the IAM console. Could this identity delete every bucket in the account?",
      miniTask: {
        title: "Design Cortex's AWS footprint on paper",
        kind: "explain",
        minutes: 35,
        steps: [
          "List every component Cortex has today (Next.js app, API, vector store, file storage, LLM calls) and its Vercel/managed equivalent.",
          "Map each to an AWS service and a subnet (public or private).",
          "Write the IAM policy for the ingestion worker: exactly which actions on which resources.",
          "Write the security group rules for the database.",
          "Estimate one surprise cost (NAT gateway, data transfer or idle GPU) and how you would avoid it.",
        ],
        checklist: [
          "Every component mapped to one AWS service and a subnet",
          "IAM policy uses specific actions and resource ARNs, no wildcards on both",
          "Database is reachable only from the app's security group",
          "At least one cost trap identified",
        ],
        deliverable: "docs/aws-architecture.md with the mapping table, policy JSON and SG rules.",
      },
      quiz: [
        {
          q: "An IAM policy allows s3:GetObject on a bucket, and another attached policy explicitly denies it. What happens?",
          options: ["Access is allowed", "Access is denied; explicit Deny always wins", "The newer policy wins", "It depends on the region"],
          answer: 1,
          explain: "IAM evaluation: default deny, explicit allow grants, explicit deny overrides any allow.",
        },
        {
          q: "Why use presigned URLs for PDF uploads in Cortex?",
          options: [
            "They make files public",
            "The browser uploads directly to S3 for one server-chosen key and a short time, without routing large files through your API",
            "They compress PDFs",
            "They bypass IAM",
          ],
          answer: 1,
          explain: "The server signs a narrow, expiring permission; the heavy transfer skips your API and serverless body limits.",
        },
        {
          q: "Containers in a private subnet need to call the OpenAI API. What provides that outbound access?",
          options: ["An internet gateway attached to the private subnet", "A NAT gateway", "A security group rule alone", "CloudFront"],
          answer: 1,
          explain: "Private subnets have no route to an internet gateway; a NAT gateway in a public subnet provides outbound-only access.",
        },
      ],
      explainPrompt: "Explain VPCs, subnets, security groups and IAM roles to a junior engineer who only knows Vercel, in five sentences.",
      implementPrompt: "From memory, write a least-privilege IAM policy for reading and writing one S3 prefix, and a boto3 function that returns a presigned PUT URL for a user-scoped key.",
      videos: [
        {
          title: "AWS VPC and networking explained",
          channel: "TechWorld with Nana",
          url: "https://www.youtube.com/results?search_query=techworld+with+nana+aws+vpc+explained",
          kind: "search",
          reason: "Watch this if public vs private subnets, NAT and security groups are still blurry.",
        },
        {
          title: "AWS in 100 seconds / top services explained",
          channel: "Fireship",
          url: "https://www.youtube.com/results?search_query=fireship+aws+services+explained",
          kind: "search",
          reason: "Watch this for a quick map of which AWS services matter before going deeper.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "model-serving-gpus",
    title: "Serving models: GPUs, vLLM & quantisation",
    week: 20,
    domain: "cloud",
    skills: ["ai-infra", "kubernetes"],
    difficulty: "hard",
    minutes: 90,
    summary: "GPU memory maths, continuous batching, PagedAttention and quantisation — enough to decide when to self-host and how to size it.",
    tags: ["gpu", "vllm", "quantisation", "serving", "kv-cache"],
    lesson: {
      hook: `An open 8B model is good enough for Cortex's query rewriting and routing. Could you run it yourself instead of paying per token?

You rent a 24 GB GPU and load the model with a naive Python loop. It answers one user at a time at 40 tokens/sec, and the moment three people use it at once, requests queue and latency explodes. The GPU sits mostly idle, waiting on memory.

Serving LLMs efficiently is a memory-management problem. Engines like **vLLM** exist because the tricks — continuous batching, paged KV cache, quantisation — turn that same GPU from one user at a time into dozens.`,
      whyItMatters: "Self-hosting decisions come up the moment privacy, cost at volume, or a fine-tuned model enters the picture. Being able to do the memory maths and explain batching is what AI-infra interviews test.",
      levels: {
        l1: "A GPU has a fixed amount of fast memory. It must hold the model's weights plus a scratchpad for every conversation in progress (the KV cache). Serving well means packing as many conversations into that memory as possible and processing them together, and shrinking the weights with quantisation when you need more room.",
        l2: {
          text: `Three ideas do most of the work:

- **Batching**: one forward pass over the weights can serve many sequences at once. Since decode is limited by reading weights from memory, batching 32 sequences costs little more than serving 1.
- **Continuous batching**: instead of waiting for the whole batch to finish (static batching), the scheduler adds new requests and removes finished ones *every decoding step*, so short answers never wait for long ones.
- **PagedAttention**: the KV cache is stored in small fixed-size blocks allocated on demand, like OS virtual memory pages, instead of one big pre-reserved slab per request. Almost no memory is wasted, so more sequences fit.`,
          analogy: "Static batching is a tour bus that leaves only when full and returns only when the last passenger is done. Continuous batching is a metro: people board and leave at every stop.",
          diagram: {
            type: "flow",
            title: "Static vs continuous batching",
            lanes: [
              {
                label: "Static",
                tone: "bad",
                steps: [
                  { label: "Batch of 4 starts" },
                  { label: "3 finish early", note: "slots sit idle" },
                  { label: "Wait for longest" },
                  { label: "New requests queued", note: "high TTFT" },
                ],
              },
              {
                label: "Continuous",
                tone: "good",
                steps: [
                  { label: "Step t: 4 running" },
                  { label: "1 finishes", note: "slot freed" },
                  { label: "Step t+1: new request joins", accent: true },
                  { label: "GPU always full", note: "higher throughput, lower TTFT" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `**Memory maths** decides everything. Weights: parameters x bytes per parameter — an 8B model is ~16 GB in fp16/bf16, ~8 GB in 8-bit, ~4–5 GB in 4-bit. KV cache per token: \`2 (K and V) x layers x kv_heads x head_dim x bytes\`. For Llama 3 8B (32 layers, 8 KV heads via grouped-query attention, head dim 128, fp16) that is 128 KiB per token — about 1 GB for one 8k-token conversation.

**vLLM** gives you continuous batching, PagedAttention and an **OpenAI-compatible server** in one command, so your existing client code works by changing \`base_url\`. It also loads pre-quantised checkpoints (AWQ, GPTQ, FP8) automatically.

**Quantisation trade-offs**: 8-bit weights are close to lossless for most tasks; 4-bit roughly quarters memory and speeds up memory-bound decode, with a quality drop that is larger for small models and for maths/code. Always re-run your evals on the quantised model — never assume.`,
          code: [
            {
              title: "Serve an open model with vLLM (on a machine with an NVIDIA GPU)",
              lang: "bash",
              code: `pip install vllm

# OpenAI-compatible server on :8000
vllm serve Qwen/Qwen2.5-7B-Instruct \\
  --max-model-len 8192 \\
  --gpu-memory-utilization 0.90

# 4-bit AWQ checkpoint of the same model: roughly a third of the weight memory
# vllm serve Qwen/Qwen2.5-7B-Instruct-AWQ --max-model-len 8192

curl http://localhost:8000/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct", "messages": [{"role": "user", "content": "Rewrite as a search query: what did the Q3 report say about churn?"}]}'`,
            },
            {
              title: "Your existing OpenAI client, pointed at your own GPU",
              lang: "python",
              code: `from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="not-needed")
resp = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Give 3 search queries for: churn in Q3 report"}],
    temperature=0,
)
print(resp.choices[0].message.content)
print(resp.usage)`,
            },
          ],
        },
        l4: {
          text: `**Why the KV cache dominates.** Weights are fixed; KV cache grows with (concurrent sequences x tokens each). On a 24 GB GPU running an 8B model in fp16, weights take 16 GB, leaving roughly 6 GB of KV cache after overheads — about 5–6 concurrent 8k-token conversations. Quantise the weights to 4-bit and you free ~11 GB more, which becomes 10+ extra conversations. That is why quantisation raises *throughput*, not just "fits on the card".

**PagedAttention.** Pre-allocating the maximum context for every request wastes most of the memory, because most requests are short. vLLM splits the KV cache into blocks (16 tokens by default) and keeps a **block table** per sequence mapping logical positions to physical blocks — exactly like a page table. Blocks are allocated as a sequence grows and freed when it ends; sequences sharing a prompt prefix can share blocks (the basis of prefix caching). When blocks run out, the scheduler preempts a sequence rather than crashing.

**When to self-host.** Hosted APIs win on spiky traffic, frontier-model quality and zero ops. Self-hosting wins with steady high volume on a small or fine-tuned model, strict data residency, or latency you must control. Do the arithmetic: a GPU costs money every hour whether busy or idle, so utilisation decides the per-token price. At scale this runs on Kubernetes with GPU node pools, autoscaling on queue depth, and model weights cached on local disk to cut cold starts.`,
          code: [
            {
              title: "KV-cache sizing and a toy paged block allocator",
              lang: "python",
              code: `def kv_bytes_per_token(layers: int, kv_heads: int, head_dim: int, dtype_bytes: int = 2) -> int:
    return 2 * layers * kv_heads * head_dim * dtype_bytes   # K and V

per_tok = kv_bytes_per_token(layers=32, kv_heads=8, head_dim=128)   # Llama 3 8B, fp16
print(per_tok // 1024, "KiB/token;", round(per_tok * 8192 / 2**30, 2), "GiB per 8k sequence")

class BlockManager:
    def __init__(self, num_blocks: int, block_size: int = 16):
        self.block_size = block_size
        self.free = list(range(num_blocks))
        self.tables: dict[str, list[int]] = {}   # seq -> physical block ids
        self.lengths: dict[str, int] = {}

    def append_token(self, seq: str) -> None:
        n = self.lengths.get(seq, 0)
        if n % self.block_size == 0:              # current block full (or first token)
            if not self.free:
                raise MemoryError("no free blocks: preempt a sequence")
            self.tables.setdefault(seq, []).append(self.free.pop())
        self.lengths[seq] = n + 1

    def release(self, seq: str) -> None:
        self.free.extend(self.tables.pop(seq))
        self.lengths.pop(seq)

bm = BlockManager(num_blocks=4)
for _ in range(20):
    bm.append_token("a")      # 20 tokens -> 2 blocks
for _ in range(5):
    bm.append_token("b")      # 5 tokens -> 1 block
print(bm.tables, "free:", bm.free)
bm.release("a")
print("after release, free:", bm.free)`,
              note: "Memory is committed 16 tokens at a time, never max_model_len up front — that is the whole trick.",
            },
          ],
        },
        l5: {
          question: "Cortex makes 3 million small LLM calls a month for query rewriting. Should you move them from a hosted API to a self-hosted 7B model? How do you decide?",
          hint: "Quality on evals, traffic shape, GPU utilisation and cost per token, ops burden.",
          answer: `I would first check quality: run the query-rewriting eval set against a candidate open model, both full precision and quantised, and only continue if it matches the hosted model within tolerance. Then cost: 3 million calls of a few hundred tokens each is under a billion tokens a month, which on a cheap hosted model is a modest bill, so I would compare that with the monthly cost of at least one GPU instance running 24/7 plus a second for redundancy. Traffic shape matters — if load is spiky or low at night, the GPU sits idle and the effective per-token cost rises, whereas a hosted API only charges for use. I would also count the ops burden: vLLM upgrades, monitoring, autoscaling, cold starts and on-call. Self-hosting becomes attractive when volume is high and steady, when data residency requires it, when I need a fine-tuned model, or when latency control matters. At this volume I would probably stay hosted with a small model, and revisit if volume grows by an order of magnitude or a data-residency requirement appears.`,
        },
      },
      commonMistakes: [
        "Sizing a GPU by weights alone and forgetting the KV cache, then hitting out-of-memory at modest concurrency.",
        "Serving with a naive generate() loop one request at a time instead of an engine with continuous batching.",
        "Assuming a 4-bit model is \"basically the same\" without re-running evals.",
        "Comparing self-hosting to API cost using 100% GPU utilisation when real traffic is spiky.",
      ],
      tryThis: "Using the kv_bytes_per_token function, compare Llama 2 7B (32 layers, 32 KV heads) with Llama 3 8B (32 layers, 8 KV heads). Grouped-query attention cuts the KV cache by 4x — that is why modern models use it.",
      miniTask: {
        title: "Size a GPU for Cortex's router model",
        kind: "code",
        minutes: 35,
        steps: [
          "Pick an open model you might use (look up layers, KV heads and head dim in its config.json on Hugging Face).",
          "Compute weight memory in fp16, 8-bit and 4-bit.",
          "Compute KV cache per token and per 4k-token sequence.",
          "For a 24 GB and an 80 GB GPU, compute how many concurrent 4k sequences fit at each precision (leave ~10% overhead).",
          "Write a one-paragraph recommendation: which GPU and precision, and what you would verify with evals.",
        ],
        checklist: [
          "Config values taken from the real config.json",
          "Weight and KV numbers for three precisions",
          "Concurrency estimates for two GPU sizes",
          "Recommendation mentions re-running evals on the quantised model",
        ],
        deliverable: "gpu_sizing.py printing the table, plus the recommendation paragraph.",
      },
      quiz: [
        {
          q: "What does continuous batching change compared with static batching?",
          options: [
            "It uses larger batches",
            "Requests join and leave the batch at every decode step instead of waiting for the whole batch to finish",
            "It runs each request on its own GPU",
            "It removes the need for a KV cache",
          ],
          answer: 1,
          explain: "Iteration-level scheduling keeps the GPU full and stops short requests waiting on long ones.",
        },
        {
          q: "Why does PagedAttention allow more concurrent sequences?",
          options: [
            "It compresses the weights",
            "It stores the KV cache in small blocks allocated on demand, avoiding pre-reserving max length per request",
            "It skips attention for old tokens",
            "It moves the KV cache to CPU",
          ],
          answer: 1,
          explain: "Reserving max_model_len per request wastes most memory. Blocks allocated as needed waste at most part of one block per sequence.",
        },
        {
          q: "An 8B model's weights in fp16 take roughly how much GPU memory?",
          options: ["About 4 GB", "About 8 GB", "About 16 GB", "About 32 GB"],
          answer: 2,
          explain: "8 billion parameters x 2 bytes = 16 GB, before any KV cache or activations.",
        },
      ],
      explainPrompt: "Explain to a junior engineer why LLM serving is a memory problem, covering weights, KV cache, continuous batching and quantisation, in five sentences.",
      implementPrompt: "From memory, write kv_bytes_per_token(layers, kv_heads, head_dim, dtype_bytes) and a BlockManager that allocates KV blocks on demand and frees them when a sequence ends.",
      videos: [
        {
          title: "vLLM and PagedAttention explained",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=vllm+pagedattention+explained",
          kind: "search",
          reason: "Watch this for diagrams of the block table and how continuous batching schedules requests step by step.",
        },
        {
          title: "Quantization explained",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+quantization+explained",
          kind: "search",
          reason: "Watch this if int8/int4 quantisation and its effect on accuracy still feels like a black box.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "fine-tuning-lora",
    title: "Fine-tuning vs RAG: LoRA in practice",
    week: 20,
    domain: "ai",
    skills: ["fine-tuning"],
    difficulty: "hard",
    minutes: 85,
    summary: "Fine-tuning teaches behaviour, RAG supplies knowledge. How LoRA makes fine-tuning cheap, and how to decide when it is worth it.",
    tags: ["fine-tuning", "lora", "peft", "rag"],
    lesson: {
      hook: `"Let's fine-tune the model on our documents so it knows them." It is one of the most common proposals in AI teams, and usually the wrong one.

Fine-tuning on documents teaches the model to *sound like* the documents, not reliably to recall facts from them — and the moment a document changes, the model is stale. RAG already solves knowledge: fresh, citable, per-user.

But fine-tuning does solve real problems: a consistent output format, a specialised style, reliable tool-call syntax, or getting a small cheap model to do what only a large one could. And thanks to **LoRA**, doing it no longer requires a cluster.`,
      whyItMatters: "\"Should we fine-tune or use RAG?\" is a standard AI-engineering interview question, and LoRA is how practically all open-model customisation is done today.",
      levels: {
        l1: "RAG hands the model the right pages at question time, like an open-book exam. Fine-tuning changes the model itself through extra training, like practising a skill until it is habit. Use RAG for facts that change; use fine-tuning for behaviour you want every time. LoRA is a trick that fine-tunes by training a tiny add-on instead of the whole model.",
        l2: {
          text: `Decision rule of thumb, in order: **prompting** first (cheapest, fastest to iterate), then **RAG** for knowledge, then **fine-tuning** for behaviour that prompting cannot make reliable — and often both together.

**LoRA** (Low-Rank Adaptation) freezes the original weights W and learns a small update written as the product of two thin matrices, B x A, where the rank r is tiny (8–64). You train well under 1% of the parameters, the adapter file is megabytes rather than gigabytes, and you can swap adapters per task on one base model.`,
          analogy: "RAG is giving a new hire the company wiki. Fine-tuning is their first month of on-the-job training. LoRA is training them with a set of sticky notes on top of what they already know, rather than re-educating them from scratch.",
          diagram: {
            type: "compare",
            title: "RAG vs fine-tuning",
            left: {
              label: "RAG: knowledge",
              points: [
                "Facts that change daily",
                "Per-user private documents",
                "Citations and auditability",
                "Update = re-index, minutes",
              ],
            },
            right: {
              label: "Fine-tuning: behaviour",
              points: [
                "Output format, tone, domain style",
                "Reliable tool-call / JSON syntax",
                "Distil a big model's skill into a small one",
                "Update = retrain + re-evaluate, hours",
              ],
            },
          },
        },
        l3: {
          text: `A practical LoRA run with Hugging Face **PEFT** has three parts: data, configuration, and training.

**Data** matters most: a few hundred to a few thousand high-quality examples in chat format (\`{"messages": [...]}\` per line) that show exactly the behaviour you want. Hold out 10% for evaluation.

**Configuration**: \`r\` (rank) controls capacity, \`lora_alpha\` scales the update (a common choice is alpha = 2r), and \`target_modules\` picks which linear layers get adapters — attention projections at minimum, all linear layers for more capacity. **QLoRA** loads the frozen base model in 4-bit to fit bigger models on one GPU, while training the adapter in higher precision.

**Training** with TRL's \`SFTTrainer\` or a plain training loop; then evaluate the adapter against the base model on your held-out set and your existing golden set.`,
          code: [
            {
              title: "train.jsonl — teach Cortex's summariser a fixed output format",
              lang: "json",
              code: `{"messages": [{"role": "system", "content": "Summarise the passage as JSON with keys claim, evidence, doc_id."}, {"role": "user", "content": "[doc-4] Churn fell from 6% to 4% after the onboarding redesign in Q3."}, {"role": "assistant", "content": "{\\"claim\\": \\"Churn fell after the onboarding redesign\\", \\"evidence\\": \\"6% to 4% in Q3\\", \\"doc_id\\": \\"doc-4\\"}"}]}`,
            },
            {
              title: "Attach LoRA adapters with PEFT",
              lang: "python",
              code: `# pip install torch transformers peft
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")

config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, config)
model.print_trainable_parameters()
# prints trainable params, all params and trainable% - well under 1%

# after training: model.save_pretrained("cortex-summariser-lora")
# saves only the adapter weights (a few MB), not the base model`,
              note: "A 0.5B model trains on a free Colab GPU in minutes, which makes it a good first experiment before scaling up.",
            },
          ],
        },
        l4: {
          text: `**The maths.** A linear layer computes \`y = W x\` with W of shape (d_out, d_in). Full fine-tuning learns a dense update ΔW of the same shape. LoRA constrains it to \`ΔW = B A\` with A of shape (r, d_in) and B of shape (d_out, r). For a 4096 x 4096 projection that is 16.8M parameters for full fine-tuning versus 2 x 4096 x 8 = 65,536 at r = 8 — about 0.4%.

The forward pass becomes \`y = W x + (alpha / r) * B (A x)\`. **B is initialised to zero**, so at step 0 the adapted model is exactly the base model and training starts from known-good behaviour. After training you can **merge** \`W' = W + (alpha/r) B A\` into the weights for zero inference overhead, or keep adapters separate and hot-swap them — vLLM can serve many LoRA adapters on one base model.

Why does a low-rank update work at all? Empirically, the weight changes needed to adapt a pretrained model to a narrow task have low "intrinsic rank": the model already has the capabilities, and fine-tuning mostly re-weights them. This is also why fine-tuning is weak at injecting lots of new facts — a small update to a few projections is not a database.`,
          code: [
            {
              title: "LoRA from scratch in PyTorch",
              lang: "python",
              code: `import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: int = 16):
        super().__init__()
        self.base = base
        for p in self.base.parameters():
            p.requires_grad = False                      # freeze W and bias
        self.A = nn.Parameter(torch.randn(r, base.in_features) * 0.01)
        self.B = nn.Parameter(torch.zeros(base.out_features, r))  # zero: starts as base
        self.scale = alpha / r

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.base(x) + (x @ self.A.T @ self.B.T) * self.scale

base = nn.Linear(4096, 4096)
layer = LoRALinear(base, r=8)
x = torch.randn(2, 4096)
print(torch.allclose(layer(x), base(x)))                # True at initialisation

trainable = sum(p.numel() for p in layer.parameters() if p.requires_grad)
total = sum(p.numel() for p in layer.parameters())
print(trainable, total, f"{trainable / total:.2%}")     # 65536 16846848 0.39%`,
            },
          ],
        },
        l5: {
          question: "The PM wants to fine-tune a model on all of Cortex's users' documents so it \"knows everything\". What do you recommend, and when would you fine-tune?",
          hint: "Freshness, per-user privacy, citations, what fine-tuning is good at, and how you would prove it helps.",
          answer: `I would recommend against fine-tuning for knowledge here. Users' documents change constantly, and a fine-tuned model is frozen at training time; it cannot cite sources, it recalls facts unreliably and may blend them into confident hallucinations, and training on everyone's documents would mix private data across users in one set of weights, which is a serious privacy problem. RAG already gives fresh, per-user, citable knowledge, so improving retrieval is the right lever for "knows everything". I would fine-tune for behaviour: for example, a LoRA adapter that makes a small, cheap model reliably produce our citation-JSON format, or one that distils the large model's query-rewriting skill so we can route that step to a 1–8B model and cut cost and latency. The process would be a few thousand curated examples with a held-out split, a LoRA or QLoRA run, and evaluation of base versus adapter on both the held-out set and the existing golden set before any rollout, plus a plan to retrain when the base model changes.`,
        },
      },
      commonMistakes: [
        "Fine-tuning to teach facts that change, instead of fixing retrieval.",
        "Training on a few thousand noisy, inconsistent examples — the model faithfully learns the noise.",
        "Not holding out an eval split, so improvement is measured on the training data.",
        "Forgetting that a fine-tuned adapter is tied to its base model version; upgrading the base means retraining.",
      ],
      tryThis: "Change r from 8 to 64 in the LoRALinear example and print the trainable percentage again. Then compute what full fine-tuning of a 7B model's optimiser state would need (weights + gradients + two Adam moments, fp32) and compare.",
      miniTask: {
        title: "Decide: prompt, RAG or fine-tune?",
        kind: "explain",
        minutes: 30,
        steps: [
          "Write down 5 real problems from your projects (e.g. IdeaGuard output format drift, Cortex citing wrong docs, ZtudyLock tone, slow query rewriting, stale answers).",
          "For each, choose prompting, RAG, fine-tuning or a combination, with a one-sentence reason.",
          "For the one best suited to fine-tuning, sketch 3 training examples in chat JSONL format.",
          "Run the LoRALinear snippet (CPU is fine) and confirm the output equals the base layer at initialisation.",
        ],
        checklist: [
          "5 problems, each with a decision and reason",
          "At least one problem correctly assigned to RAG rather than fine-tuning",
          "3 valid JSONL training examples",
          "LoRALinear run prints True and the trainable percentage",
        ],
        deliverable: "A short decisions table plus train_sample.jsonl.",
      },
      quiz: [
        {
          q: "Cortex's answers go stale whenever a user updates a document. Which approach fixes this?",
          options: ["Fine-tune weekly", "RAG with re-indexing on document change", "Increase LoRA rank", "Lower temperature"],
          answer: 1,
          explain: "Knowledge that changes belongs in retrieval; re-indexing takes minutes and needs no training.",
        },
        {
          q: "Why is the LoRA matrix B initialised to zeros?",
          options: [
            "To save memory",
            "So the adapted model starts exactly equal to the base model",
            "Because A is also zero",
            "To make the adapter sparse",
          ],
          answer: 1,
          explain: "With B = 0, BA = 0, so the first forward pass matches the base model and training starts from known-good behaviour.",
        },
        {
          q: "For a 4096 x 4096 linear layer with LoRA rank 8, how many trainable parameters does the adapter add?",
          options: ["4,096", "32,768", "65,536", "16,777,216"],
          answer: 2,
          explain: "A is 8 x 4096 and B is 4096 x 8: 2 x 4096 x 8 = 65,536, about 0.4% of the 16.8M in the full matrix.",
        },
      ],
      explainPrompt: "Explain to a junior engineer when to use RAG versus fine-tuning, and how LoRA makes fine-tuning cheap, in five sentences.",
      implementPrompt: "From memory, implement a LoRALinear PyTorch module that freezes the base layer, adds zero-initialised B and random A, scales by alpha/r, and prints its trainable parameter count.",
      videos: [
        {
          title: "LoRA: Low-Rank Adaptation explained",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+lora+low+rank+adaptation",
          kind: "search",
          reason: "Watch this for the maths of low-rank updates and a code walkthrough if the B x A decomposition is not clicking.",
        },
        {
          title: "Let's build GPT: from scratch, in code, spelled out",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
          kind: "video",
          minutes: 116,
          reason: "Watch the section on the linear projections inside attention if you want to see exactly which weight matrices LoRA is attaching to.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "github-actions-eval-gate",
    title: "GitHub Actions Eval Gate",
    week: 20,
    duration: "45m",
    minutes: 45,
    difficulty: "medium",
    domain: "cloud",
    skills: ["ci-cd", "ai-evaluation"],
    prerequisites: ["CI/CD with GitHub Actions", "Regression evals in CI", "First AI Evaluation Pipeline"],
    topicSlugs: ["ci-cd-github-actions", "evals-in-ci"],
    objective: "Add a GitHub Actions workflow to Cortex that runs tests and the eval suite on every pull request and fails the PR if the eval score drops below the baseline tolerance.",
    expectedOutput: "A .github/workflows/ci.yml with test and evals jobs, a required status check on main, one PR that fails the gate with a readable summary table, and one that passes.",
    steps: [
      {
        title: "Prepare the eval scripts for CI",
        detail: "Make sure run_eval.py writes evals/results.json with a metrics object and a results list where each item has id, tags and a boolean pass field (for example: pass = all applicable scorers true). Commit evals/baseline.json generated from main. Add evals/requirements.txt.",
      },
      {
        title: "Add the secret",
        detail: "In the repo settings add OPENAI_API_KEY (or your provider's key) under Secrets and variables -> Actions. Never echo it in a step.",
      },
      {
        title: "Write the workflow",
        detail: "Create .github/workflows/ci.yml with the test job and the evals job (needs: test) from the CI/CD topic: permissions contents read, concurrency cancel-in-progress, pip cache, actions/cache for .evalcache keyed on golden.jsonl and prompts.",
      },
      {
        title: "Gate and summarise",
        detail: "Add steps: python evals/gate.py (fails the job on regression) and python evals/summary.py with if: always() so the metrics table lands in the run summary even on failure.",
      },
      {
        title: "Prove it fails, then passes",
        detail: "Open a PR that removes the citation instruction from the system prompt. Confirm the evals job fails and the summary shows the dropped metric. Revert in the same PR and confirm it goes green.",
      },
      {
        title: "Make it required",
        detail: "In branch protection (or rulesets) for main, require the test and evals checks. Confirm the merge button is disabled while the gate is red.",
      },
    ],
    hints: [
      "If the cache never hits, print the cache key; hashFiles returns an empty string when the path pattern matches nothing.",
      "Keep the PR eval set small (25–50 cases) so the job finishes in a few minutes; move the big suite to a schedule: cron workflow.",
      "Use workflow_dispatch while debugging so you can re-run without pushing commits.",
    ],
    stretch: "Add a nightly workflow on schedule that runs the full suite with the LLM judge and opens a GitHub issue automatically if any metric drops more than 5 points from the previous night.",
    learned: [
      "Wiring an eval gate into a real CI pipeline with secrets and caching",
      "Making CI failures readable with job summaries",
      "Using required status checks to enforce quality on main",
      "Balancing PR speed against eval coverage",
    ],
    starter: {
      title: ".github/workflows/ci.yml (evals job excerpt)",
      lang: "yaml",
      code: `  evals:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r evals/requirements.txt
      - uses: actions/cache@v4
        with:
          path: .evalcache
          key: evalcache-\${{ hashFiles('evals/golden.jsonl', 'prompts/**') }}
          restore-keys: evalcache-
      - name: Run evals
        run: python evals/run_eval.py prompts/system.txt evals/results.json
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
      - name: Gate
        run: python evals/gate.py
      - name: Summary
        if: always()
        run: python evals/summary.py`,
    },
  },
  {
    slug: "flagship-v5-agents-eval",
    title: "Cortex v0.5: Research Agent + Eval Suite",
    week: 20,
    duration: "weekend",
    minutes: 720,
    difficulty: "hard",
    domain: "ai",
    skills: ["agents", "tool-calling", "ai-evaluation", "observability", "prompt-injection", "ci-cd"],
    prerequisites: [
      "Cortex v0.4 (RAG with citations) from month 4",
      "First AI Evaluation Pipeline",
      "Trace Your Agent",
      "Red-team Your Own RAG App",
      "GitHub Actions Eval Gate",
    ],
    topicSlugs: [
      "eval-datasets",
      "llm-as-judge",
      "evals-in-ci",
      "llm-tracing",
      "cost-latency-engineering",
      "prompt-injection",
      "red-teaming-guardrails",
      "ci-cd-github-actions",
    ],
    objective: "Ship Cortex v0.5: a research-agent mode that plans and uses tools over your documents, protected by injection defences, fully traced, and guarded by an eval suite (golden set + calibrated LLM judge + red-team cases) that runs in CI as a regression gate.",
    expectedOutput: "A deployed Cortex with a \"Research\" mode toggle; a trace viewer (or printed trees) for agent runs; evals/ with golden set, judge, calibration set and red-team payloads; a green CI pipeline with a required eval gate; and a README section with v0.5 metrics: groundedness, citation accuracy, attack success rate, p95 latency and cost per question.",
    steps: [
      {
        title: "Design the agent and its tools",
        detail: "Define 3–4 tools with strict JSON schemas: search_docs(query, top_k), read_chunk(chunk_id), and optionally fetch_url(url) behind the SSRF guard. The agent loop plans, calls tools, and ends with a tool-less answer step that cites chunk ids. Cap steps (e.g. 6) and total tokens per run.",
      },
      {
        title: "Apply injection defences by design",
        detail: "Retrieved and fetched text is wrapped as untrusted data; the answer step has no tools; model output passes through the image/link sanitiser; any future side-effect tool requires user confirmation. Plant a canary in the system prompt. Document the design in docs/threat-model.md.",
      },
      {
        title: "Trace every run",
        detail: "Instrument agent.run, agent.step, llm.call and tool.* spans with tokens, model, arguments and errors. Store traces as JSONL (or export to Phoenix/Langfuse) and add a simple /traces page or CLI that renders one run as a tree.",
      },
      {
        title: "Build the eval suite",
        detail: "Extend the golden set to 40+ cases with research-style multi-document questions. Scorers: citation accuracy (cited ids were retrieved and contain the answer), deterministic checks, and the calibrated groundedness judge (kappa recorded in CALIBRATION.md). Add the 10 red-team payloads as critical cases scored by canary/attacker-domain checks.",
      },
      {
        title: "Gate it in CI",
        detail: "Wire the suite into the GitHub Actions workflow with response caching, gate.py tolerances, critical-case enforcement and a job summary. Make it a required check on main.",
      },
      {
        title: "Measure cost and latency",
        detail: "From traces over 30 questions, report p50/p95 latency, average steps per run and cost per question for chat mode vs research mode. Apply one optimisation (fewer chunks, prompt-cache-friendly ordering, or a small model for query rewriting) and show before/after with eval scores unchanged.",
      },
      {
        title: "Ship and write it up",
        detail: "Deploy, add the Research toggle to the UI with visible tool-step progress (streamed), and write the README v0.5 section: architecture diagram, metrics table, and three failure cases you found through traces and turned into eval cases.",
      },
    ],
    hints: [
      "Build the eval suite before polishing the agent — you want every agent change measured from the start.",
      "A max-steps cap and a repeated-call detector (same tool, same arguments twice) prevent most runaway loops.",
      "Keep research mode's golden cases separate from chat mode's so each can be gated with its own tolerance.",
      "If the judge is expensive, run it only in the nightly suite and gate PRs on deterministic scorers plus critical cases.",
    ],
    stretch: "Add online evaluation: sample 10% of production research-mode traces, run the judge asynchronously, and chart groundedness over time on a small dashboard page.",
    learned: [
      "Designing an agent whose architecture limits the damage of prompt injection",
      "Combining deterministic scorers, a calibrated judge and red-team cases into one eval suite",
      "Using traces to find failures, cost and latency hot spots and feed them back into evals",
      "Running quality and security as a CI regression gate on a real product",
    ],
    starter: {
      title: "Agent loop skeleton with step cap and tracing hooks",
      lang: "python",
      code: `import json
from typing import Callable

MAX_STEPS = 6

def run_agent(question: str, llm: Callable[[list[dict]], dict],
              tools: dict[str, Callable[..., str]], span) -> str:
    messages = [{"role": "user", "content": question}]
    seen_calls: set[str] = set()
    with span("agent.run", question=question):
        for step in range(MAX_STEPS):
            with span("agent.step", step=step):
                reply = llm(messages)  # returns {"tool": name, "args": {...}} or {"answer": text}
                if "answer" in reply:
                    return reply["answer"]
                call_key = reply["tool"] + json.dumps(reply["args"], sort_keys=True)
                if call_key in seen_calls:
                    messages.append({"role": "user", "content": "You already made that call. Answer or try something different."})
                    continue
                seen_calls.add(call_key)
                with span("tool." + reply["tool"], **reply["args"]):
                    result = tools[reply["tool"]](**reply["args"])
                messages.append({"role": "assistant", "content": json.dumps(reply)})
                messages.append({"role": "user", "content": "<tool_result untrusted=\\"true\\">" + result + "</tool_result>"})
        return "I could not finish the research within the step limit."`,
      note: "Pass in the span() context manager from the tracing topic. Replace the llm() contract with your provider's native tool-calling API.",
    },
  },
];
