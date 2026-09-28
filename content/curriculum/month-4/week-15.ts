import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "tool-calling",
    title: "Tool calling",
    week: 15,
    domain: "ai",
    skills: ["tool-calling", "llm-apis"],
    difficulty: "medium",
    minutes: 60,
    summary: "The model never runs your code. It emits a structured request to call a function; your code runs it and sends back the result.",
    tags: ["tool-use", "function-calling", "json-schema", "anthropic", "llm-apis"],
    lesson: {
      hook: `Ask Cortex "how many PDFs have I uploaded this month?" A plain LLM will invent a number. The answer lives in your Postgres, and the model cannot query Postgres.

You have probably hacked around this before: "reply in JSON with an action field", then \`JSON.parse\` and a big \`switch\`. It works until the model adds a friendly sentence before the JSON.

Tool calling is that pattern made first-class. You describe functions with JSON Schema; the model replies with a structured \`tool_use\` block instead of prose; your code runs the function and returns the result. Every agent, every MCP server and every "AI that does things" is built on this one exchange.`,
      whyItMatters: `Tool calling is how LLMs touch the real world: databases, APIs, files, other models. Getting the message shapes, schemas and error handling right is the foundation for agents and MCP.`,
      levels: {
        l1: `You give the model a menu of functions it may ask for, each with a name, a description and the inputs it needs. When a question needs one, the model replies "please call get_weather with city = Chennai" instead of answering. Your program runs that function, passes the result back, and the model uses it to write the final answer.`,
        l2: {
          analogy: `The model is a manager on the phone who cannot touch the computer. You are the assistant at the desk. The manager says "pull up last month's invoices for FabricNest"; you run the query and read the numbers back; the manager then gives the client an answer. The manager decides what to ask for; you decide what is actually allowed to run.`,
          text: `One tool call is **two API round trips**. Request 1 sends the question plus tool definitions; the response has \`stop_reason: "tool_use"\` and a \`tool_use\` block with an id, name and JSON input. Your code executes it. Request 2 sends the whole conversation again plus a \`tool_result\` block referencing that id; the model now answers in text.

The API is stateless: you resend history every time. The model is the planner; your code is the executor and the security boundary.`,
          diagram: {
            type: "flow",
            title: "One tool call, two round trips",
            lanes: [
              {
                label: "Round trip 1",
                tone: "neutral",
                steps: [
                  { label: "User question + tool schemas" },
                  { label: "Model decides", note: "stop_reason = tool_use" },
                  { label: "tool_use block", note: "id, name, input JSON" },
                ],
              },
              {
                label: "Your code",
                tone: "good",
                steps: [
                  { label: "Validate input" },
                  { label: "Run the function", note: "DB, API, file", accent: true },
                  { label: "tool_result", note: "same tool_use_id" },
                ],
              },
              {
                label: "Round trip 2",
                tone: "neutral",
                steps: [
                  { label: "History + tool_result" },
                  { label: "Model answers", note: "stop_reason = end_turn" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `A tool definition is a \`name\`, a \`description\` (this is prompt engineering: say **when** to use it and what it returns) and an \`input_schema\` in JSON Schema.

The response's \`content\` is a list of blocks. Always iterate and branch on \`block.type\`; there may be text before the tool call, and there may be **several** \`tool_use\` blocks in one response (parallel tool calls). Return all their results together in **one** user message.

When a tool fails, do not throw away the turn: return a \`tool_result\` with \`is_error: true\` and a useful message, and the model can recover (retry with different input, or explain the failure).

OpenAI's API has the same idea with different field names: \`tools[].function.parameters\`, \`message.tool_calls[].function.arguments\` (a JSON **string** you must parse) and a \`role: "tool"\` message with \`tool_call_id\`.`,
          code: [
            {
              title: "One tool call with the Anthropic Python SDK",
              lang: "python",
              note: "pip install anthropic; export ANTHROPIC_API_KEY. MODEL defaults to claude-opus-5.",
              code: `import json
import os
import anthropic

client = anthropic.Anthropic()
MODEL = os.environ.get("MODEL", "claude-opus-5")

TOOLS = [{
    "name": "count_documents",
    "description": "Count documents the user uploaded to Cortex in a given month. "
                   "Use for any question about how many documents or uploads exist.",
    "input_schema": {
        "type": "object",
        "properties": {"month": {"type": "string", "description": "YYYY-MM"}},
        "required": ["month"],
    },
}]

def count_documents(month: str) -> dict:
    fake_db = {"2026-09": 14, "2026-08": 9}  # replace with a real SQL query
    return {"month": month, "count": fake_db.get(month, 0)}

messages = [{"role": "user", "content": "How many PDFs did I upload in September 2026?"}]
resp = client.messages.create(model=MODEL, max_tokens=4000, tools=TOOLS, messages=messages)

if resp.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": resp.content})  # keep all blocks
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            output = count_documents(**block.input)
            results.append({"type": "tool_result", "tool_use_id": block.id,
                            "content": json.dumps(output)})
    messages.append({"role": "user", "content": results})
    resp = client.messages.create(model=MODEL, max_tokens=4000, tools=TOOLS, messages=messages)

print("".join(b.text for b in resp.content if b.type == "text"))`,
            },
          ],
        },
        l4: {
          text: `**What the model actually sees.** The API renders your tool definitions into the prompt in a format the model was trained on (roughly: a system section listing tools and schemas). The model was fine-tuned to emit a special structured tool-call segment when a tool would help. The API parses that segment into a \`tool_use\` block and stops generation with \`stop_reason: "tool_use"\`. There is no magic execution; it is next-token prediction plus a parser.

**Schemas are guidance unless enforced.** By default the input usually matches your schema but is not guaranteed. Setting \`strict: true\` on a tool uses constrained decoding so the input is guaranteed to validate (requires \`additionalProperties: false\` and \`required\`). Either way, **validate on your side**: a tool input is untrusted data, exactly like a request body in Express.

**Descriptions drive selection.** With 3 tools the model picks well. With 40 overlapping tools it starts confusing them. Keep tools few, distinct and well named (\`search_documents\` not \`search\`), describe when **not** to use them, and return compact, structured results (big blobs cost tokens on every later turn).

**tool_choice** controls selection: \`auto\` (default: model decides), \`none\`, or forcing a specific tool on models that support it. Forcing is a common trick to get structured output; newer models favour structured outputs for that instead.

**Raw wire shapes** are worth knowing because MCP and every SDK map onto them:`,
          code: [
            {
              title: "The raw content blocks on the wire",
              lang: "json",
              note: "Two separate messages: the assistant turn containing the tool_use, then the user turn carrying its tool_result.",
              code: `{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Let me check your uploads." },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "count_documents",
      "input": { "month": "2026-09" }
    }
  ]
}

{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A",
      "content": "{\\"month\\": \\"2026-09\\", \\"count\\": 14}"
    }
  ]
}`,
            },
          ],
        },
        l5: {
          question: `You are adding tool calling to a production assistant with 25 internal tools. Users report it sometimes calls the wrong tool or passes malformed arguments. How do you make tool use reliable?`,
          hint: "Think about the tool surface, the schema contract, and what happens on failure.",
          answer: `First I would look at traces to see which tools get confused and why; usually it is overlapping names and vague descriptions. I would shrink and sharpen the surface: merge near-duplicates, give each tool a verb-noun name, and write descriptions that say when to use it, when not to, and what it returns, with an example input. If many tools are genuinely needed, I would route: classify the request first and expose only the relevant subset, or use tool search so the model loads definitions on demand.

For arguments, I would turn on strict schemas where supported, use enums and formats instead of free strings, and still validate server-side with Pydantic, returning a \`tool_result\` with \`is_error\` and a precise message when validation fails so the model can self-correct. Tools must be idempotent or guarded, with timeouts, and destructive ones need confirmation.

Finally I would build an eval: 50 to 100 labelled prompts with the expected tool and key arguments, run on every change to prompts, tool descriptions or model, and track tool-selection accuracy and argument validity as metrics.`,
        },
      },
      commonMistakes: [
        "Appending only the text of the assistant response to history and dropping the tool_use block; the next request fails because the tool_result has nothing to refer to.",
        "Returning several tool results in separate user messages instead of one message with all tool_result blocks.",
        "Trusting tool input because it came from the model. Validate it like any user-supplied request body.",
        "Throwing an exception on tool failure instead of returning an is_error tool_result the model can react to.",
      ],
      tryThis: `Ask the Level 3 script "What's 2 + 2?" and print resp.stop_reason. The model should answer directly with end_turn, because the tool description does not match. Now make the description vaguer ("Use this for any question") and see if selection changes.`,
      miniTask: {
        title: "Two tools, one conversation",
        kind: "code",
        minutes: 40,
        steps: [
          "Start from the Level 3 script.",
          "Add a second tool, get_document_titles(month), returning a list of fake titles.",
          "Ask: 'How many documents did I upload in August 2026 and what were they called?'",
          "Print every content block of every response (type, and name/input for tool_use) to see whether the model called both tools, and whether in one response or two.",
          "Make get_document_titles raise an exception for an invalid month and return it as is_error: true; ask about month '2026-13' and read how the model handles it.",
        ],
        checklist: [
          "Both tools are defined with JSON Schema and clear descriptions",
          "All tool_result blocks for one response go back in a single user message",
          "The error case returns is_error instead of crashing",
          "I can explain what stop_reason was on each response",
        ],
        deliverable: "tools_demo.py and the printed block trace from one run.",
      },
      quiz: [
        {
          q: "Who executes the function when a model 'calls a tool'?",
          options: ["The model provider's servers", "Your application code", "The model itself, inside the GPU", "The browser"],
          answer: 1,
          explain: "For user-defined tools the model only emits a structured request. Your code runs the function and returns a tool_result.",
        },
        {
          q: "The model returns two tool_use blocks in one response. How should you reply?",
          options: [
            "Run only the first one",
            "Send two separate user messages, one per result",
            "Send one user message containing both tool_result blocks, each with its tool_use_id",
            "Merge them into one text message",
          ],
          answer: 2,
          explain: "All results for a turn go back together in one user message, matched by id. Splitting them teaches the model to stop calling tools in parallel.",
        },
        {
          q: "A tool call fails because an external API times out. Best response?",
          options: [
            "Raise and end the conversation",
            "Silently return an empty result",
            "Return a tool_result with is_error: true and a clear message",
            "Retry forever until it works",
          ],
          answer: 2,
          explain: "An error result keeps the loop alive and lets the model retry, choose another tool or explain the failure honestly.",
        },
      ],
      explainPrompt: "Explain tool calling to a junior engineer in 5 sentences, including who runs the code and why history must be resent.",
      implementPrompt: "From memory: define one tool with a JSON Schema, call the Messages API, execute the tool_use block and send back a tool_result to get a final answer.",
      videos: [
        {
          title: "Tool use with Claude",
          channel: "Anthropic",
          url: "https://www.youtube.com/results?search_query=anthropic+claude+tool+use+tutorial",
          kind: "search",
          reason: "Watch this if the request/response block shapes are not yet clear; seeing a live trace makes the two round trips obvious.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "agent-loop",
    title: "The agent loop",
    week: 15,
    domain: "ai",
    skills: ["agents"],
    difficulty: "medium",
    minutes: 80,
    summary: "An agent is tool calling in a while loop: observe, think, act, observe, until the model says it is done or a guard stops it.",
    prerequisites: ["tool-calling"],
    tags: ["agents", "react", "tool-use", "loop", "max-steps"],
    lesson: {
      hook: `"Find my notes on HNSW, check which parameters I used in the pgvector lab, and write a short summary with the numbers." One tool call cannot do that. The model needs to search, read what came back, decide to open a file, read that, maybe search again, and only then write.

You do not program that sequence. You give the model tools and a loop, and it decides the next step based on what it just observed.

That is all an agent is: **tool calling inside a while loop**, with the model choosing when to stop. The engineering is in everything around the loop: stopping conditions, errors, cost and making its decisions visible.`,
      whyItMatters: `The agent loop is the core of Claude Code, Cursor, deep-research tools and every autonomous workflow. Once you can write it in 40 lines, frameworks become optional conveniences instead of black boxes.`,
      levels: {
        l1: `The program asks the model what to do next. If the model asks for a tool, the program runs it and shows the model the result, then asks again. This repeats until the model gives a final answer, or until a safety limit like "maximum 10 steps" stops it.`,
        l2: {
          analogy: `A detective at a desk. Look at the evidence (observe), decide what would help most (think), make one phone call or pull one file (act), then look at what came back (observe again). The detective does not plan every call in advance; each result changes the next move. The chief sets a rule: close the case or report back after 10 calls.`,
          text: `This is the **ReAct** pattern (reason + act, Yao et al., 2022), now built into model APIs as native tool use. The model's context is its working memory: the task, every tool call and every result so far.

The loop ends in one of three ways: the model answers (\`end_turn\`), a guard trips (max steps, budget, timeout), or a human is needed (approval for a risky action). Designing all three exits is the job.`,
          diagram: {
            type: "cycle",
            title: "The agent loop",
            center: "Context window = working memory",
            steps: [
              { label: "Observe", note: "task + all tool results so far" },
              { label: "Think", note: "model decides next step" },
              { label: "Act", note: "tool_use: search, read, compute", accent: true },
              { label: "Observe", note: "tool_result appended" },
            ],
          },
        },
        l3: {
          text: `The loop below is a complete agent with three tools and a hard \`MAX_STEPS\` guard. Notice:

- The system prompt asks the model to state **why** it picks each tool before calling it. With native tool use, text before a \`tool_use\` block is where that reasoning shows up, so the loop logs it.
- Every assistant response is appended **in full** (all blocks), then all tool results go back in one user message.
- Unknown tools and exceptions become \`is_error\` results, never crashes.
- The calculator uses \`ast\` to evaluate arithmetic safely. Never \`eval\` model output.`,
          code: [
            {
              title: "A three-tool agent with a max-steps guard",
              lang: "python",
              code: `import ast
import json
import operator
import os
import anthropic

client = anthropic.Anthropic()
MODEL = os.environ.get("MODEL", "claude-opus-5")
MAX_STEPS = 8
OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}
NOTES = {"hnsw": "pgvector lab: m=16, ef_construction=64, ef_search=100", "rrf": "k=60"}

def calc(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in OPS:
        return OPS[type(node.op)](calc(node.left), calc(node.right))
    raise ValueError("only + - * / on numbers")

def run_tool(name: str, args: dict) -> str:
    if name == "calculator":
        return str(calc(ast.parse(args["expression"], mode="eval").body))
    if name == "search_notes":
        return json.dumps({k: v for k, v in NOTES.items() if args["query"].lower() in k + " " + v})
    if name == "save_note":
        NOTES[args["key"]] = args["text"]
        return "saved"
    raise ValueError("unknown tool " + name)

def tool(name, desc, props):
    return {"name": name, "description": desc,
            "input_schema": {"type": "object", "properties": props, "required": list(props)}}

TOOLS = [
    tool("calculator", "Exact arithmetic. Use instead of mental math.", {"expression": {"type": "string"}}),
    tool("search_notes", "Search the user's notes by keyword.", {"query": {"type": "string"}}),
    tool("save_note", "Save a note under a key.", {"key": {"type": "string"}, "text": {"type": "string"}}),
]
SYSTEM = "Before each tool call, say in one sentence why you chose that tool."

def run_agent(task: str) -> str:
    messages = [{"role": "user", "content": task}]
    for step in range(1, MAX_STEPS + 1):
        resp = client.messages.create(model=MODEL, max_tokens=4000, system=SYSTEM,
                                      tools=TOOLS, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})
        for b in resp.content:
            if b.type == "text" and b.text.strip():
                print(f"[step {step}] thought: {b.text.strip()}")
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        results = []
        for b in resp.content:
            if b.type != "tool_use":
                continue
            print(f"[step {step}] act: {b.name}({json.dumps(b.input)})")
            try:
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input)})
            except Exception as e:
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": str(e), "is_error": True})
        messages.append({"role": "user", "content": results})
    return "Stopped: hit MAX_STEPS without a final answer."

print(run_agent("Find my HNSW settings, compute ef_search / m, and save the result as 'ratio'."))`,
            },
          ],
        },
        l4: {
          text: `**Cost grows quadratically.** Every iteration resends the whole history. With a 2k-token system+tools prefix and each step adding ~1k tokens, step n costs ~(2 + n)k input tokens, so 10 steps cost ~65k input tokens, not 10k. Mitigations: prompt caching of the stable prefix (tools + system are identical every call), compact tool results (return the 5 relevant fields, not the whole API response), and summarising or clearing old tool results in long runs.

**Stopping is a design decision.** Hard caps: max steps, max tokens or dollars, wall-clock timeout. Soft signals: the same tool called with the same arguments twice in a row (a loop), repeated errors. Always return **something** useful when a guard trips: what was done, what is left.

**Parallel tool calls.** Models can emit several independent \`tool_use\` blocks in one turn ("search notes" and "search web" at once). Execute them concurrently (\`asyncio.gather\` or a thread pool) and return all results together; this cuts latency substantially.

**Workflows vs agents.** If you know the steps in advance (retrieve, then summarise, then format), write that as code: a workflow is cheaper, faster and testable. Use an agent loop when the path genuinely depends on intermediate results. Anthropic's "Building effective agents" guidance puts it bluntly: start with the simplest thing that works.

**Observability.** Log every step as a structured event: step number, reasoning text, tool name, input, output size, latency, tokens. When an agent fails, the trace is the only way to know whether the model chose badly, a tool returned garbage, or the loop cut it off.`,
          code: [
            {
              title: "Detecting a stuck agent",
              lang: "python",
              code: `import json

def is_looping(history: list[tuple[str, dict]], window: int = 3) -> bool:
    """True if the last window tool calls are identical (same name and args)."""
    if len(history) < window:
        return False
    recent = [name + json.dumps(args, sort_keys=True) for name, args in history[-window:]]
    return len(set(recent)) == 1

calls = [("search_notes", {"query": "hnsw"})] * 3
print(is_looping(calls))                                    # True: stop or change strategy
print(is_looping(calls[:2] + [("calculator", {"expression": "100/16"})]))  # False`,
            },
          ],
        },
        l5: {
          question: `Your research agent works in demos but in production some runs take 40 steps, cost $3, and end without an answer. How do you fix it?`,
          hint: "Look at traces first; then guards, tool design and whether it should be an agent at all.",
          answer: `I would start by reading traces of the bad runs and clustering the failure: repeating the same search, tools returning huge or unhelpful payloads, errors the model keeps retrying, or tasks that are simply underspecified. Most runaway agents are tool problems, not model problems.

Then I would add guards: a step and token budget with a graceful exit that returns partial findings, loop detection on identical tool calls, and timeouts per tool. On the tool side I would make results compact and informative, return actionable error messages, and remove or merge tools the model confuses. I would enable prompt caching for the stable prefix and trim or summarise old tool results so cost does not grow quadratically.

I would also question the architecture: if most runs follow the same few steps, a fixed workflow with an LLM at specific points is cheaper and more reliable, with the agent loop kept for the long tail. Finally I would build an eval of 30 representative tasks and track success rate, steps and cost per task, so each change is measured.`,
        },
      },
      commonMistakes: [
        "No max-steps or budget guard, so a confused model loops until your API bill notices.",
        "Using eval() or exec() on model-generated input for a calculator or code tool.",
        "Returning raw 50 KB API responses as tool results; they are resent on every later step.",
        "Building an agent for a task with a fixed sequence of steps that a simple workflow would handle more cheaply and reliably.",
      ],
      tryThis: `Set MAX_STEPS = 1 and run the Level 3 agent. Read what it returns. Then give it an impossible task ("find my notes on Kubernetes and multiply them by 3") and watch how it uses the error and empty results.`,
      miniTask: {
        title: "An agent that explains its tool choices",
        kind: "build",
        minutes: 50,
        steps: [
          "Copy the Level 3 agent and run it on the example task; read the full step trace.",
          "Replace search_notes with a real search over a folder of your own markdown notes (substring match is fine).",
          "Give it three tasks: one needing only the calculator, one needing search then calculator, one needing all three tools.",
          "For each run, record steps used, tools called in order, and the one-sentence reason logged before each call.",
          "Add loop detection with is_looping from Level 4 and a final 'partial result' message when any guard trips.",
        ],
        checklist: [
          "The agent uses three tools and logs a reason before each tool call",
          "MAX_STEPS and loop detection both end the run gracefully",
          "Tool errors return is_error results and the agent recovers or explains",
          "I can say, for each task, whether a fixed workflow would have been better",
        ],
        deliverable: "agent.py plus the three step traces pasted into a notes file.",
      },
      quiz: [
        {
          q: "What ends a well-designed agent loop?",
          options: [
            "Only the model returning end_turn",
            "The model finishing, or a guard (max steps, budget, timeout, loop detection), or a need for human approval",
            "Running out of tools",
            "A fixed number of steps every time",
          ],
          answer: 1,
          explain: "The happy path is end_turn, but production agents need explicit exits for runaway loops, cost and risky actions.",
        },
        {
          q: "Why does agent cost grow faster than linearly with steps?",
          options: [
            "Tool calls are billed per step squared",
            "Each request resends the entire growing history as input tokens",
            "Models slow down over time",
            "Tool schemas grow with each step",
          ],
          answer: 1,
          explain: "Step n pays for all n-1 previous steps again. Cache the stable prefix and keep tool results compact.",
        },
        {
          q: "When is a fixed workflow better than an agent loop?",
          options: [
            "When the steps are known in advance and do not depend on intermediate results",
            "When you have more than two tools",
            "When the model is very capable",
            "Never; agents are strictly more powerful",
          ],
          answer: 0,
          explain: "Workflows are cheaper, faster, and testable. Use agents when the path genuinely depends on what each step returns.",
        },
      ],
      explainPrompt: "Explain the agent loop to a junior engineer in 5 sentences: observe, think, act, observe, and the three ways it should end.",
      implementPrompt: "From memory: write run_agent(task) with a while loop over the Messages API, executing tool_use blocks, returning tool_result blocks, and stopping at MAX_STEPS.",
      videos: [
        {
          title: "Building Effective Agents (Barry Zhang, Anthropic)",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+barry+zhang+building+effective+agents",
          kind: "search",
          reason: "Watch this after writing your loop: it covers when not to build an agent and how to think from the model's point of view.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "agent-planning-memory",
    title: "Planning & memory for agents",
    week: 15,
    domain: "ai",
    skills: ["agent-memory", "agents"],
    difficulty: "hard",
    minutes: 80,
    summary: "Give agents an explicit plan they can update, and memory beyond the context window: working, summarised and long-term retrievable.",
    prerequisites: ["agent-loop", "semantic-search"],
    tags: ["planning", "memory", "context-engineering", "summarisation", "long-term-memory"],
    lesson: {
      hook: `Monday you tell Cortex "I prefer answers with code in Python, not TypeScript". Tuesday it answers in TypeScript. The model did not forget; it never knew. Each conversation starts from an empty context.

Meanwhile, a long research task fails differently: by step 25 the context is full of old search results, the original goal is buried 60,000 tokens back, and the agent starts wandering.

Both are memory problems. The context window is the only thing a model "remembers", so memory is really **context engineering**: deciding what goes into that window at each step, and where everything else lives.`,
      whyItMatters: `Long-running and personal agents live or die on planning and memory. It is also where most agent cost and reliability problems come from, and a favourite interview topic.`,
      levels: {
        l1: `A model only knows what is in front of it right now. To help it with long tasks, you keep a written plan it can check off, and you save important facts somewhere outside the conversation. Before each step, you put back only what is relevant: the plan, recent steps, and any saved facts that match the current task.`,
        l2: {
          analogy: `A surgeon's day. The patient chart on the table is working memory (the context window). The checklist on the wall is the plan. The hospital records system is long-term memory: huge, searchable, and only the relevant file is brought into the room. Nobody wheels the entire records room into surgery.`,
          text: `Think of memory in layers, each cheaper and larger than the one above:

- **Working memory**: the current context window. Fast, small, expensive per token.
- **Short-term / session**: the conversation so far, compressed by summarising or dropping old tool results.
- **Long-term**: facts, preferences and past episodes stored in a database and **retrieved** into context when relevant (it is RAG over the agent's own history).

**Planning** is memory about the future: an explicit list of steps the agent writes, follows and revises, kept near the end of the context so it never gets buried.`,
          diagram: {
            type: "stack",
            title: "Memory layers for an agent",
            layers: [
              { label: "Working memory", note: "context window: system, plan, recent steps", accent: true },
              { label: "Plan / todo list", note: "explicit steps, updated each turn" },
              { label: "Session summary", note: "compressed older turns and tool results" },
              { label: "Long-term memory", note: "facts + episodes in pgvector, retrieved by similarity" },
            ],
          },
        },
        l3: {
          text: `Two tools give an agent most of what it needs.

**A plan tool.** Let the model write and update a todo list (\`update_plan\`) and render the current plan into each request. Claude Code's todo list is exactly this. It keeps the goal visible after many steps and makes progress inspectable.

**Memory tools.** \`remember(fact)\` stores a short, self-contained fact with an embedding; \`recall(query)\` retrieves the top matches. Before each new conversation you can also pre-fetch memories relevant to the user's first message and put them in the system prompt.

The code below is a minimal long-term memory with numpy that you would back with pgvector in Cortex. The embedding function is passed in, so you can reuse your Week 13 \`embed\`.`,
          code: [
            {
              title: "Long-term memory with remember / recall",
              lang: "python",
              code: `import json
import time
from typing import Callable
import numpy as np

class Memory:
    def __init__(self, embed: Callable[[list[str]], np.ndarray], path: str = "memory.json"):
        self.embed, self.path = embed, path
        try:
            self.items = json.load(open(path, encoding="utf-8"))
        except FileNotFoundError:
            self.items = []  # each: {"text", "ts", "vec"}

    def remember(self, text: str) -> str:
        vec = self.embed([text])[0]
        self.items.append({"text": text, "ts": time.time(), "vec": vec.tolist()})
        json.dump(self.items, open(self.path, "w", encoding="utf-8"))
        return "remembered"

    def recall(self, query: str, k: int = 3, min_score: float = 0.3) -> list[str]:
        if not self.items:
            return []
        q = self.embed([query])[0]
        mat = np.array([m["vec"] for m in self.items], dtype=np.float32)
        scores = mat @ q
        best = np.argsort(-scores)[:k]
        return [self.items[i]["text"] for i in best if scores[i] >= min_score]

# Usage with your normalised Week 13 embed():
# mem = Memory(embed)
# mem.remember("Goutham prefers Python examples over TypeScript for backend topics.")
# system = "Known about the user:\\n" + "\\n".join(mem.recall("write a FastAPI endpoint"))`,
            },
            {
              title: "A plan the agent maintains",
              lang: "python",
              code: `PLAN_TOOL = {
    "name": "update_plan",
    "description": "Create or update your step-by-step plan. Call first for multi-step tasks, "
                   "and again whenever a step is done or the plan changes.",
    "input_schema": {
        "type": "object",
        "properties": {"steps": {"type": "array", "items": {
            "type": "object",
            "properties": {"text": {"type": "string"},
                           "status": {"type": "string", "enum": ["todo", "doing", "done"]}},
            "required": ["text", "status"]}}},
        "required": ["steps"],
    },
}

plan: list[dict] = []

def update_plan(steps: list[dict]) -> str:
    plan[:] = steps
    return render_plan()

def render_plan() -> str:
    marks = {"todo": "[ ]", "doing": "[>]", "done": "[x]"}
    return "\\n".join(marks[s["status"]] + " " + s["text"] for s in plan) or "(no plan yet)"`,
            },
          ],
        },
        l4: {
          text: `**Context rot.** Model accuracy degrades as the context fills with irrelevant tokens, well before the hard limit. The goal is not "fit everything" but "keep the window high-signal".

**Compression strategies for long runs**, cheapest first:

- **Tool-result clearing**: after a result has been used, replace it with a stub ("search results: 12 items, see summary above"). Anthropic's API offers this as server-side context editing.
- **Summarisation / compaction**: when history passes a threshold, ask the model to summarise decisions, facts found and open questions, then continue from the summary. Claude Code does this ("compacting conversation").
- **Sub-agents**: delegate a noisy sub-task (read 30 files) to a fresh agent with its own context and receive only its conclusion.

**What to store long-term.** Store **distilled facts** ("prefers Python examples"), not raw transcripts: they retrieve better and are cheaper to inject. Keep a timestamp and source for each; newer facts should override older ones ("moved from Chennai to Bengaluru"). Let the user see and delete memories; it is personal data.

**Episodic memory** stores past task attempts and outcomes ("last time, the search tool failed on acronyms; used FTS instead"). Retrieving similar episodes before a task is a simple form of learning from experience without fine-tuning.

**Planning styles.** ReAct interleaves thinking and acting with no explicit plan: flexible, can wander. **Plan-and-execute** writes a plan first, executes steps (possibly with a cheaper model) and re-plans on failure: more predictable and easier to monitor. Reasoning models that think before each tool call blur this line, but an explicit, visible plan still helps humans supervise and helps the model after compaction.`,
          code: [
            {
              title: "Compact history when it grows too large",
              lang: "python",
              code: `import anthropic

client = anthropic.Anthropic()

def approx_tokens(messages: list[dict]) -> int:
    return sum(len(str(m["content"])) for m in messages) // 4  # rough: 4 chars per token

def compact(messages: list[dict], model: str, limit: int = 60_000, keep_last: int = 6) -> list[dict]:
    if approx_tokens(messages) < limit:
        return messages
    old, recent = messages[:-keep_last], messages[-keep_last:]
    transcript = "\\n".join(m["role"] + ": " + str(m["content"])[:2000] for m in old)
    resp = client.messages.create(
        model=model, max_tokens=2000,
        messages=[{"role": "user", "content":
            "Summarise this agent transcript: the goal, decisions made, facts found "
            "(with sources), and open questions. Be concise.\\n\\n" + transcript}],
    )
    summary = "".join(b.text for b in resp.content if b.type == "text")
    return [{"role": "user", "content": "Summary of earlier work:\\n" + summary}] + recent`,
              note: "Keep the cut on a clean boundary in real code: never split a tool_use from its tool_result, and make sure the kept slice starts with a user turn.",
            },
          ],
        },
        l5: {
          question: `Design memory for a personal assistant that users talk to daily for months. It should remember preferences and past projects, but stay fast, cheap and respectful of privacy.`,
          hint: "What gets written, when, in what form; what gets read and how much; how users stay in control.",
          answer: `I would separate write, store and read. On write, after each conversation a background job asks a small model to extract durable, self-contained facts and preferences with a confidence and category, deduplicates them against existing memories by embedding similarity, and updates or supersedes conflicting ones with timestamps rather than appending forever. Raw transcripts are kept separately with a retention policy, not injected directly.

Storage is Postgres with pgvector: a memories table with user_id, text, category, embedding, source conversation, created and last-used timestamps. On read, before each turn I embed the user's message, retrieve a handful of relevant memories above a calibrated similarity threshold, always include a small pinned profile (name, language, key preferences), and cap the injected memory to a fixed token budget so latency and cost stay flat as history grows.

For privacy, users can list, edit and delete memories, there is an off switch, and sensitive categories are never stored automatically. I would evaluate with scripted multi-session scenarios: does it recall the right preference, does it correctly override stale facts, and does it avoid injecting irrelevant memories.`,
        },
      },
      commonMistakes: [
        "Treating a bigger context window as memory: stuffing every past message in makes the agent slower, pricier and less accurate.",
        "Storing raw transcripts as long-term memory instead of distilled facts, so retrieval returns chatty noise.",
        "Never updating memories, so stale facts ('works at company X') contradict new ones forever.",
        "Summarising in a way that drops the original goal or cuts a tool_use apart from its tool_result.",
      ],
      tryThis: `Store three memories with Memory.remember, including two that conflict ("lives in Chennai", then "moved to Bengaluru"). Call recall("where does Goutham live?") and see that both come back. How would you make the newer one win?`,
      miniTask: {
        title: "Give your agent a plan and a memory",
        kind: "build",
        minutes: 50,
        steps: [
          "Start from your agent-loop code.",
          "Add the update_plan tool and render the current plan into the system prompt on every request.",
          "Add remember and recall tools backed by the Memory class and your embed function.",
          "Run a two-session test: in session 1 tell it two preferences; in session 2 (fresh messages list) ask a question where those preferences should change the answer.",
          "Print the plan after each step and the memories retrieved at the start of session 2.",
        ],
        checklist: [
          "The agent creates a plan before multi-step work and marks steps done",
          "Memories persist to disk and survive a restart",
          "Session 2's answer reflects a preference from session 1",
          "Retrieved memories are capped (k and a score threshold)",
        ],
        deliverable: "agent_with_memory.py and the transcripts of both sessions.",
      },
      quiz: [
        {
          q: "What is the most accurate description of long-term memory for an LLM agent?",
          options: [
            "Fine-tuning the model after each conversation",
            "Storing facts outside the model and retrieving relevant ones into the context when needed",
            "Using the largest available context window",
            "Setting temperature to 0",
          ],
          answer: 1,
          explain: "The model's weights do not change. Memory is external storage plus retrieval, which is RAG over the agent's own history.",
        },
        {
          q: "Why keep an explicit plan in the context during long tasks?",
          options: [
            "It is required by the API",
            "It keeps the goal and progress visible after many steps and survives compaction",
            "It reduces the number of tools",
            "It makes the model deterministic",
          ],
          answer: 1,
          explain: "Without it, the original goal drifts far back in a long context. A rendered plan near the end keeps the agent on track and lets humans see progress.",
        },
        {
          q: "Which is usually the cheapest first step to control context growth in a long agent run?",
          options: [
            "Fine-tune a smaller model",
            "Clear or stub out old tool results that have already been used",
            "Switch to a model with a larger window",
            "Restart the agent every 5 steps",
          ],
          answer: 1,
          explain: "Old tool results are often the bulk of the tokens and are rarely needed verbatim again. Clearing them is cheap and loses little.",
        },
      ],
      explainPrompt: "Explain the four memory layers of an agent to a junior engineer in 5 sentences, and why memory is really context engineering.",
      implementPrompt: "From memory: implement a Memory class with remember(text) and recall(query, k) using embeddings and cosine similarity, persisted to a JSON file.",
      videos: [
        {
          title: "Agent memory and context engineering (MemGPT / Letta)",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+letta+memgpt+agent+memory",
          kind: "search",
          reason: "Watch this for a deeper take on tiered memory and self-editing memory once your remember/recall tools work.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "three-tool-agent",
    title: "Three-Tool Agent with Visible Reasoning",
    week: 15,
    duration: "3h",
    minutes: 180,
    difficulty: "medium",
    domain: "ai",
    skills: ["agents", "tool-calling", "llm-apis", "python"],
    prerequisites: ["Tool calling", "The agent loop", "An Anthropic or OpenAI API key"],
    topicSlugs: ["agent-loop", "tool-calling", "agent-planning-memory"],
    objective: "Build an agent with three genuinely useful tools (calculator, document search over your Cortex chunks, and file notes) that logs why it selects each tool, and stops safely under a max-steps guard.",
    expectedOutput: "python agent.py \"task\" prints a numbered trace (reason, tool, input, truncated output, latency) followed by the final answer and a footer with steps used, total input/output tokens and estimated cost. A trace.jsonl file records every step. Three test tasks run end to end, and a deliberately impossible task ends gracefully with a partial result.",
    steps: [
      {
        title: "Tools",
        detail: "Implement calculator (safe ast evaluation, no eval), search_docs(query, k) that calls your pgvector retrieval from the RAG lab and returns id, title, page and a 300-character snippet, and notes(action, key, text?) that reads or writes markdown files in a ./notes folder (reject keys containing '/' or '..').",
      },
      {
        title: "Schemas and descriptions",
        detail: "Write JSON Schemas with required fields and enums (action: read|write|list). Descriptions say when to use each tool and what it returns. Validate inputs in Python before execution and return is_error results with actionable messages on failure.",
      },
      {
        title: "The loop",
        detail: "Implement the observe-think-act loop with MAX_STEPS = 10, all tool results for a turn in one user message, and parallel execution of multiple tool_use blocks with a thread pool.",
      },
      {
        title: "Visible reasoning",
        detail: "System prompt: before each tool call, state in one sentence why this tool, and why not the others. Log that text with each call. Write each step as a JSON line to trace.jsonl with step, reason, tool, input, output_chars, ms, input_tokens, output_tokens.",
      },
      {
        title: "Guards",
        detail: "Stop on MAX_STEPS, on a token budget (e.g. 150k input tokens), and on loop detection (same tool + args 3 times). Each guard returns a message summarising what was done and what is left.",
      },
      {
        title: "Test tasks",
        detail: "Run: (1) 'What is 17.5% of 2,340?' (calculator only), (2) 'Find what my documents say about HNSW ef_search and save a one-line note' (search then notes), (3) 'Read my note on HNSW, compute ef_search divided by m, and append the result' (all three), (4) an impossible task. Save the four traces.",
      },
    ],
    hints: [
      "Usage numbers are on resp.usage.input_tokens and resp.usage.output_tokens; sum them across steps.",
      "If the model calls search_docs with vague queries, improve the tool description with an example of a good query.",
      "Truncate long tool outputs in the log, not in the tool_result, unless they are genuinely too big for the model.",
      "Keep TOOLS and SYSTEM byte-identical between calls so prompt caching can kick in on the stable prefix.",
    ],
    stretch: "Add a human-in-the-loop gate: notes write actions print the proposed change and wait for y/n on stdin before running. Then add a fourth tool and measure whether tool-selection accuracy on your test tasks drops.",
    learned: [
      "How to write tools, schemas and descriptions a model selects correctly",
      "How to build a robust agent loop with parallel calls, error results and multiple guards",
      "How to make an agent's decisions auditable with structured traces",
      "How cost accumulates across steps and how to measure it",
    ],
    starter: {
      title: "Safe note paths",
      lang: "python",
      code: `from pathlib import Path

NOTES_DIR = Path("notes").resolve()
NOTES_DIR.mkdir(exist_ok=True)

def note_path(key: str) -> Path:
    if not key or "/" in key or "\\\\" in key or ".." in key:
        raise ValueError("invalid note key: use letters, numbers, - and _")
    path = (NOTES_DIR / (key + ".md")).resolve()
    if path.parent != NOTES_DIR:
        raise ValueError("note path escapes notes directory")
    return path

def notes(action: str, key: str = "", text: str = "") -> str:
    if action == "list":
        return ", ".join(p.stem for p in NOTES_DIR.glob("*.md")) or "(no notes)"
    path = note_path(key)
    if action == "read":
        return path.read_text(encoding="utf-8") if path.exists() else "(note not found)"
    if action == "write":
        path.write_text(text, encoding="utf-8")
        return "wrote " + str(len(text)) + " chars to " + key
    raise ValueError("action must be list, read or write")`,
    },
  },
];
