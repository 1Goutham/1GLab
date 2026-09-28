"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lightbulb } from "lucide-react";
import { completeLab, revealHint, startLab, toggleLabStep } from "@/lib/actions/labs";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Initial = { status: string; stepsDone: number[]; hintsUsed: number; notes: string; repoUrl: string };

export function LabWorkbench({
  labId,
  steps,
  hints,
  initial,
  stretch,
  learned,
}: {
  labId: string;
  steps: { title: string; detail: React.ReactNode }[];
  hints: string[];
  initial: Initial;
  stretch: string;
  learned: string[];
}) {
  const [status, setStatus] = useState(initial.status);
  const [done, setDone] = useState(initial.stepsDone);
  const [hintsShown, setHintsShown] = useState(initial.hintsUsed);
  const [notes, setNotes] = useState(initial.notes);
  const [repo, setRepo] = useState(initial.repoUrl);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setStatus("in_progress");
      await startLab({ labId });
      toast({ eyebrow: "Lab started", title: "Clock's running. One step at a time.", tone: "neutral" });
    });

  const toggle = (i: number) => {
    if (status === "not_started") setStatus("in_progress");
    setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
    start(async () => {
      const res = await toggleLabStep({ labId, index: i });
      if (res.ok) setDone(res.data.stepsDone);
    });
  };

  const hint = () =>
    start(async () => {
      setHintsShown((h) => h + 1);
      await revealHint({ labId });
    });

  const ship = () =>
    start(async () => {
      const res = await completeLab({ labId, notes, repoUrl: repo });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      setStatus("completed");
      toast({ eyebrow: "Lab completed", title: "Shipped.", body: "That's evidence, not intention.", tone: "accent" });
      toastFeedback(res.data);
    });

  const allDone = done.length >= steps.length;

  return (
    <div className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
          Steps · {done.length}/{steps.length}
        </div>
        {status === "not_started" && (
          <Button variant="primary" size="sm" onClick={begin} disabled={pending}>
            Start lab
          </Button>
        )}
      </div>
      <ol className="border-b border-line">
        {steps.map((s, i) => {
          const on = done.includes(i);
          return (
            <li key={i} className="border-t border-line py-5">
              <div className="flex gap-4">
                <button
                  onClick={() => toggle(i)}
                  aria-pressed={on}
                  aria-label={`Mark step ${i + 1} done`}
                  className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border font-mono text-[11px] transition-all", on ? "border-accent bg-accent text-accent-ink" : "border-line-strong text-faint hover:border-white/40")}
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[15.5px]", on ? "text-muted" : "text-fg")}>{s.title}</div>
                  <div className="mt-1.5 text-muted">{s.detail}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {hints.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Hints</span>
            <span className="font-mono text-[10.5px] text-faint">
              {Math.min(hintsShown, hints.length)}/{hints.length} used
            </span>
          </div>
          <AnimatePresence initial={false}>
            {hints.slice(0, hintsShown).map((h, i) => (
              <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex gap-3 text-[14px] leading-relaxed text-muted">
                <Lightbulb className="mt-1 size-3.5 shrink-0 text-warn" />
                {h}
              </motion.p>
            ))}
          </AnimatePresence>
          {hintsShown < hints.length && (
            <button onClick={hint} className="mt-1 font-mono text-[12px] text-faint hover:text-muted">
              {hintsShown === 0 ? "Stuck for 15+ minutes? Reveal a hint →" : "Next hint →"}
            </button>
          )}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-dashed border-line-strong p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-warn">Stretch goal</div>
        <p className="mt-2 text-[14px] leading-relaxed text-fg">{stretch}</p>
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{status === "completed" ? "What you learned" : "Ship it"}</div>
        {status === "completed" ? (
          <div>
            <ul className="mt-4 space-y-2">
              {learned.map((l) => (
                <li key={l} className="flex gap-3 text-[14.5px] text-fg">
                  <Check className="mt-1 size-3.5 shrink-0 text-accent" />
                  {l}
                </li>
              ))}
            </ul>
            {repo && (
              <a href={repo} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-mono text-[12px] text-accent">
                {repo}
              </a>
            )}
            <div className="mt-6">
              <Link href="/" className="text-sm text-muted hover:text-fg">
                Back to today →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repo or demo URL (optional)" className="box-input" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What broke, and how did you fix it? Future you will want this." className="box-input" />
            <div className="flex items-center gap-4">
              <Button variant="primary" onClick={ship} disabled={pending}>
                Mark lab shipped
              </Button>
              {!allDone && <span className="text-[13px] text-faint">{steps.length - done.length} steps unchecked — ship anyway if the output works.</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
