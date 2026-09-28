import "server-only";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { LearnerState } from "@/lib/data/state";
import { topicStatus } from "@/lib/data/derive";
import { planWeek, type PlanDay } from "@/lib/engine/planner";
import { addDays, weekStart } from "@/lib/engine/dates";
import { getProvider, extractJson } from "./provider";
import { learnerBrief } from "./context";

/**
 * "Plan my week". The deterministic planner produces a realistic plan from
 * real state; when a model is available it may reorder and re-annotate that
 * plan (never add hours), validated with Zod. The model can only improve a
 * plan that already works.
 */
export async function generateWeekPlan(st: LearnerState): Promise<{ weekStart: string; days: PlanDay[]; rationale: string; source: "ai" | "engine" }> {
  const start = weekStart(st.today);
  const unfinishedTopics = st.topics
    .filter((t) => t.week <= st.week + 1 && topicStatus(st, t.id)?.status !== "completed")
    .map((t) => ({ id: t.id, title: t.title, minutes: t.minutes }));
  const unfinishedLabs = st.labs
    .filter((l) => l.week <= st.week && st.labProgress.find((p) => p.labId === l.id)?.status !== "completed")
    .map((l) => {
      const p = st.labProgress.find((x) => x.labId === l.id);
      const left = p ? Math.round(l.minutes * (1 - p.stepsDone.length / Math.max(1, l.steps.length))) : l.minutes;
      return { id: l.id, title: l.title, minutes: Math.max(20, left), isFlagship: l.isFlagship };
    });
  const reviewsByDay: Record<string, number> = {};
  for (const r of st.reviews.filter((r) => !r.completedAt)) {
    const d = r.dueAt < start ? start : r.dueAt;
    if (d <= addDays(start, 6)) reviewsByDay[d] = (reviewsByDay[d] ?? 0) + 1;
  }
  const tasks = await db
    .select()
    .from(s.tasks)
    .where(and(eq(s.tasks.userId, st.user.id), inArray(s.tasks.status, ["todo", "doing"])));

  const base = planWeek({
    weekStart: start,
    dailyMinutes: st.user.dailyMinutes,
    topics: unfinishedTopics,
    labs: unfinishedLabs,
    dsaPattern: st.weeks.find((w) => w.week === st.week)?.dsaPattern ?? null,
    dsaPerDay: 1,
    reviewsByDay,
    unfinishedTasks: tasks.slice(0, 6).map((t) => ({ title: t.title, minutes: t.minutes, energy: t.energy })),
  });

  const provider = getProvider();
  if (!provider) return { weekStart: start, ...base, source: "engine" };

  const Schema = z.object({
    rationale: z.string().min(10).max(1200),
    days: z
      .array(
        z.object({
          date: z.string(),
          items: z.array(
            z.object({
              title: z.string().max(160),
              type: z.enum(["learn", "build", "dsa", "review", "project"]),
              minutes: z.number().int().min(5).max(240),
              energy: z.enum(["low", "medium", "high"]),
              refType: z.string().optional(),
              refId: z.string().optional(),
            }),
          ),
        }),
      )
      .length(7),
  });

  try {
    const reply = await provider.complete({
      system:
        "You are a senior engineer planning a realistic learning week. Improve the draft plan: reorder for energy (hard work early in the day and week), group related work, and write a short, direct rationale in second person. Never increase any day's total minutes and never add new work. Keep refType/refId unchanged on items you keep. Return JSON {rationale, days:[{date, items:[...]}]}.",
      messages: [{ role: "user", content: `Learner:\n${learnerBrief(st)}\n\nDraft plan JSON:\n${JSON.stringify(base.days)}` }],
      json: true,
      maxTokens: 4000,
    });
    const parsed = Schema.parse(extractJson(reply));
    const days: PlanDay[] = parsed.days.map((d, i) => {
      const cap = base.days[i].minutes;
      let used = 0;
      const items = d.items.filter((it) => (used += it.minutes) <= cap + 5);
      return { date: base.days[i].date, label: base.days[i].label, items, minutes: items.reduce((a, x) => a + x.minutes, 0) };
    });
    return { weekStart: start, days, rationale: parsed.rationale, source: "ai" };
  } catch {
    return { weekStart: start, ...base, source: "engine" };
  }
}
