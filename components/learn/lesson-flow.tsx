"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Check, Lock } from "lucide-react";
import { reachLevel } from "@/lib/actions/learn";
import { cn } from "@/lib/cn";

export const LEVELS = [
  { n: 1, name: "Explain like I'm smart but new", short: "Simple" },
  { n: 2, name: "Mental model", short: "Model" },
  { n: 3, name: "Technical", short: "Technical" },
  { n: 4, name: "Under the hood", short: "Internals" },
  { n: 5, name: "Interview question", short: "Interview" },
];

/**
 * Progressive disclosure. WHY and Level 1 are open; each deeper level opens
 * when you say you understood the one before. Progress is saved per level so
 * returning tomorrow picks up exactly where you stopped.
 */
export function LessonFlow({
  topicId,
  initialLevel,
  why,
  levels,
  after,
}: {
  topicId: string;
  initialLevel: number;
  why: React.ReactNode;
  levels: React.ReactNode[];
  after: React.ReactNode;
}) {
  const [reached, setReached] = useState(initialLevel);
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Open = everything reached, plus the next one.
  const open = Math.min(5, Math.max(1, reached + 1));

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.level));
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [open]);

  const understood = (n: number) => {
    setReached((r) => Math.max(r, n));
    start(async () => {
      await reachLevel({ topicId, level: n });
    });
    setTimeout(() => refs.current[n + 1]?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-14">
      {/* Level rail */}
      <nav className="hidden lg:block" aria-label="Lesson levels">
        <div className="sticky top-10 space-y-1">
          <RailItem label="Why" state={active === 0 ? "active" : "done"} onClick={() => refs.current[0]?.scrollIntoView({ behavior: "smooth" })} />
          {LEVELS.map((l) => (
            <RailItem
              key={l.n}
              label={`L${l.n} · ${l.short}`}
              state={l.n > open ? "locked" : active === l.n ? "active" : l.n <= reached ? "done" : "open"}
              onClick={() => l.n <= open && refs.current[l.n]?.scrollIntoView({ behavior: "smooth" })}
            />
          ))}
          <div className="my-3 h-px bg-line" />
          <a href="#mini-task" className="block px-3 py-1.5 font-mono text-[11.5px] text-muted hover:text-fg">
            Mini task
          </a>
          <a href="#complete" className="block px-3 py-1.5 font-mono text-[11.5px] text-muted hover:text-fg">
            Reflect
          </a>
        </div>
      </nav>

      <div className="min-w-0 max-w-[760px]">
        <section ref={(el) => void (refs.current[0] = el)} data-level={0} className="scroll-mt-24">
          <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Why</div>
          {why}
        </section>

        {LEVELS.map((l, i) => {
          const isOpen = l.n <= open;
          return (
            <section key={l.n} ref={(el) => void (refs.current[l.n] = el)} data-level={l.n} className="mt-16 scroll-mt-24">
              <div className="mb-5 flex items-center gap-3 border-t border-line pt-6">
                <span className={cn("font-mono text-[11px] tracking-[0.16em]", isOpen ? "text-muted" : "text-faint")}>LEVEL {l.n}</span>
                <span className="h-px w-3 bg-line-strong" />
                <span className={cn("font-mono text-[11px] uppercase tracking-[0.16em]", isOpen ? "text-fg" : "text-faint")}>{l.name}</span>
                {l.n <= reached && <Check className="size-3.5 text-accent" />}
                {!isOpen && <Lock className="size-3 text-faint" />}
              </div>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="open"
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {levels[i]}
                    {l.n < 5 && l.n > reached && (
                      <button
                        onClick={() => understood(l.n)}
                        disabled={pending}
                        className="tactile group mt-9 flex items-center gap-3 rounded-full border border-line-strong py-2 pl-4 pr-3 text-[13.5px] text-fg hover:border-accent/50"
                      >
                        {l.n === 1 ? "Got it — show me the mental model" : l.n === 2 ? "Clear — show me the real engineering" : l.n === 3 ? "Understood — take me under the hood" : "Ready for the interview question"}
                        <ArrowDown className="size-4 text-accent transition-transform group-hover:translate-y-0.5" />
                      </button>
                    )}
                    {l.n === 5 && reached < 5 && (
                      <button onClick={() => understood(5)} className="mt-6 font-mono text-[12px] text-faint hover:text-muted">
                        mark level 5 as understood →
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.p key="locked" className="text-[14px] text-faint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Opens when you&apos;ve got level {l.n - 1}. Depth is earned in order.
                  </motion.p>
                )}
              </AnimatePresence>
            </section>
          );
        })}

        {after}
      </div>
    </div>
  );
}

function RailItem({ label, state, onClick }: { label: string; state: "done" | "active" | "open" | "locked"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={state === "locked"}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left font-mono text-[11.5px] transition-colors",
        state === "active" && "bg-white/[0.05] text-white",
        state === "done" && "text-muted hover:text-fg",
        state === "open" && "text-fg hover:bg-white/[0.03]",
        state === "locked" && "cursor-default text-faint/70",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "active" ? "bg-accent" : state === "done" ? "bg-accent/50" : state === "open" ? "bg-white/50" : "bg-white/15",
        )}
      />
      {label}
    </button>
  );
}
