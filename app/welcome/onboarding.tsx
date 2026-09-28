"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { completeOnboarding } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Defaults = {
  currentLevel: string;
  dailyMinutes: number;
  mainGoal: string;
  currentProjects: string;
  dsaConfidence: number;
  aiConfidence: number;
  startDate: string;
};

const LINES = [
  "B.Tech in AI & Data Science.",
  "Ships React, Next.js, TypeScript, Node and MongoDB.",
  "Built Ideako, ZtudyLock, IdeaGuard AI and FabricNest.",
  "Next: the depth underneath — models, systems, scale.",
];

export function Onboarding({ defaults }: { defaults: Defaults }) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState(defaults);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = () =>
    start(async () => {
      const res = await completeOnboarding(v);
      if (!res.ok) return setError(res.error);
      setStep(2);
      setTimeout(() => router.push("/"), 2200);
    });

  return (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }}>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">1G · AI Engineering OS</div>
          <h1 className="mt-6 font-display text-5xl font-extralight leading-[1.05] tracking-tight text-white md:text-6xl">
            Hi Goutham.
            <br />
            <span className="text-muted">Six months. One direction.</span>
          </h1>
          <div className="mt-10 space-y-2">
            {LINES.map((l, i) => (
              <motion.p
                key={l}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="text-[15px] text-muted"
              >
                <span className="mr-3 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                {l}
              </motion.p>
            ))}
          </div>
          <p className="mt-10 max-w-lg text-[15px] leading-relaxed text-fg">
            This OS already knows most of that. Confirm six things and it will build your first week: learn, do, build, break, fix, explain.
          </p>
          <Button variant="primary" size="lg" className="mt-8" onClick={() => setStep(1)}>
            Confirm my starting point
          </Button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.form
          key="form"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-9"
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Starting point</div>
            <h2 className="mt-3 font-display text-3xl font-light text-white">Prefilled. Edit anything that&apos;s off.</h2>
          </div>
          <Field label="01 — Current technical level">
            <input className="field-input" value={v.currentLevel} onChange={(e) => setV({ ...v, currentLevel: e.target.value })} />
          </Field>
          <Field label="02 — Available time per day" hint={`${Math.floor(v.dailyMinutes / 60)}h ${v.dailyMinutes % 60}m`}>
            <input
              type="range"
              min={45}
              max={360}
              step={15}
              value={v.dailyMinutes}
              onChange={(e) => setV({ ...v, dailyMinutes: Number(e.target.value) })}
              className="mt-3 w-full accent-[#9dff50]"
            />
          </Field>
          <Field label="03 — Main goal">
            <textarea rows={2} className="field-input" value={v.mainGoal} onChange={(e) => setV({ ...v, mainGoal: e.target.value })} />
          </Field>
          <Field label="04 — Current projects">
            <input className="field-input" value={v.currentProjects} onChange={(e) => setV({ ...v, currentProjects: e.target.value })} />
          </Field>
          <div className="grid gap-9 sm:grid-cols-2">
            <Scale label="05 — DSA confidence" value={v.dsaConfidence} onChange={(n) => setV({ ...v, dsaConfidence: n })} />
            <Scale label="06 — AI confidence" value={v.aiConfidence} onChange={(n) => setV({ ...v, aiConfidence: n })} />
          </div>
          <Field label="Program start date" hint="Day 1 of 180">
            <input type="date" className="field-input" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </Field>
          {error && <p className="text-sm text-bad">{error}</p>}
          <Button variant="primary" size="lg" disabled={pending}>
            {pending ? "Generating your first week…" : "Generate my first week"}
          </Button>
        </motion.form>
      )}

      {step === 2 && (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-20">
          <motion.div className="h-px bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }} />
          <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Week 01 generated</div>
          <h2 className="mt-3 font-display text-4xl font-extralight text-white">Your first mission is ready.</h2>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const words = ["", "New", "Shaky", "Okay", "Solid", "Strong"];
  return (
    <Field label={label} hint={words[value]}>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n)}
            className={cn("tactile h-9 flex-1 rounded-md border font-mono text-sm", n <= value ? "border-accent/40 bg-accent/10 text-accent" : "border-line-strong text-faint hover:text-muted")}
          >
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}
