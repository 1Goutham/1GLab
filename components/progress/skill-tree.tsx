"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type TreeSkill = {
  id: string;
  name: string;
  overall: number;
  selfReported: boolean;
  dims: { label: string; value: number | null }[];
};
export type TreeGroup = { id: string; name: string; skills: TreeSkill[] };
export type TreeCategory = { id: string; name: string; color: string; score: number; groups: TreeGroup[] };

/**
 * The skill tree. Branches draw in, nodes fill to their score, mastered
 * skills (≥80) lock in with a check. Click any node to see the six
 * dimensions behind its number.
 */
export function SkillTree({ categories }: { categories: TreeCategory[] }) {
  const [cat, setCat] = useState(categories[0]?.id);
  const [open, setOpen] = useState<string | null>(null);
  const c = categories.find((x) => x.id === cat)!;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((x) => (
          <button
            key={x.id}
            onClick={() => {
              setCat(x.id);
              setOpen(null);
            }}
            className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] transition-colors", cat === x.id ? "border-white/25 bg-white/[0.06] text-fg" : "border-line text-muted hover:text-fg")}
          >
            <span className="size-1.5 rounded-full" style={{ background: x.color }} />
            {x.name}
            <span className="font-mono text-[10.5px] text-faint">{x.score}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-8">
          <div className="font-mono text-[12px] uppercase tracking-[0.18em]" style={{ color: c.color }}>
            {c.name}
          </div>
          <div className="relative ml-1.5 mt-3 border-l border-line-strong pl-0">
            {c.groups.map((g, gi) => (
              <div key={g.id} className="relative pb-6 pl-8 last:pb-0">
                <motion.span
                  className="absolute left-0 top-[13px] h-px w-6 bg-line-strong"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ originX: 0 }}
                  transition={{ delay: gi * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
                <div className="font-display text-[17px] text-white">{g.name}</div>
                <div className="relative mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {g.skills.map((s, si) => {
                    const mastered = s.overall >= 80;
                    const isOpen = open === s.id;
                    return (
                      <motion.button
                        key={s.id}
                        onClick={() => setOpen(isOpen ? null : s.id)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.08 + si * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                          "group relative overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-colors",
                          isOpen ? "border-white/25 bg-white/[0.04]" : "border-line hover:border-line-strong",
                        )}
                      >
                        <motion.span
                          className="absolute inset-y-0 left-0 opacity-[0.09]"
                          style={{ background: c.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.overall}%` }}
                          transition={{ delay: 0.2 + si * 0.05, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                        />
                        <span className="relative flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-[13.5px] text-fg">
                            {mastered ? (
                              <span className="grid size-4 place-items-center rounded-full" style={{ background: c.color }}>
                                <Check className="size-2.5 text-black" strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="size-4 rounded-full border" style={{ borderColor: s.overall > 0 ? c.color : "var(--line-strong)", opacity: 0.4 + s.overall / 160 }} />
                            )}
                            {s.name}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted">
                            {mastered ? "✓" : `${s.overall}%`}
                          </span>
                        </span>
                        {s.selfReported && <span className="relative mt-0.5 block font-mono text-[9.5px] uppercase tracking-wider text-faint">self-reported</span>}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative mt-3 block space-y-1.5 overflow-hidden">
                              {s.dims.map((d) => (
                                <span key={d.label} className="grid grid-cols-[100px_1fr_30px] items-center gap-2">
                                  <span className="text-[11.5px] text-muted">{d.label}</span>
                                  <span className="h-[3px] rounded-full bg-white/[0.07]">
                                    {d.value !== null && <span className="block h-full rounded-full" style={{ width: `${d.value}%`, background: c.color }} />}
                                  </span>
                                  <span className="text-right font-mono text-[10.5px] text-faint">{d.value === null ? "—" : d.value}</span>
                                </span>
                              ))}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
