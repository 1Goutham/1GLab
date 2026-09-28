"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * The monthly level-up. Rewarding through clarity: what you can now do,
 * what you built, what's next. One slow line of light, no confetti.
 */
export function LevelUp({
  unlocked,
  level,
  title,
  completed,
  built,
  solved,
  next,
  remaining,
}: {
  unlocked: boolean;
  level: number;
  title: string;
  completed: string[];
  built: string[];
  solved: number;
  next: string | null;
  remaining: { topics: number; labs: number };
}) {
  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Level {String(level).padStart(2, "0")} · locked</div>
        <h1 className="mt-4 font-display text-4xl font-extralight text-white">{title}</h1>
        <p className="mt-4 text-muted">
          Unlocks when the work is real: {remaining.topics > 0 ? `${remaining.topics} more concept${remaining.topics === 1 ? "" : "s"}` : "concepts done"}
          {remaining.labs > 0 ? ` and ${remaining.labs} more lab${remaining.labs === 1 ? "" : "s"}` : ""}.
        </p>
        <Link href="/roadmap" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Back to the roadmap →
        </Link>
      </div>
    );
  }
  return (
    <div className="relative mx-auto max-w-3xl py-10 md:py-16">
      <motion.div
        className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.2, ease }}
      />
      <motion.div className="h-px bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 1.6, ease }} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.9, ease }} className="relative mt-10">
        <div className="font-mono text-[12px] uppercase tracking-[0.24em] text-accent">Level {String(level).padStart(2, "0")} unlocked</div>
        <h1 className="mt-4 font-display text-5xl font-extralight uppercase tracking-tight text-white md:text-7xl">{title}</h1>
      </motion.div>

      <div className="mt-16 grid gap-12 md:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">You completed</div>
          <ul className="mt-4 space-y-2">
            {completed.map((c, i) => (
              <motion.li key={c} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 + i * 0.08, ease, duration: 0.6 }} className="flex gap-3 text-[15px] text-fg">
                <Check className="mt-1 size-4 shrink-0 text-accent" />
                {c}
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="space-y-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">You built</div>
            <div className="mt-2 font-display text-4xl font-extralight text-white">{built.length} labs</div>
            <ul className="mt-2 space-y-1 text-[13.5px] text-muted">{built.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Solved</div>
            <div className="mt-2 font-display text-4xl font-extralight text-white">{solved} DSA problems</div>
          </div>
          {next && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Next</div>
              <div className="mt-2 font-display text-2xl font-light text-accent">{next}</div>
            </div>
          )}
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} className="mt-16">
        <Link href="/" className="tactile inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink">
          Continue to today&apos;s mission
        </Link>
      </motion.div>
    </div>
  );
}
