"use client";

import { useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { addTask, deleteTask, setTaskStatus } from "@/lib/actions/daily";
import { toast } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Task = {
  id: number;
  title: string;
  type: string;
  priority: "p1" | "p2" | "p3";
  minutes: number;
  energy: "low" | "medium" | "high";
  difficulty: string;
  status: string;
  skill: string | null;
  deadline: string | null;
  today: string;
};

const TYPES = ["learn", "code", "build", "dsa", "review", "watch", "read", "research", "project"] as const;
const ENERGY: Record<string, string> = { low: "Low energy", medium: "Medium", high: "High energy" };

export function TaskBoard({ tasks, skills, autoNew }: { tasks: Task[]; skills: { id: string; name: string }[]; autoNew: boolean }) {
  const [energy, setEnergy] = useState<"all" | "low" | "medium" | "high">("all");
  const [adding, setAdding] = useState(autoNew);
  const [items, applyOptimistic] = useOptimistic(tasks, (cur: Task[], u: { id: number; status?: string; remove?: boolean }) =>
    u.remove ? cur.filter((t) => t.id !== u.id) : cur.map((t) => (t.id === u.id ? { ...t, status: u.status ?? t.status } : t)),
  );
  const [, start] = useTransition();

  const open = items.filter((t) => t.status !== "done" && (energy === "all" || t.energy === energy));
  const done = items.filter((t) => t.status === "done").slice(0, 8);
  const order = { p1: 0, p2: 1, p3: 2 };
  open.sort((a, b) => order[a.priority] - order[b.priority] || a.minutes - b.minutes);

  const complete = (t: Task) =>
    start(async () => {
      applyOptimistic({ id: t.id, status: t.status === "done" ? "todo" : "done" });
      const res = await setTaskStatus({ id: t.id, status: t.status === "done" ? "todo" : "done" });
      if (!res.ok) toast({ title: res.error, tone: "bad" });
    });
  const remove = (t: Task) =>
    start(async () => {
      applyOptimistic({ id: t.id, remove: true });
      await deleteTask({ id: t.id });
    });

  return (
    <section className="mt-16">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["all", "low", "medium", "high"] as const).map((e) => (
            <button key={e} onClick={() => setEnergy(e)} className={cn("rounded-md px-3 py-1 text-[12.5px]", energy === e ? "bg-white/[0.08] text-fg" : "text-faint hover:text-muted")}>
              {e === "all" ? "All" : ENERGY[e]}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add task
        </Button>
      </div>

      <AnimatePresence>{adding && <NewTask skills={skills} onClose={() => setAdding(false)} />}</AnimatePresence>

      {open.length === 0 ? (
        <p className="border-t border-line py-8 text-center text-[14px] text-faint">
          {energy === "low" ? "No low-energy tasks queued. Add one: review notes, watch one video, re-read a lesson." : "Nothing open. Today's mission on Home is still the best next action."}
        </p>
      ) : (
        <ul className="border-b border-line">
          <AnimatePresence initial={false}>
            {open.map((t) => (
              <motion.li key={t.id} layout exit={{ opacity: 0, x: 20 }} className="group grid grid-cols-[28px_1fr_auto] items-center gap-4 border-t border-line py-3.5">
                <button onClick={() => complete(t)} className="grid size-[18px] place-items-center rounded-[5px] border border-line-strong hover:border-accent" aria-label="Complete task" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    {t.priority === "p1" && <span className="size-1.5 rounded-full bg-bad" title="Priority 1" />}
                    <span className="truncate text-[14.5px] text-fg">{t.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-faint">
                    <span className="uppercase">{t.type}</span>
                    <span>{t.minutes} min</span>
                    <span className={cn(t.energy === "low" && "text-accent/80", t.energy === "high" && "text-warn")}>{ENERGY[t.energy].toLowerCase()}</span>
                    {t.skill && <span>{t.skill}</span>}
                    {t.deadline && <span className={cn(t.deadline < t.today && "text-bad")}>due {t.deadline}</span>}
                  </div>
                </div>
                <button onClick={() => remove(t)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Delete task">
                  <Trash2 className="size-3.5 text-faint hover:text-bad" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-10">
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Recently done</div>
          <ul>
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1.5 text-[13.5px] text-faint">
                <button onClick={() => complete(t)} className="grid size-4 place-items-center rounded-[4px] bg-accent/80" aria-label="Reopen task">
                  <Check className="size-3 text-accent-ink" strokeWidth={3} />
                </button>
                <span className="line-through decoration-white/20">{t.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function NewTask({ skills, onClose }: { skills: { id: string; name: string }[]; onClose: () => void }) {
  const [v, setV] = useState({
    title: "",
    type: "learn" as (typeof TYPES)[number],
    priority: "p2" as "p1" | "p2" | "p3",
    minutes: 30,
    energy: "medium" as "low" | "medium" | "high",
    difficulty: "medium" as "easy" | "medium" | "hard",
    skillId: "",
    deadline: "",
  });
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await addTask({ ...v, skillId: v.skillId || null, deadline: v.deadline || null });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      onClose();
    });
  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-8 overflow-hidden"
    >
      <div className="rounded-xl border border-line-strong p-5">
        <div className="flex items-start gap-3">
          <input autoFocus value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Implement self-attention from scratch" className="field-input text-[16px]" />
          <button type="button" onClick={onClose} className="mt-2 text-faint hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
          <Field label="Type">
            <select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as (typeof TYPES)[number] })} className="field-input capitalize">
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Energy">
            <select value={v.energy} onChange={(e) => setV({ ...v, energy: e.target.value as "low" })} className="field-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Minutes">
            <input type="number" min={5} max={600} step={5} value={v.minutes} onChange={(e) => setV({ ...v, minutes: Number(e.target.value) })} className="field-input" />
          </Field>
          <Field label="Priority">
            <select value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as "p1" })} className="field-input">
              <option value="p1">P1 — must</option>
              <option value="p2">P2 — should</option>
              <option value="p3">P3 — could</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value as "easy" })} className="field-input">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>
          <Field label="Skill">
            <select value={v.skillId} onChange={(e) => setV({ ...v, skillId: e.target.value })} className="field-input">
              <option value="">—</option>
              {skills.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline">
            <input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} className="field-input" />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" size="sm" disabled={pending || !v.title.trim()} className="w-full">
              Add
            </Button>
          </div>
        </div>
      </div>
    </motion.form>
  );
}
