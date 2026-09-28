"use client";

import { useOptimistic, useTransition } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { MiniTask } from "@/content/types";
import { toggleMiniTaskCheck } from "@/lib/actions/learn";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";

const KIND: Record<MiniTask["kind"], string> = { observe: "Observe", code: "Code", build: "Build", explain: "Explain" };

/**
 * "Never teach without making him DO something." The task only counts once
 * every checklist item is confirmed — each confirmation is saved immediately.
 */
export function MiniTaskPanel({ topicId, task, initialChecks }: { topicId: string; task: MiniTask; initialChecks: number[] }) {
  const [checks, setChecks] = useOptimistic(initialChecks, (cur: number[], i: number) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  const [, start] = useTransition();
  const done = checks.length >= task.checklist.length;

  const toggle = (i: number) =>
    start(async () => {
      setChecks(i);
      const res = await toggleMiniTaskCheck({ topicId, index: i, total: task.checklist.length });
      if (!res.ok) toast({ title: res.error, tone: "bad" });
      else if (res.data.done && res.data.feedback) {
        toast({ eyebrow: "Mini task complete", title: task.title, body: "Now reflect and lock it in below.", tone: "accent" });
        toastFeedback(res.data.feedback);
      }
    });

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-6 transition-colors duration-700 md:p-8", done ? "border-accent/35 bg-accent/[0.035]" : "border-line-strong bg-white/[0.015]")}>
      <motion.div className="absolute inset-x-0 top-0 h-px bg-accent" initial={false} animate={{ scaleX: checks.length / task.checklist.length }} style={{ originX: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Mini task · {KIND[task.kind]}</div>
        <div className="font-mono text-[11px] text-faint">~{task.minutes} min</div>
      </div>
      <h2 className="mt-3 font-display text-[26px] font-light leading-snug text-white">{task.title}</h2>

      <ol className="mt-6 space-y-3">
        {task.steps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-[3px] font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <Markdown className="text-[14.5px] leading-relaxed">{step}</Markdown>
          </li>
        ))}
      </ol>

      <div className="mt-8 border-t border-line pt-6">
        <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Confirm before it counts</div>
        <ul className="space-y-1">
          {task.checklist.map((c, i) => {
            const on = checks.includes(i);
            return (
              <li key={i}>
                <button onClick={() => toggle(i)} className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.03]" aria-pressed={on}>
                  <span
                    className={cn(
                      "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all duration-300",
                      on ? "scale-100 border-accent bg-accent" : "border-line-strong group-hover:border-white/40",
                    )}
                  >
                    {on && (
                      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
                        <Check className="size-3 text-accent-ink" strokeWidth={3} />
                      </motion.span>
                    )}
                  </span>
                  <span className={cn("text-[14px] leading-relaxed transition-colors", on ? "text-muted" : "text-fg")}>{c}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-6 text-[13px] text-muted">
        <span className="text-faint">Deliverable — </span>
        {task.deliverable}
      </p>
    </div>
  );
}
