"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Completion feedback. Meaningful, quiet messages — "Skill improved",
 * "Engineering milestone" — not confetti. Fire from anywhere with `toast()`.
 */
export type Toast = { id?: number; title: string; body?: string; tone?: "accent" | "neutral" | "bad"; eyebrow?: string };

const EVENT = "aios:toast";
let counter = 0;

export function toast(t: Toast) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { ...t, id: ++counter } }));
}

/** Turn a ProgressFeedback payload into toasts. */
export function toastFeedback(fb: { improved: { name: string; from: number; to: number }[]; unlocked: { title: string; description: string }[] } | null | undefined) {
  if (!fb) return;
  fb.unlocked.forEach((a, i) => setTimeout(() => toast({ eyebrow: "Engineering milestone", title: a.title, body: a.description, tone: "accent" }), i * 400));
  fb.improved.slice(0, 2).forEach((s, i) =>
    setTimeout(() => toast({ eyebrow: "Skill improved", title: s.name, body: `${s.from} → ${s.to}`, tone: "neutral" }), (fb.unlocked.length + i) * 400),
  );
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((xs) => [...xs, t].slice(-4));
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 5200);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[80] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2 md:bottom-6" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "pointer-events-auto relative overflow-hidden rounded-xl border bg-[#0d0d10]/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur",
              t.tone === "accent" ? "border-accent/30" : t.tone === "bad" ? "border-bad/30" : "border-line-strong",
            )}
          >
            {t.tone === "accent" && <motion.div className="absolute inset-x-0 top-0 h-px bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />}
            {t.eyebrow && <div className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", t.tone === "accent" ? "text-accent" : "text-faint")}>{t.eyebrow}</div>}
            <div className="mt-0.5 text-sm font-medium text-fg">{t.title}</div>
            {t.body && <div className="mt-0.5 text-[13px] text-muted">{t.body}</div>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
