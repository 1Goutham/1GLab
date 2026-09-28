"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { completeTopic } from "@/lib/actions/learn";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const CONF = ["", "Lost", "Shaky", "Okay", "Confident", "Could teach it"];

/** Reflect → complete. Schedules the review ladder (day 3, 7, 14, 30). */
export function CompleteTopic({
  topicId,
  miniTaskDone,
  completed,
  initialConfidence,
  initialReflection,
  next,
  lab,
}: {
  topicId: string;
  miniTaskDone: boolean;
  completed: boolean;
  initialConfidence: number | null;
  initialReflection: string;
  next: { href: string; title: string } | null;
  lab: { href: string; title: string } | null;
}) {
  const [confidence, setConfidence] = useState<number | null>(initialConfidence);
  const [reflection, setReflection] = useState(initialReflection);
  const [done, setDone] = useState(completed);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!confidence) return;
      const res = await completeTopic({ topicId, confidence, reflection });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      setDone(true);
      toast({ eyebrow: "Concept unlocked", title: "Topic complete", body: "First review lands in 2 days — a 3-minute quiz.", tone: "accent" });
      toastFeedback(res.data);
    });

  return (
    <div className="border-t border-line pt-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Reflect</div>
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <h2 className="mt-3 font-display text-3xl font-light text-white">Concept unlocked.</h2>
            <p className="mt-2 max-w-lg text-[14.5px] text-muted">It comes back for a quick quiz in 2 days, then asks you to explain it, implement it, and answer it like an interview. That&apos;s how it sticks.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {lab && (
                <Link href={lab.href} className="tactile group inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">
                  Build it: {lab.title} <ArrowRight className="nudge-x size-4" />
                </Link>
              )}
              {next && (
                <Link href={next.href} className="tactile group inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-sm text-fg hover:border-white/25">
                  Next: {next.title} <ArrowRight className="nudge-x size-4" />
                </Link>
              )}
              <Link href="/" className="inline-flex items-center px-3 text-sm text-muted hover:text-fg">
                Back to today
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
            <h2 className="mt-3 font-display text-3xl font-light text-white">What can you explain now?</h2>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              placeholder="In your own words: the one idea that clicked, and the part that's still fuzzy."
              className="box-input mt-5"
            />
            <div className="mt-5">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Confidence {confidence ? `· ${CONF[confidence]}` : ""}</div>
              <div className="flex max-w-md gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setConfidence(n)}
                    className={cn(
                      "tactile h-10 flex-1 rounded-md border font-mono text-sm",
                      confidence && n <= confidence ? "border-accent/40 bg-accent/10 text-accent" : "border-line-strong text-faint hover:text-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="primary" disabled={!miniTaskDone || !confidence || pending} onClick={submit}>
                {pending ? "Saving…" : "Complete topic"}
              </Button>
              {!miniTaskDone && <span className="text-[13px] text-faint">Finish the mini task first — doing is the point.</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
