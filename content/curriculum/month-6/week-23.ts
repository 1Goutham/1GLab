import type { LabSeed, TopicSeed } from "../../types";

const p = (...parts: string[]) => parts.join("\n\n");

export const topics: TopicSeed[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "ai-ux-patterns",
    title: "AI UX patterns",
    week: 23,
    domain: "frontend",
    skills: ["ai-ux", "ui-ux"],
    difficulty: "medium",
    minutes: 70,
    summary: "Latency masking, streaming states, citations and uncertainty, graceful failure, human-in-the-loop and undo.",
    tags: ["ai-ux", "streaming", "citations", "trust", "human-in-the-loop"],
    lesson: {
      hook: p(
        "Cortex takes 7 seconds to answer. For the first 2.5 seconds the user stares at a spinner, then text pours in. In testing, half your friends asked \"is it stuck?\" and one clicked submit again, which cost you a second LLM call.",
        "The model did not get faster. But a version that says \"Searching 214 documents... Reading 3 sources\" within 300 ms, streams the answer, and shows the three sources as clickable chips *feels* twice as fast and three times as trustworthy.",
        "You are already strong at UI. AI UX is the part of UI where the backend is slow, probabilistic and sometimes wrong, and the interface has to be honest about all three.",
      ),
      whyItMatters:
        "Users judge an AI product on perceived speed and trust long before they judge answer quality. These patterns are cheap to build and move retention more than most model upgrades.",
      levels: {
        l1: "AI features are slow, sometimes wrong, and occasionally fail. Good AI interfaces show progress immediately, stream results as they arrive, show where answers came from, let people stop, correct or undo what the AI did, and keep working in a reduced way when the AI is unavailable.",
        l2: {
          text: p(
            "A good AI interface behaves like a good junior colleague: says \"on it\" immediately, tells you what they are doing, shows their sources, says when they are unsure, asks before doing anything irreversible, and when something goes wrong, tells you plainly and keeps your work safe.",
            "A bad one behaves like a colleague who goes silent for 10 seconds, then hands you a confident paragraph with no references.",
          ),
          analogy: "The interface is the model's body language.",
          diagram: {
            type: "flow",
            title: "The same 7-second answer, two interfaces",
            lanes: [
              {
                label: "Spinner UX",
                tone: "bad",
                steps: [
                  { label: "Submit" },
                  { label: "Spinner 2.5 s", note: "is it stuck?" },
                  { label: "Wall of text" },
                  { label: "No sources", note: "trust it?", accent: true },
                ],
              },
              {
                label: "Staged UX",
                tone: "good",
                steps: [
                  { label: "Submit", note: "question echoed instantly" },
                  { label: "Status in 300 ms", note: "Searching 214 docs" },
                  { label: "Source chips appear", note: "before the answer" },
                  { label: "Answer streams", note: "Stop button, inline [1] cites", accent: true },
                  { label: "Feedback + copy + retry" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Latency masking.** Echo the user's input immediately (optimistic UI), show *specific* staged status (\"Reading notes.pdf\") rather than a generic spinner, and render retrieved sources before the answer starts. Time-to-first-token is the metric users feel; total time matters much less once text is moving.",
            "**Streaming with control.** Always offer Stop (abort the fetch; the server should cancel the upstream call to save money). Keep partial output if the stream fails. Disable double submit while a request is in flight.",
            "**Uncertainty and citations.** Inline `[1]` markers linked to the exact source passage beat a list of links at the bottom. When retrieval finds nothing relevant, say so (\"I couldn't find this in your documents\") instead of letting the model improvise.",
            "**Graceful failure and human-in-the-loop.** Errors say what happened and what is preserved (\"Your question is saved, retry?\"). Actions with side effects (sending an email, deleting a document, an agent calling a tool) show a preview and need a click. Prefer *undo* over *confirm* for reversible actions: confirmations get clicked through, undo actually protects people.",
            "One way to implement staged streaming is a small NDJSON event protocol: one JSON object per line, typed by `type`.",
          ),
          code: [
            {
              title: "app/api/ask/route.ts: stream typed events (status, citation, token, done, error)",
              lang: "typescript",
              code: `const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question: string };
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(enc.encode(JSON.stringify(e) + "\\n"));
      try {
        send({ type: "status", text: "Searching your documents" });
        await sleep(500);                                   // stand-in for retrieval
        send({ type: "citation", id: 1, title: "vector-db-notes.pdf, p. 4" });
        send({ type: "status", text: "Writing answer from 1 source" });
        const answer = "Here is what your notes say about: " + question + " [1]";
        for (const word of answer.split(" ")) {             // stand-in for LLM tokens
          if (req.signal.aborted) return;                   // user pressed Stop
          send({ type: "token", text: word + " " });
          await sleep(40);
        }
        send({ type: "done" });
      } catch {
        send({ type: "error", text: "The model is busy right now." });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}`,
            },
            {
              title: "useAsk(): staged status, streaming text, citations, Stop, keep partial output on failure",
              lang: "typescript",
              code: `"use client";
import { useRef, useState } from "react";

type Ev = { type: "status" | "token" | "citation" | "done" | "error"; text?: string; id?: number; title?: string };

export function useAsk() {
  const [status, setStatus] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Ev[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  async function ask(question: string) {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setAnswer(""); setSources([]); setError(null); setStatus("Thinking");
    try {
      const res = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ question }), signal: ctrl.current.signal });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\\n");
        buf = lines.pop() ?? "";                       // keep the incomplete last line
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line) as Ev;
          if (ev.type === "status") setStatus(ev.text ?? null);
          if (ev.type === "citation") setSources((s) => [...s, ev]);
          if (ev.type === "token") { setStatus(null); setAnswer((a) => a + ev.text); }
          if (ev.type === "error") setError(ev.text ?? "Something went wrong.");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Connection lost. Your partial answer is kept.");
    } finally {
      setStatus(null);
    }
  }
  return { ask, stop: () => ctrl.current?.abort(), status, answer, sources, error };
}`,
              note: "A network chunk can end mid-line, which is why the parser keeps the last partial line in buf. Forgetting this gives rare JSON.parse errors that only show up on slow networks.",
            },
          ],
        },
        l4: {
          text: p(
            "**Why perceived latency works.** Classic response-time research (Nielsen) gives three thresholds: ~0.1 s feels instant, ~1 s keeps flow of thought, ~10 s is the limit of attention. An LLM answer lives between 1 and 10 s, so the job is to put a *meaningful* change on screen before 1 s and keep something changing until done. Specific status text works better than a spinner because it is evidence of progress.",
            "**Citations are an engineering feature, not a UI flourish.** Number the retrieved chunks in the prompt (`[1] notes.pdf p.4: ...`), instruct the model to cite by number, then *validate on the server*: strip markers that point to sources you did not provide, and measure how many sentences are uncited. A high uncited ratio is a cheap live signal of hallucination risk you can show as \"partially supported\" in the UI and log for evals.",
            "**Undo implementation.** For deletes, soft-delete (`deleted_at`) and show a toast with Undo for ~10 s; a background job purges later. For agent actions, record an inverse operation or a snapshot before executing, so \"undo\" is a real command, not a hope.",
          ),
          code: [
            {
              title: "Validate citations on the server before rendering",
              lang: "typescript",
              code: `type Source = { n: number; chunkId: string; title: string };

const CITE = /\\[(\\d+)\\]/g;

export function checkCitations(answer: string, sources: Source[]) {
  const valid = new Set(sources.map((s) => s.n));
  const cited = [...answer.matchAll(CITE)].map((m) => Number(m[1]));
  const invalid = cited.filter((n) => !valid.has(n));

  const sentences = answer.split(/(?<=[.!?])\\s+/).filter((s) => s.trim().length > 0);
  const uncited = sentences.filter((s) => s.length > 40 && !/\\[\\d+\\]/.test(s));

  return {
    cleaned: answer.replace(CITE, (m, n) => (valid.has(Number(n)) ? m : "")),
    usedSources: sources.filter((s) => cited.includes(s.n)),
    invalid,
    uncitedRatio: sentences.length ? uncited.length / sentences.length : 0,
  };
}

const r = checkCitations(
  "HNSW trades memory for recall [1]. Use ef_search around 100 [3]. It is widely used in vector databases today.",
  [{ n: 1, chunkId: "c_91", title: "vector-db-notes.pdf" }],
);
console.log(r.invalid, r.uncitedRatio.toFixed(2), r.cleaned);`,
            },
          ],
        },
        l5: {
          question:
            "Your RAG product's answers take about 8 seconds and users say it 'feels slow and I'm not sure I can trust it'. You cannot change the model. What do you change, and how do you know it worked?",
          hint: "Split the problem into perceived latency and trust, and name a metric for each.",
          answer: p(
            "For perceived latency, I would measure time-to-first-meaningful-update and TTFT rather than total time. Then: echo the question instantly, stream staged status tied to real pipeline steps, show retrieved sources before generation starts, and stream tokens with a Stop button. On the backend I would parallelise retrieval steps and trim context to lower TTFT.",
            "For trust, I would add inline numbered citations linked to the exact passage, validate them server-side, and show an explicit 'not found in your documents' state instead of letting the model improvise. Feedback buttons and 'show the source' make the system's reasoning inspectable.",
            "To know it worked, I would A/B test by user: primary metric like the share of answers where the user opens a citation or copies the answer without regenerating; guardrails on regenerate rate, abandonment before first token, and cost per answer. Qualitatively, I would rerun the same five-user test and see if 'is it stuck?' disappears.",
          ),
        },
      },
      commonMistakes: [
        "A generic spinner with no progress information for multi-second operations.",
        "Showing sources as a list of links at the bottom that nobody can map to specific claims.",
        "Letting the model answer when retrieval found nothing, instead of designing an explicit 'I don't know' state.",
        "Confirmation dialogs for every AI action instead of previews for irreversible actions and undo for reversible ones.",
      ],
      tryThis:
        "Throttle your network to 'Slow 3G' in DevTools and use ChatGPT, Perplexity and one of your own apps. Write down the first thing that changes on screen after you submit, and when.",
      miniTask: {
        title: "Add staged streaming to a Next.js route",
        kind: "build",
        minutes: 40,
        steps: [
          "In any Next.js app (or a fresh `create-next-app`), add the L3 route handler at `app/api/ask/route.ts`.",
          "Add the `useAsk` hook and a page with an input, a status line, source chips, the answer and a Stop button.",
          "Throttle to Slow 3G and confirm status text appears before any tokens.",
          "Click Stop mid-answer and confirm the partial answer stays on screen and no error is shown.",
          "Make the route throw after 5 tokens and check the partial answer plus a friendly error both render.",
        ],
        checklist: [
          "A status message is visible within 500 ms of submit",
          "The source chip renders before the first answer token",
          "Stop aborts the request (visible as cancelled in the Network tab)",
          "Failure mid-stream keeps partial text and shows a human error message",
        ],
        deliverable: "A short screen recording of submit, stop and failure states.",
      },
      quiz: [
        {
          q: "Which metric best predicts whether a streamed AI answer 'feels fast'?",
          options: ["Total generation time", "Time to first meaningful update (status or token)", "Tokens per request", "Server CPU usage"],
          answer: 1,
          explain: "Once something meaningful is moving on screen, users tolerate a long total time. A blank screen for 3 s feels slower than a 10 s stream.",
        },
        {
          q: "For an AI action that deletes a user's document, which pattern is best?",
          options: [
            "Do it immediately; AI is usually right",
            "Show a confirmation modal every time",
            "Show a preview of what will be deleted and soft-delete with an Undo window",
            "Hide the action from the UI",
          ],
          answer: 2,
          explain: "Preview makes the action inspectable; soft delete plus Undo protects against mistakes without training users to click through confirmations.",
        },
        {
          q: "Why validate citation markers on the server?",
          options: [
            "To make the answer shorter",
            "Models sometimes cite sources that were never provided; stripping or flagging them prevents fake-looking evidence",
            "Browsers cannot render brackets",
            "It is required for streaming",
          ],
          answer: 1,
          explain: "A citation to a nonexistent source is worse than no citation: it borrows trust. Validation also yields an uncited-sentence ratio you can log as a quality signal.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, three techniques that make a slow AI answer feel fast and trustworthy without changing the model.",
      implementPrompt:
        "From memory, write a React hook that streams NDJSON events from a POST endpoint, handles partial lines, and exposes a stop() that aborts the request.",
      videos: [
        {
          title: "Designing AI product UX (AI Engineer)",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+conference+ai+ux+design+patterns",
          kind: "search",
          reason: "Watch this for how teams shipping AI products think about latency, trust and failure in the interface.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "web-performance",
    title: "Web performance for AI products",
    week: 23,
    domain: "frontend",
    skills: ["web-performance", "nextjs"],
    difficulty: "hard",
    minutes: 80,
    summary: "Core Web Vitals at p75, RSC and streaming SSR internals, client-boundary discipline, and why token streams wreck INP.",
    tags: ["core-web-vitals", "inp", "react-server-components", "streaming-ssr", "bundle-size"],
    lesson: {
      hook: p(
        "Cortex's chat page scores 98 on Lighthouse. Then real users report the input feels laggy while an answer streams. Field data says INP is 480 ms, which is 'needs improvement' and almost 'poor'.",
        "Lighthouse ran on an empty page. Users type while 60 tokens per second arrive, each one triggering `setState`, each one re-parsing the whole growing Markdown string and re-highlighting every code block. The main thread is busy, so their keystrokes wait.",
        "You know React and Next.js well. This topic is the next layer: what the browser and React are actually doing, and the performance problems that only AI interfaces have.",
      ),
      whyItMatters:
        "AI UIs combine heavy client libraries (Markdown, syntax highlighting, PDF viewers) with high-frequency updates. Without deliberate performance work they are the slowest pages in any product, and Core Web Vitals affect both UX and search ranking for your public pages.",
      levels: {
        l1: "Web performance is about three feelings: does the main content show up quickly, does the page react instantly when I click or type, and does stuff stay still instead of jumping around. Google measures these as LCP, INP and CLS on real users' devices. For AI pages the usual culprits are too much JavaScript and too many re-renders while text streams in.",
        l2: {
          text: p(
            "The browser's main thread is a single cashier. Every token update, every Markdown parse and every hydration task is a customer in the queue. When the user types, their keystroke joins the same queue. INP measures how long they wait.",
            "Server Components move work out of that queue entirely (it happens on the server and ships HTML, not JS). Batching and memoisation shrink the work each token causes.",
          ),
          analogy: "Performance work is reducing and shortening the tasks in front of the user's next click.",
          diagram: {
            type: "compare",
            title: "Where the milliseconds go in an AI chat page",
            left: {
              label: "Load (LCP)",
              points: [
                "Server response time (TTFB)",
                "Render-blocking CSS and fonts",
                "LCP element discovery (image priority, text in first HTML)",
                "JS needed before content shows (hydration)",
              ],
            },
            right: {
              label: "Interaction (INP)",
              points: [
                "setState per token (60/s)",
                "Re-parsing the whole Markdown string each update",
                "Syntax highlighting all code blocks again",
                "Long tasks from large client bundles",
              ],
            },
          },
        },
        l3: {
          text: p(
            "**The thresholds (at the 75th percentile of real page loads):** LCP good at or under 2.5 s, INP good at or under 200 ms (INP replaced FID as a Core Web Vital in March 2024), CLS good at or under 0.1. Lab tools (Lighthouse) cannot measure INP properly because nobody interacts; you need field data from `useReportWebVitals` or the Chrome UX Report.",
            "**Client boundary discipline.** `\"use client\"` marks the *root* of a client subtree: that component and everything it imports ships to the browser. Put the boundary at the leaves (the input, the stop button, the streaming answer), keep layouts, document lists and settings as Server Components, and pass server-rendered children *through* client components as `children` rather than importing them.",
            "**Streaming SSR.** Wrap slow server data (usage stats, recent chats) in `<Suspense>` so the shell and fast content flush first. The first HTML byte leaves the server as soon as the shell is ready, which directly improves TTFB and usually LCP.",
            "**Heavy libraries.** Load them only where and when needed: `next/dynamic` for a PDF viewer or chart, and do syntax highlighting on the server where possible (a Server Component using Shiki ships highlighted HTML and zero highlighter JS).",
          ),
          code: [
            {
              title: "Whole page as a client component: all JS ships, data waterfalls after hydration",
              lang: "typescript",
              variant: "bad",
              code: `"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";           // ships to every visitor
import { UsageChart } from "@/components/usage-chart"; // chart lib ships too

export default function LibraryPage() {
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then(setDocs);  // starts after hydration
  }, []);
  return (
    <main>
      {docs.map((d) => <ReactMarkdown key={d.id}>{"### " + d.title}</ReactMarkdown>)}
      <UsageChart />
    </main>
  );
}`,
            },
            {
              title: "Server Component page, Suspense for slow data, lazy heavy client island",
              lang: "typescript",
              variant: "good",
              code: `// app/library/page.tsx (Server Component: no "use client")
import { Suspense } from "react";
import { getDocuments, getUsage } from "@/lib/data";
import { UsageChartLazy } from "./usage-chart-lazy";

export default async function LibraryPage() {
  const docs = await getDocuments();                // runs on the server, fast indexed query
  return (
    <main className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ul>{docs.map((d) => <li key={d.id}>{d.title}</li>)}</ul>   {/* in first HTML: good LCP */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded bg-neutral-100" />}>
        <Usage />                                                   {/* streams in later */}
      </Suspense>
    </main>
  );
}

async function Usage() {
  const usage = await getUsage();                   // slow aggregate over the cost ledger
  return <UsageChartLazy data={usage} />;
}

// app/library/usage-chart-lazy.tsx
// "use client";
// import dynamic from "next/dynamic";
// export const UsageChartLazy = dynamic(() => import("@/components/usage-chart"), { ssr: false });`,
              note: "The fallback has a fixed height, so the chart streaming in does not shift the layout (CLS).",
            },
          ],
        },
        l4: {
          text: p(
            "**What streaming SSR sends.** The server flushes the shell HTML with the Suspense fallback in place. When `Usage` resolves, React writes the rendered HTML inside a hidden element in the *same* HTTP response, followed by a tiny inline script that swaps it into the fallback's position. RSC payload for hydration is streamed alongside in script tags. No extra request, no client fetch waterfall.",
            "**Why token streaming kills INP.** Each token calls `setState`, React re-renders the message, the Markdown renderer re-parses the *entire* growing string (O(n) per token, so O(n^2) per answer), and a highlighter re-tokenises every code block. At 60 tokens/s on a mid-range phone this becomes a stream of long tasks, and a keystroke that lands behind one waits.",
            "**Fixes, in order of impact:** (1) batch tokens into at most one state update per animation frame; (2) split the answer into blocks and memoise completed blocks so only the last one re-renders; (3) defer syntax highlighting until a code block is closed; (4) wrap the answer update in `startTransition` so typing in the input stays urgent; (5) measure with the Performance panel and `useReportWebVitals`, not intuition.",
          ),
          code: [
            {
              title: "Batch tokens per animation frame + memoise completed Markdown blocks",
              lang: "typescript",
              code: `"use client";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export function useFrameBufferedText() {
  const [text, setText] = useState("");
  const pending = useRef("");
  const frame = useRef<number | null>(null);

  const push = useCallback((token: string) => {
    pending.current += token;
    if (frame.current !== null) return;               // a flush is already scheduled
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const chunk = pending.current;
      pending.current = "";
      setText((t) => t + chunk);                      // at most one update per frame
    });
  }, []);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return { text, push };
}

const Block = memo(function Block({ md }: { md: string }) {
  return <ReactMarkdown>{md}</ReactMarkdown>;
});

export function StreamingMarkdown({ text }: { text: string }) {
  const blocks = text.split("\\n\\n");               // naive: fenced code with blank lines needs a real splitter
  return (
    <>
      {blocks.map((b, i) => <Block key={i} md={b} />)} {/* completed blocks keep the same props: skipped */}
    </>
  );
}`,
            },
            {
              title: "Send field Web Vitals to your own endpoint",
              lang: "typescript",
              code: `"use client";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    // metric.name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB"; rating: good | needs-improvement | poor
    const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, page: location.pathname });
    navigator.sendBeacon("/api/vitals", body);        // survives page unload
  });
  return null;
}`,
              note: "Render <WebVitals /> once in the root layout. Aggregate at p75 per page, which is how Google evaluates you.",
            },
          ],
        },
        l5: {
          question:
            "Your AI chat page has an LCP of 1.8 s but an INP of 450 ms, and the worst interactions happen while an answer is streaming. How do you diagnose and fix it?",
          hint: "LCP is fine, so this is a main-thread problem during streaming. What runs per token?",
          answer: p(
            "I would reproduce it with CPU throttling in the Performance panel while typing during a stream, and look at long tasks and the INP attribution in field data to confirm it is the input's event handling being delayed, not the handler itself.",
            "The usual cause is per-token work: a setState per token, a full Markdown re-parse of the whole answer each time, and syntax highlighting re-running on every code block. I would batch tokens to one update per animation frame, split the message into blocks and memoise completed ones so only the tail re-renders, defer highlighting until a code fence closes, and mark the streaming update as a transition so input updates stay urgent.",
            "Then I would check the bundle: if the Markdown and highlighter libraries are large, highlight on the server for history messages and load the client highlighter lazily. I would verify with field INP at p75 from useReportWebVitals before and after, not just a Lighthouse score, since Lighthouse cannot see this interaction.",
          ),
        },
      },
      commonMistakes: [
        "Trusting a Lighthouse score for INP; lab runs have no real interactions, so only field data tells the truth.",
        "Putting `\"use client\"` at the top of a page or layout, pulling the whole tree and its imports into the client bundle.",
        "Calling setState for every streamed token and re-rendering the full Markdown answer each time.",
        "Suspense fallbacks with no reserved size, so streamed content shifts the layout and hurts CLS.",
      ],
      tryThis:
        "Run `ANALYZE=true next build` with @next/bundle-analyzer (or read the route sizes printed by `next build`) on one of your projects and find the single largest client dependency. Is it needed on first load?",
      miniTask: {
        title: "Measure and fix a streaming re-render storm",
        kind: "build",
        minutes: 45,
        steps: [
          "Create a page that simulates a stream: a `setInterval` pushing a word every 15 ms into state, rendered with react-markdown, and include a fenced code block in the text.",
          "Record 5 seconds in the Chrome Performance panel with 4x CPU throttling while typing in an input on the same page; note long tasks.",
          "Replace per-token setState with the frame-buffered hook and the block-memoised renderer from L4.",
          "Record again under the same conditions and compare long tasks and input responsiveness.",
        ],
        checklist: [
          "Baseline recording shows long tasks (over 50 ms) during streaming",
          "The optimised version renders at most once per frame",
          "Completed blocks do not re-render (check with React DevTools 'Highlight updates')",
          "I wrote down before/after numbers for long tasks",
        ],
        deliverable: "Two Performance panel screenshots and a two-line before/after summary.",
      },
      quiz: [
        {
          q: "Which Core Web Vital replaced First Input Delay in March 2024?",
          options: ["Time to First Byte", "Interaction to Next Paint", "Total Blocking Time", "First Contentful Paint"],
          answer: 1,
          explain: "INP measures the latency of all interactions across the page's life (reported near the worst), not just the first one's input delay.",
        },
        {
          q: "A client component imports a server-only data module and a 200 KB chart library. What ships to the browser?",
          options: [
            "Nothing; Next.js tree-shakes it all",
            "Only the chart library",
            "Everything the client component imports becomes part of the client bundle (and server-only code will error)",
            "Only HTML",
          ],
          answer: 2,
          explain: "The \"use client\" boundary pulls all its imports into the client graph. Keep boundaries at the leaves and pass server content as children.",
        },
        {
          q: "Why does re-rendering the full Markdown string on each token become slow for long answers?",
          options: [
            "Markdown is parsed on the GPU",
            "Each update re-parses the whole string, so total work grows quadratically with answer length",
            "React cannot render Markdown",
            "Tokens arrive out of order",
          ],
          answer: 1,
          explain: "n tokens x O(n) parse per update is O(n^2). Memoising completed blocks makes each update proportional to the last block only.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, why an AI chat page can score well on Lighthouse but feel laggy for real users, and two fixes.",
      implementPrompt:
        "From memory, write a React hook that buffers streamed tokens and flushes them to state at most once per animation frame.",
      videos: [
        {
          title: "Interaction to Next Paint explained (Chrome for Developers)",
          channel: "Chrome for Developers",
          url: "https://www.youtube.com/results?search_query=chrome+for+developers+interaction+to+next+paint+inp",
          kind: "search",
          reason: "Watch this for how INP is measured and how to read its attribution in DevTools.",
        },
        {
          title: "React Server Components and streaming in Next.js",
          channel: "Vercel",
          url: "https://www.youtube.com/results?search_query=vercel+next.js+server+components+streaming+suspense",
          kind: "search",
          reason: "Watch this if the relationship between Suspense, streaming SSR and the RSC payload is still hazy.",
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  {
    slug: "cost-aware-ai-products",
    title: "Product metrics & cost-aware AI design",
    week: 23,
    domain: "product",
    skills: ["product-metrics", "ai-system-design"],
    difficulty: "medium",
    minutes: 70,
    summary: "Unit economics per request and per user, north-star metrics, A/B testing AI features, and how eval metrics relate to product metrics.",
    tags: ["unit-economics", "north-star", "ab-testing", "llm-cost", "evals"],
    lesson: {
      hook: p(
        "Suppose you charge USD 8/month for Cortex Pro. A power user asks 40 questions a day, each sending 6,000 tokens of retrieved context to a frontier model. Do the maths and that single user costs you more than they pay, every month.",
        "In a normal SaaS app, serving one more request costs almost nothing. In an AI product, every request has a real, variable cost, and your most engaged users are your most expensive. Product decisions (how many chunks to retrieve, which model, whether to auto-summarise every upload) are pricing decisions.",
        "The second trap is measuring the wrong thing. Your eval score went from 0.81 to 0.86. Did users notice? Did they come back more?",
      ),
      whyItMatters:
        "AI engineers who can reason about cost per request, pick the metric that reflects user value, and run a clean experiment are the ones trusted to own products, not just features.",
      levels: {
        l1: "Every AI answer costs money, depending on how much text you send in and get back and which model you use. You need to know what one answer costs and what one user costs per month, compared with what they pay. You also need one main number that shows users are getting value, and experiments that prove a change improved it.",
        l2: {
          text: p(
            "Think of each AI request as a taxi ride where the meter runs on tokens. A cheap model is a hatchback, a frontier model is a limousine. Most trips do not need the limousine, and the longest trips are usually the ones where you loaded too much luggage (context) into the boot.",
            "Eval metrics tell you whether the driver takes good routes on a test track. Product metrics tell you whether passengers book again.",
          ),
          analogy: "Tokens are the taxi meter; retention is whether they call you again.",
          diagram: {
            type: "stack",
            title: "Metrics from model to business",
            layers: [
              { label: "Business", note: "gross margin, revenue per user, churn" },
              { label: "North star", note: "weekly users with an answer they relied on", accent: true },
              { label: "Product / engagement", note: "questions per WAU, citation clicks, regenerate rate" },
              { label: "Guardrails", note: "p95 latency, error rate, cost per answer" },
              { label: "Offline evals", note: "faithfulness, retrieval recall@k, answer relevance" },
            ],
          },
        },
        l3: {
          text: p(
            "**Unit economics.** Cost per request = input tokens x input price + output tokens x output price (+ embedding, reranking, vector DB, compute). Input usually dominates in RAG because retrieved context is large. Multiply by requests per user per month and compare with revenue per user.",
            "**Levers, cheapest first:** retrieve fewer, better chunks (a reranker often halves context with no quality loss); put the stable part of the prompt first so provider prompt caching discounts it; cap max_tokens and ask for concise answers; route easy queries to a small model; cache exact repeats; batch offline work (summaries, evals) through batch APIs at a discount.",
            "**North-star metric**: one number that captures delivered value and leads revenue. For Cortex, 'weekly active users who got an answer they acted on' (opened a citation, copied, or did not regenerate) is better than 'questions asked', which rises when answers are bad and people rephrase.",
          ),
          code: [
            {
              title: "Cost per answer and per user per month (illustrative prices, check current pricing)",
              lang: "python",
              code: `from dataclasses import dataclass

@dataclass
class Model:
    name: str
    usd_in: float        # per 1M input tokens
    usd_out: float       # per 1M output tokens
    usd_cached_in: float # per 1M cached input tokens

SMALL = Model("small", 0.15, 0.60, 0.075)
FRONTIER = Model("frontier", 3.00, 15.00, 0.30)

def cost_per_answer(m: Model, tokens_in: int, tokens_out: int, cached_frac: float = 0.0) -> float:
    cached = tokens_in * cached_frac
    return ((tokens_in - cached) * m.usd_in + cached * m.usd_cached_in + tokens_out * m.usd_out) / 1e6

def per_user_month(m: Model, answers_per_day: int, **kw) -> float:
    return cost_per_answer(m, **kw) * answers_per_day * 30

for m in (SMALL, FRONTIER):
    naive = per_user_month(m, 40, tokens_in=6000, tokens_out=500)
    tuned = per_user_month(m, 40, tokens_in=2500, tokens_out=300, cached_frac=0.5)
    print(f"{m.name:9s} naive USD {naive:6.2f}/user/mo   tuned USD {tuned:6.2f}/user/mo")

# routing: 85% of questions to SMALL, 15% escalated to FRONTIER
mix = 0.85 * per_user_month(SMALL, 40, tokens_in=2500, tokens_out=300, cached_frac=0.5) \\
    + 0.15 * per_user_month(FRONTIER, 40, tokens_in=2500, tokens_out=300, cached_frac=0.5)
print(f"routed    USD {mix:6.2f}/user/mo vs USD 8.00 price")`,
              note: "A heavy user on a naive frontier setup costs about USD 31/month against USD 8 of revenue. Trimming context and prompt caching gets that to about USD 10; routing most questions to a small model brings it to about USD 2. That is the difference between a business and a hobby.",
            },
          ],
        },
        l4: {
          text: p(
            "**A/B testing AI features.** Randomise by *user*, not request, or one person sees both variants and contaminates both arms. Pick one primary metric decided in advance, plus guardrails (latency, cost per answer, error rate) that must not regress. LLM non-determinism adds variance, so you need enough users: for a conversion-style metric, per-arm sample size is roughly `2 (z_a + z_b)^2 p(1-p) / delta^2`.",
            "Worked example: baseline 30% of answers get a citation click, you care about a 3-point lift. With 95% confidence and 80% power (z = 1.96 and 0.84) that is about 3,760 users per arm. Cortex will not have that for a while, which is itself a finding: at small scale, rely on offline evals and qualitative sessions, and reserve A/B tests for big changes.",
            "**Eval metrics vs product metrics.** Offline evals (faithfulness, retrieval recall@k) are fast, cheap and run before shipping; they gate regressions. Product metrics are slow and noisy but are what matters. The link between them is an assumption you must check: if faithfulness improves but citation clicks and retention do not move, either the eval measures the wrong thing or quality was not the bottleneck.",
          ),
          code: [
            {
              title: "Sample size and a two-proportion z-test, standard library only",
              lang: "python",
              code: `from math import ceil, erf, sqrt

def norm_cdf(z: float) -> float:
    return 0.5 * (1 + erf(z / sqrt(2)))

def sample_size_per_arm(p_base: float, lift: float, z_alpha=1.96, z_beta=0.84) -> int:
    p = p_base + lift / 2                              # average rate across arms
    return ceil(2 * (z_alpha + z_beta) ** 2 * p * (1 - p) / lift ** 2)

def two_proportion_test(x_a: int, n_a: int, x_b: int, n_b: int):
    pa, pb = x_a / n_a, x_b / n_b
    pooled = (x_a + x_b) / (n_a + n_b)
    se = sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    z = (pb - pa) / se
    p_value = 2 * (1 - norm_cdf(abs(z)))
    return round(pb - pa, 4), round(z, 2), round(p_value, 4)

print("users per arm:", sample_size_per_arm(0.30, 0.03))       # ~3,760
# control: 1,110 of 3,760 clicked a citation; variant with reranker: 1,240 of 3,760
print("lift, z, p:", two_proportion_test(1110, 3760, 1240, 3760))`,
            },
          ],
        },
        l5: {
          question:
            "Your team wants to switch Cortex's answer model to a new frontier model that scored 6 points higher on your offline eval, but costs 10x more. How do you decide?",
          hint: "Cost per user vs revenue, whether the eval gain shows up in product metrics, and cheaper alternatives.",
          answer: p(
            "First the economics: compute cost per answer and per active user per month with the new model using real token distributions from the ledger, and compare with revenue per user. If heavy users become unprofitable, a blanket switch is off the table regardless of quality.",
            "Second, check whether the eval gain matters: look at which eval cases improved and whether they resemble real traffic, then run a user-randomised experiment (or, at small scale, a routed shadow test plus qualitative review) with a pre-registered primary metric such as the share of answers users act on, and guardrails on latency and cost per answer.",
            "Third, consider targeted use: route only hard queries (low retrieval confidence, long multi-document questions, or user-requested 'deep answer') to the expensive model, and keep the small model for the rest. Often that captures most of the quality gain at a fraction of the cost. I would decide based on margin per user and the experiment result, not the eval score alone.",
          ),
        },
      },
      commonMistakes: [
        "Tracking LLM cost only as a monthly total, never per request, per feature or per user, so nobody knows which feature is expensive.",
        "Choosing 'number of questions' as a north star, which rises when answers are bad and users rephrase.",
        "Randomising experiments per request instead of per user, contaminating both arms.",
        "Shipping on an offline eval gain without checking any product metric moved, or on a product metric without a cost guardrail.",
      ],
      tryThis:
        "Run the cost script with your real numbers from ZtudyLock or IdeaGuard (average prompt and response lengths, requests per active user). What would a heavy user cost you per month?",
      miniTask: {
        title: "Write Cortex's metrics and unit-economics sheet",
        kind: "explain",
        minutes: 35,
        steps: [
          "From your gateway ledger (or estimates), write the average input and output tokens per answer and answers per active user per day.",
          "Compute cost per answer and cost per user per month for the current model with the L3 script.",
          "Define Cortex's north-star metric and how you would compute it from events you already log or could log.",
          "List three guardrail metrics with thresholds (e.g. p95 latency under 6 s).",
          "Name the two cheapest cost levers for Cortex and estimate their saving.",
        ],
        checklist: [
          "Cost per answer and per user per month are computed with the arithmetic shown",
          "The north-star metric is defined precisely enough to write the SQL for it",
          "Three guardrails have numeric thresholds",
          "Two cost levers have an estimated percentage saving",
        ],
        deliverable: "A one-page metrics sheet saved in the Cortex repo as docs/metrics.md.",
      },
      quiz: [
        {
          q: "In a typical RAG request, which component usually dominates token cost?",
          options: ["The user's question", "Retrieved context in the input", "The system prompt only", "Streaming overhead"],
          answer: 1,
          explain: "Retrieved chunks are often thousands of tokens versus a question of tens. Better retrieval and reranking are cost levers, not just quality levers.",
        },
        {
          q: "Why should AI feature experiments randomise by user rather than by request?",
          options: [
            "It needs fewer servers",
            "A user seeing both variants contaminates the comparison and breaks independence",
            "Requests cannot be randomised",
            "LLMs are deterministic per user",
          ],
          answer: 1,
          explain: "Behaviour like returning next week depends on the whole experience; mixing variants within a user blurs both arms.",
        },
        {
          q: "Offline faithfulness improved but citation clicks and retention did not move. What is the most reasonable conclusion?",
          options: [
            "The experiment is broken",
            "Either the eval does not capture what users value, or quality was not the bottleneck",
            "Retention metrics are useless for AI",
            "Ship a bigger model",
          ],
          answer: 1,
          explain: "Eval metrics are proxies. When a proxy moves and the outcome does not, question the proxy or look for the real bottleneck (latency, UX, coverage).",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, why an AI product's most engaged users can be its least profitable, and two ways to fix it.",
      implementPrompt:
        "From memory, write a function that computes cost per answer from input, output and cached tokens, and a two-proportion z-test.",
      videos: [
        {
          title: "A/B testing and statistical significance (StatQuest)",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+p+values+hypothesis+testing",
          kind: "search",
          reason: "Watch this if the p-value and power ideas behind the sample-size formula feel shaky.",
        },
        {
          title: "Evals vs product metrics (Hamel Husain)",
          channel: "Hamel Husain",
          url: "https://www.youtube.com/results?search_query=hamel+husain+llm+evals",
          kind: "search",
          reason: "Watch this for how practitioners connect offline evals to what users actually experience.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "ai-ux-teardown",
    title: "AI UX teardown + one redesign",
    week: 23,
    duration: "45m",
    minutes: 45,
    difficulty: "easy",
    domain: "frontend",
    skills: ["ai-ux", "ui-ux"],
    prerequisites: ["AI UX patterns"],
    topicSlugs: ["ai-ux-patterns"],
    objective:
      "Tear down three shipping AI products on latency, trust and failure, then redesign one screen of your own (IdeaGuard, ZtudyLock or Ideako) using what you found.",
    expectedOutput:
      "A teardown table for three products with timings and screenshots, plus a before/after of one screen from your own project with annotated changes, committed as `docs/ai-ux-teardown.md` in that project's repo.",
    steps: [
      {
        title: "Pick three products and one task (5 min)",
        detail:
          "Choose three different AI products (for example a chat assistant, an answer engine with citations, and an AI feature inside a normal app such as a code editor or writing tool). Pick one realistic task you can run in all three, e.g. 'summarise this article and tell me where the claim about X comes from'.",
      },
      {
        title: "Measure latency behaviour (10 min)",
        detail:
          "With DevTools open and throttling on Fast 4G, run the task in each product. Record: time to first visible change, what that change was (status text, skeleton, token), time to first token, and whether a Stop control exists. A screen recording makes timing easy to read afterwards.",
      },
      {
        title: "Probe trust and failure (10 min)",
        detail:
          "Ask a question each product cannot answer well (about a private fact, or a very recent event). Note how it shows uncertainty, whether sources are specific (passage-level) or vague (link list), and what happens if you go offline mid-answer. Fill the teardown table.",
      },
      {
        title: "Audit one screen of your own project (10 min)",
        detail:
          "Open the main AI screen of IdeaGuard, ZtudyLock or Ideako and score it with the same rows. Be honest: most first versions have a spinner, no stop, no sources and a generic error.",
      },
      {
        title: "Redesign it (10 min)",
        detail:
          "Sketch (Figma or paper) the improved screen: staged status, streaming, stop, sources or rationale, an explicit uncertain state, a helpful error with preserved input, and undo or preview for any action the AI takes. Annotate each change with the pattern name.",
      },
    ],
    hints: [
      "Measure, don't guess: a screen recording at 60 fps lets you step frame by frame to find the first visual change.",
      "For IdeaGuard-style 'analysis' products, showing the criteria being checked as live steps is the equivalent of showing sources.",
      "Steal shamelessly, but write down why a pattern works, not just that it exists.",
    ],
    stretch:
      "Implement the redesign's two cheapest changes (staged status and Stop) in the real project and measure time to first visible change before and after.",
    learned: [
      "How leading AI products handle latency, uncertainty and failure in practice",
      "A repeatable rubric for evaluating AI UX",
      "How to translate patterns into concrete changes on your own product",
    ],
    starter: {
      title: "Teardown table template",
      lang: "text",
      code: `Task used in all products: ______________________________

| Row                           | Product A | Product B | Product C | My app (before) |
|-------------------------------|-----------|-----------|-----------|-----------------|
| First visible change (ms)     |           |           |           |                 |
| What changed first            |           |           |           |                 |
| Time to first token (ms)      |           |           |           |                 |
| Stop / cancel available       |           |           |           |                 |
| Sources: none / list / inline |           |           |           |                 |
| Uncertain / not-found state   |           |           |           |                 |
| Offline mid-answer behaviour  |           |           |           |                 |
| Actions: preview / undo       |           |           |           |                 |
| Best idea to steal            |           |           |           |                 |

Redesign changes (pattern -> change -> expected effect):
1.
2.
3.`,
    },
  },
];
