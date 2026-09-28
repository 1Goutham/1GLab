# Authoring curriculum content

The curriculum is structured data (`content/types.ts`), seeded into Postgres by
`scripts/seed.ts`. Components never import it directly.

## Who is reading

Goutham G — B.Tech AI & Data Science, working full-stack developer (React,
Next.js, TypeScript, Node/Express, MongoDB, Tailwind, Vercel, Figma). Has
shipped AI apps on Gemini/Grok/OpenAI APIs (Ideako, ZtudyLock, IdeaGuard AI,
FabricNest e-commerce). New-ish to Python/FastAPI, PyTorch, Postgres, Redis,
system design and deep ML internals. Goal: advanced AI engineer in 6 months.

So: never re-teach React/JS basics. Do connect new ideas to what he already
knows ("this is the Python version of an Express middleware"; "like
`useMemo`, but for your API").

## Voice

Write like a senior engineer teaching another engineer at a whiteboard.

- Short paragraphs (1–3 sentences). Blank line between paragraphs.
- Concrete before abstract. Open with a situation, never a definition.
  - Bad: "Redis is an in-memory data structure store."
  - Good: "Your AI app gets the same question 10,000 times. Do you really want to pay for 10,000 identical LLM calls?"
- Use his world as examples: his portfolio at 1goutham.space, IdeaGuard,
  ZtudyLock, FabricNest, the flagship project, Vercel, Next.js.
- No filler, no motivational fluff, no "In this lesson we will…", no emoji.
- Markdown allowed: **bold**, `code`, short bullet lists, links.
- British or American spelling is fine; be consistent within a topic.

## Every topic has all five levels

1. **l1** Explain like I'm smart but new — 2–4 sentences, zero jargon.
2. **l2** Mental model — an analogy plus a diagram (`Diagram` in types.ts).
   Pick the shape that shows the real mechanism: `flow` with a bad/good lane
   for before/after, `cycle` for loops, `stack` for layers, `compare` for
   trade-offs, `grid` for matrices (attention weights, confusion matrix).
3. **l3** Technical — actual engineering detail plus runnable code he could
   paste into a lab. Prefer Python for ML/AI/backend topics, TypeScript where
   the natural home is Next.js/Node. Use a `bad`/`good` pair when there is a
   classic wrong way.
4. **l4** Under the hood — how it is really implemented (data structures,
   algorithms, protocol bytes, the math). Code or diagram where it helps.
5. **l5** Interview / engineering question + a model answer (3–8 sentences,
   the kind a strong senior would give) + optional hint.

Plus: `commonMistakes` (2–4 real ones), `tryThis` (a 2-minute experiment),
`quiz` (3 questions, 4 options each, with `explain`), `explainPrompt`
(day-7 review), `implementPrompt` (day-14 review).

## Every topic has a mini task

Never teach without making him DO something. The mini task must be concrete,
finishable in the stated minutes, and verifiable by a checklist he confirms.

Example (HTTP): open DevTools, visit 1goutham.space, find one GET request,
note URL, method, status, a response header and the response size.

## Code

- Must be correct and runnable as written (imports included, no `...`
  placeholders in the executable path). Keep it short: 10–40 lines.
- Escape backticks inside template literals. Prefer normal string literals
  with `\n` joins or `String.raw` only if needed — simplest is to write code
  inside a template literal and avoid backticks and `${` in the code body
  (use string concatenation or f-strings instead of JS template strings).

## Videos

Only use `kind: "video"` for these exact, verified URLs:

| Channel | Title | URL | min |
|---|---|---|---|
| 3Blue1Brown | But what is a neural network? | https://www.youtube.com/watch?v=aircAruvnKk | 19 |
| 3Blue1Brown | Gradient descent, how neural networks learn | https://www.youtube.com/watch?v=IHZwWFHWa-w | 21 |
| 3Blue1Brown | Backpropagation, intuitively | https://www.youtube.com/watch?v=Ilg3gGewQ5U | 13 |
| 3Blue1Brown | Transformers, the tech behind LLMs | https://www.youtube.com/watch?v=wjZofJX0v4M | 27 |
| 3Blue1Brown | Attention in transformers, step-by-step | https://www.youtube.com/watch?v=eMlx5fFNoYc | 26 |
| Andrej Karpathy | The spelled-out intro to neural networks and backpropagation (micrograd) | https://www.youtube.com/watch?v=VMj-3S1tku0 | 145 |
| Andrej Karpathy | Building makemore (intro to language modeling) | https://www.youtube.com/watch?v=PaCmpygFfXo | 117 |
| Andrej Karpathy | Let's build GPT: from scratch, in code, spelled out | https://www.youtube.com/watch?v=kCc8FmEb1nY | 116 |
| Andrej Karpathy | Let's build the GPT Tokenizer | https://www.youtube.com/watch?v=zduSFxRajkE | 133 |
| Andrej Karpathy | Intro to Large Language Models | https://www.youtube.com/watch?v=zjkBMFhNj_g | 60 |
| Andrej Karpathy | Deep Dive into LLMs like ChatGPT | https://www.youtube.com/watch?v=7xTGNNLPyMI | 211 |

For everything else use `kind: "search"` with a precise YouTube search URL
that names a high-quality channel, e.g.
`https://www.youtube.com/results?search_query=hussein+nasser+tcp+three+way+handshake`.
Good channels: Hussein Nasser (networking/backends), ByteByteGo (system
design), NeetCode (DSA), StatQuest (ML), Fireship (quick overviews),
ArjanCodes (Python), mCoding (Python internals), Computerphile, sentdex,
Umar Jamil (transformers), Yannic Kilcher, AI Engineer (conference talks),
Hamel Husain (evals), freeCodeCamp (long courses), TechWorld with Nana
(DevOps), Anthropic/OpenAI official channels.

Every video needs a `reason`: when to watch it ("Watch this if the Q/K/V
explanation isn't clicking yet."). 1–2 videos per topic; zero is fine when
nothing good exists. Never pad.

## Labs

Labs are small projects: 20m, 45m, 90m, 3h, 1d or weekend. Each has an
objective, expected output, ordered steps, hints, a stretch goal and what
you learned. Labs build toward real artefacts he can show.
