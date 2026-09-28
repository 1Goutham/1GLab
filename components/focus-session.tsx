"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Pause, Play, X } from "lucide-react";
import { finishFocus, startFocus } from "@/lib/actions/daily";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Focus mode. Everything else disappears: the mission, a countdown, and a
 * single line of progress. At the end: what did you learn, what went wrong,
 * how confident are you — and progress updates from that.
 */
export function FocusSession({
  title,
  mission,
  refType,
  refId,
  minutes,
  workHref,
}: {
  title: string;
  mission: string | null;
  refType: string | null;
  refId: string | null;
  minutes: number;
  workHref: string;
}) {
  const [phase, setPhase] = useState<"ready" | "running" | "reflect" | "done">("ready");
  const [planned, setPlanned] = useState(minutes);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [id, setId] = useState<number | null>(null);
  const [learned, setLearned] = useState("");
  const [wrong, setWrong] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef<number>(0);
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (phase !== "running" || paused) return;
    const t = setInterval(() => {
      const e = Math.floor((Date.now() - startedAt.current - pausedTotal.current) / 1000);
      setElapsed(e);
      if (e >= planned * 60) setPhase("reflect");
    }, 250);
    return () => clearInterval(t);
  }, [phase, paused, planned]);

  const remaining = Math.max(0, planned * 60 - elapsed);

  useEffect(() => {
    document.title = phase === "running" ? `${fmt(remaining)} · ${title}` : "Focus";
  }, [remaining, phase, title]);

  const begin = () =>
    start(async () => {
      const res = await startFocus({ title, mission, refType, refId, plannedMinutes: planned });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      setId(res.data.id);
      startedAt.current = Date.now();
      pausedTotal.current = 0;
      setPhase("running");
    });

  const togglePause = () => {
    if (paused && pausedAt.current) {
      pausedTotal.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    } else pausedAt.current = Date.now();
    setPaused((p) => !p);
  };

  const finish = () =>
    start(async () => {
      if (!id) return;
      const res = await finishFocus({ id, actualMinutes: Math.round(elapsed / 60), learned, wentWrong: wrong, confidence });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      toastFeedback(res.data);
      setPhase("done");
    });

  const progress = planned ? Math.min(1, elapsed / (planned * 60)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#030304]">
      <motion.div className="absolute inset-x-0 top-0 h-[2px] bg-accent" style={{ scaleX: progress, originX: 0 }} />
      <div className="flex items-center justify-between px-6 py-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Focus mode</span>
        {phase !== "running" ? (
          <Link href={workHref} className="grid size-9 place-items-center rounded-full text-faint hover:bg-white/5 hover:text-fg" aria-label="Exit focus mode">
            <X className="size-4" />
          </Link>
        ) : (
          <button onClick={() => setPhase("reflect")} className="font-mono text-[11px] text-faint hover:text-muted">
            end early →
          </button>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {(phase === "ready" || phase === "running") && (
            <motion.div key="timer" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.7, ease }} className="w-full max-w-3xl text-center">
              <h1 className="font-display text-3xl font-light uppercase tracking-[0.08em] text-white md:text-5xl">{title}</h1>
              <div className={cn("mt-10 font-mono text-[72px] font-extralight tabular-nums leading-none tracking-tight md:text-[128px]", paused ? "text-muted" : "text-white")}>
                {fmt(phase === "ready" ? planned * 60 : remaining)}
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{phase === "ready" ? "planned" : paused ? "paused" : "remaining"}</div>
              {mission && (
                <p className="mx-auto mt-10 max-w-xl text-[16px] leading-relaxed text-muted">
                  <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-[0.2em] text-faint">Mission</span>
                  {mission}
                </p>
              )}
              <div className="mt-12 flex items-center justify-center gap-3">
                {phase === "ready" ? (
                  <>
                    <div className="flex rounded-lg border border-line p-0.5">
                      {[25, 45, 60, 90].map((m) => (
                        <button key={m} onClick={() => setPlanned(m)} className={cn("rounded-md px-3 py-1.5 font-mono text-[12px]", planned === m ? "bg-white/10 text-fg" : "text-faint")}>
                          {m}m
                        </button>
                      ))}
                    </div>
                    <Button variant="primary" size="lg" onClick={begin} disabled={pending}>
                      <Play className="size-4" /> Start
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" onClick={togglePause}>
                      {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                      {paused ? "Resume" : "Pause"}
                    </Button>
                    <a href={workHref} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 text-[13px] text-faint hover:text-muted">
                      Open the material <ArrowUpRight className="size-3.5" />
                    </a>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {phase === "reflect" && (
            <motion.div key="reflect" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease }} className="w-full max-w-xl">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{Math.round(elapsed / 60)} minutes of deep work</div>
              <h2 className="mt-3 font-display text-4xl font-extralight text-white">Before you go —</h2>
              <label className="mt-8 block">
                <span className="font-display text-[18px] font-light text-fg">What did you learn?</span>
                <textarea value={learned} onChange={(e) => setLearned(e.target.value)} rows={3} className="box-input mt-3" />
              </label>
              <label className="mt-6 block">
                <span className="font-display text-[18px] font-light text-fg">What went wrong?</span>
                <textarea value={wrong} onChange={(e) => setWrong(e.target.value)} rows={2} className="box-input mt-3" />
              </label>
              <div className="mt-6">
                <span className="font-display text-[18px] font-light text-fg">Confidence?</span>
                <div className="mt-3 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setConfidence(n)} className={cn("tactile h-10 flex-1 rounded-md border font-mono", confidence && n <= confidence ? "border-accent/40 bg-accent/10 text-accent" : "border-line-strong text-faint")}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="primary" size="lg" className="mt-8 w-full" onClick={finish} disabled={pending}>
                Save and update progress
              </Button>
              <p className="mt-3 text-center text-[12px] text-faint">Your answers go into today&apos;s journal.</p>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <motion.div className="mx-auto h-px w-64 bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease }} />
              <h2 className="mt-8 font-display text-4xl font-extralight text-white">Session logged.</h2>
              <div className="mt-8 flex justify-center gap-3">
                <Button variant="primary" onClick={() => router.push(workHref)}>
                  Continue the work
                </Button>
                <Button onClick={() => router.push("/")}>Back to today</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
