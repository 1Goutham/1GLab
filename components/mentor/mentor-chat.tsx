"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUp, Plus, Square } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = { id: string; label: string; blurb: string; starter: string };

/**
 * The mentor. Streams replies, remembers conversations, and keeps a topic
 * attached when you arrive from a lesson. Falls back to curriculum-grounded
 * offline answers when no model is configured.
 */
export function MentorChat({
  ai,
  conversationId: initialId,
  initialMessages,
  initialMode,
  topic,
  modes,
  conversations,
}: {
  ai: { online: boolean; provider: string; model: string | null };
  conversationId: number | null;
  initialMessages: Msg[];
  initialMode: string;
  topic: { id: string; title: string } | null;
  modes: Mode[];
  conversations: { id: number; title: string; mode: string; updatedAt: string }[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [mode, setMode] = useState(initialMode);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(initialId);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const locked = messages.length > 0;
  const current = modes.find((m) => m.id === mode)!;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    setStreaming(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convId, mode, message: content, topicId: topic?.id ?? null }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Your mentor is taking a short break. You can continue today's mission offline." }));
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: err.error }]);
        return;
      }
      const id = Number(res.headers.get("x-conversation-id"));
      if (id && !convId) {
        setConvId(id);
        window.history.replaceState(null, "", `/mentor?c=${id}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const text = acc;
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Your mentor is taking a short break. You can continue today's mission offline." }]);
    } finally {
      setStreaming(false);
      abort.current = null;
      router.refresh();
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Link href="/mentor" className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-[13px] text-fg hover:border-white/25">
          <Plus className="size-3.5" /> New conversation
        </Link>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">History</div>
        <ul className="mt-2 space-y-0.5">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/mentor?c=${c.id}`} className={cn("block rounded-md px-2 py-1.5 text-[12.5px] leading-snug hover:bg-white/[0.04]", c.id === convId ? "bg-white/[0.05] text-fg" : "text-muted")}>
                <span className="line-clamp-2">{c.title}</span>
                <span className="font-mono text-[10px] uppercase text-faint">{c.mode}</span>
              </Link>
            </li>
          ))}
          {conversations.length === 0 && <li className="px-2 text-[12.5px] text-faint">No conversations yet.</li>}
        </ul>
      </aside>

      <div className="flex min-h-[calc(100dvh-160px)] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              <span className={cn("size-1.5 rounded-full", ai.online ? "pulse-dot bg-accent" : "bg-warn")} />
              {ai.online ? `Mentor · ${ai.provider}` : "Mentor · offline mode"}
            </div>
            <h1 className="mt-2 font-display text-3xl font-light text-white">{current.label}</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {current.blurb}
              {topic && (
                <>
                  {" "}
                  · on{" "}
                  <Link href={`/learn/${topic.id}`} className="text-fg hover:text-accent">
                    {topic.title}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {modes.map((m) => (
              <button
                key={m.id}
                disabled={locked}
                onClick={() => setMode(m.id)}
                title={locked ? "Start a new conversation to switch modes" : m.blurb}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] transition-colors disabled:cursor-default",
                  mode === m.id ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:text-fg disabled:opacity-40 disabled:hover:text-muted",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 py-8">
          {messages.length === 0 ? (
            <div className="max-w-xl">
              <p className="font-display text-[22px] font-light leading-snug text-white">
                A demanding but helpful senior engineer. Starts simple, then tests you — and raises the bar when you pass.
              </p>
              {!ai.online && (
                <p className="mt-4 text-[13.5px] text-warn/90">
                  No AI key configured, so the mentor answers from your curriculum — layered explanations and quiz checks still work. Add a key in <code className="font-mono">.env.local</code> for full conversations.
                </p>
              )}
              <div className="mt-8 space-y-2">
                {[current.starter, ...modes.filter((m) => m.id !== mode).slice(0, 2).map((m) => m.starter)].map((s, i) => (
                  <button
                    key={s}
                    onClick={() => (i === 0 ? send(topic ? `${s.replace(/self-attention/i, topic.title)}` : s) : setInput(s))}
                    className="group flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 text-left text-[14px] text-muted hover:border-line-strong hover:text-fg"
                  >
                    {i === 0 && topic ? s.replace(/self-attention/i, topic.title) : s}
                    <ArrowUp className="size-3.5 rotate-45 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className={cn(m.role === "user" && "flex justify-end")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.06] px-4 py-2.5 text-[14.5px] leading-relaxed text-fg">{m.content}</div>
                  ) : (
                    <div className="max-w-[720px]">
                      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent/80">Mentor</div>
                      {m.content ? (
                        <Markdown className="text-[15px]">{m.content}</Markdown>
                      ) : (
                        <span className="inline-flex gap-1">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="pulse-dot size-1.5 rounded-full bg-muted" style={{ animationDelay: `${d * 0.2}s` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={bottom} />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="sticky bottom-20 rounded-2xl border border-line-strong bg-[#0c0c0f]/95 p-2 backdrop-blur lg:bottom-4"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={Math.min(8, Math.max(1, input.split("\n").length))}
              placeholder={mode === "interview" ? "Say “ready” to start the interview…" : "Ask, answer, or paste an error…"}
              className="max-h-60 flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] text-fg outline-none placeholder:text-faint"
            />
            {streaming ? (
              <button type="button" onClick={() => abort.current?.abort()} className="grid size-10 place-items-center rounded-xl bg-white/10 text-fg" aria-label="Stop">
                <Square className="size-3.5" />
              </button>
            ) : (
              <button disabled={!input.trim()} className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink disabled:bg-white/10 disabled:text-faint" aria-label="Send">
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
