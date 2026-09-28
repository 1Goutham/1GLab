"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarRange, Plus, X } from "lucide-react";
import { addTask } from "@/lib/actions/daily";
import { toast } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/engine/dates";
import { cn } from "@/lib/cn";

type Item = { title: string; type: string; minutes: number; energy: "low" | "medium" | "high"; refType?: string; refId?: string };
type Day = { date: string; label?: string; items: Item[]; minutes?: number };
type Plan = { weekStart: string; rationale: string; days: Day[] };

const hrefFor = (i: Item) =>
  i.refType === "topic" && i.refId ? `/learn/${i.refId}` : i.refType === "lab" && i.refId ? `/labs/${i.refId}` : i.refType === "dsa" ? "/dsa" : i.refType === "weekly" ? "/review/weekly" : i.refType === "review" ? "/review" : null;

/**
 * "Plan my week": the engine builds a realistic plan from real state; the AI
 * (when available) refines order and rationale. Editable — remove anything,
 * or turn an item into a task.
 */
export function WeekPlan({ plan: initial, today, autoOpen }: { plan: Plan | null; today: string; autoOpen: boolean }) {
  const [plan, setPlan] = useState<Plan | null>(initial);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [, start] = useTransition();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "plan-week" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data);
      setSource(data.source);
    } catch (e) {
      toast({ title: "Couldn't plan right now", body: e instanceof Error ? e.message : undefined, tone: "bad" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Arriving from "Plan my week" in the command palette: generate once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen && !initial) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeItem = (di: number, ii: number) => setPlan((p) => (p ? { ...p, days: p.days.map((d, j) => (j === di ? { ...d, items: d.items.filter((_, k) => k !== ii) } : d)) } : p));
  const toTask = (item: Item, date: string) =>
    start(async () => {
      const type = (["learn", "build", "dsa", "review", "project"].includes(item.type) ? item.type : "learn") as "learn";
      const res = await addTask({ title: item.title, type, minutes: item.minutes, energy: item.energy, plannedFor: date, source: "plan" });
      toast(res.ok ? { title: "Added to tasks", body: item.title, tone: "neutral" } : { title: res.error, tone: "bad" });
    });

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          <CalendarRange className="size-3.5" /> This week
          {source && <span className="normal-case tracking-normal">· {source === "ai" ? "refined by mentor" : "planned by engine"}</span>}
        </div>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? "Planning…" : plan ? "Re-plan my week" : "Plan my week"}
        </Button>
      </div>
      {plan ? (
        <>
          <p className="mb-6 max-w-3xl text-[14px] leading-relaxed text-muted">{plan.rationale}</p>
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-7">
            {plan.days.map((d, di) => {
              const total = d.items.reduce((a, x) => a + x.minutes, 0);
              return (
                <div key={d.date} className={cn("min-h-40 bg-bg p-3", d.date === today && "bg-accent/[0.035]")}>
                  <div className="flex items-baseline justify-between">
                    <span className={cn("font-mono text-[11px]", d.date === today ? "text-accent" : "text-muted")}>{d.label ?? d.date}</span>
                    <span className="font-mono text-[10px] text-faint">{formatMinutes(total)}</span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {d.items.map((it, ii) => {
                      const href = hrefFor(it);
                      return (
                        <li key={ii} className="group relative rounded-md border border-line px-2 py-1.5">
                          {href ? (
                            <Link href={href} className="block text-[12px] leading-snug text-fg hover:text-accent">
                              {it.title}
                            </Link>
                          ) : (
                            <span className="block text-[12px] leading-snug text-fg">{it.title}</span>
                          )}
                          <span className="font-mono text-[9.5px] text-faint">
                            {it.minutes}m · {it.energy}
                          </span>
                          <span className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                            <button onClick={() => toTask(it, d.date)} title="Add as task" className="rounded p-0.5 text-faint hover:text-fg">
                              <Plus className="size-3" />
                            </button>
                            <button onClick={() => removeItem(di, ii)} title="Remove from plan" className="rounded p-0.5 text-faint hover:text-bad">
                              <X className="size-3" />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-[14px] text-muted">
          No plan for this week yet. The planner looks at unfinished topics and labs, reviews coming due, this week&apos;s DSA pattern and your daily time — and leaves 15% slack.
        </div>
      )}
    </section>
  );
}
