/**
 * Deterministic weekly planner. The AI layer may refine the result, but this
 * is always a sane, realistic plan on its own — and it never overloads.
 *
 * Rules:
 *  - each day is filled to ~85% of the daily budget (slack is a feature)
 *  - one high-energy block per day at most; Sunday is light (review + plan)
 *  - reviews that come due during the week are placed on their due day
 *  - unfinished work carries over before new work is added
 */
import { addDays, formatDay } from "./dates";

export type PlanItem = {
  title: string;
  type: "learn" | "build" | "dsa" | "review" | "project";
  minutes: number;
  energy: "low" | "medium" | "high";
  refType?: string;
  refId?: string;
};
export type PlanDay = { date: string; label: string; items: PlanItem[]; minutes: number };

export function planWeek(input: {
  weekStart: string;
  dailyMinutes: number;
  topics: { id: string; title: string; minutes: number }[]; // unfinished, in order
  labs: { id: string; title: string; minutes: number; isFlagship: boolean }[]; // unfinished, in order
  dsaPattern: string | null;
  dsaPerDay: number;
  reviewsByDay: Record<string, number>;
  unfinishedTasks: { title: string; minutes: number; energy: "low" | "medium" | "high" }[];
}): { days: PlanDay[]; rationale: string } {
  const budget = Math.round(input.dailyMinutes * 0.85);
  const topics = [...input.topics];
  const labs = [...input.labs];
  const carry = [...input.unfinishedTasks];
  const days: PlanDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(input.weekStart, i);
    const sunday = i === 6;
    const items: PlanItem[] = [];
    let used = 0;
    const push = (it: PlanItem) => {
      items.push(it);
      used += it.minutes;
    };

    const due = input.reviewsByDay[date] ?? 0;
    if (due) push({ title: `Spaced review (${due})`, type: "review", minutes: Math.min(25, 5 + due * 4), energy: "low", refType: "review" });

    if (sunday) {
      push({ title: "Weekly engineering review", type: "review", minutes: 20, energy: "low", refType: "weekly" });
      if (topics.length === 0 && labs.length) {
        const lab = labs[0];
        push({ title: `Light pass: ${lab.title}`, type: "build", minutes: 30, energy: "low", refType: "lab", refId: lab.id });
      }
      days.push({ date, label: formatDay(date), items, minutes: used });
      continue;
    }

    while (carry.length && used + carry[0].minutes <= budget * 0.4) {
      const t = carry.shift()!;
      push({ title: t.title, type: "project", minutes: t.minutes, energy: t.energy });
    }

    for (let k = 0; k < input.dsaPerDay; k++) {
      push({
        title: input.dsaPattern ? `DSA: ${input.dsaPattern.replace(/-/g, " ")}` : "DSA practice",
        type: "dsa",
        minutes: 35,
        energy: "medium",
        refType: "dsa",
      });
    }

    const topic = topics[0];
    if (topic && used + topic.minutes <= budget) {
      topics.shift();
      push({ title: topic.title, type: "learn", minutes: topic.minutes, energy: "high", refType: "topic", refId: topic.id });
    }

    const lab = labs[0];
    const room = budget - used;
    if (lab && room >= 30) {
      const slice = Math.min(room, lab.minutes, 120);
      lab.minutes -= slice;
      push({
        title: lab.minutes > 0 ? `${lab.title} (part)` : lab.title,
        type: "build",
        minutes: slice,
        energy: items.some((x) => x.energy === "high") ? "medium" : "high",
        refType: "lab",
        refId: lab.id,
      });
      if (lab.minutes <= 0) labs.shift();
    }
    days.push({ date, label: formatDay(date), items, minutes: used });
  }

  const planned = days.reduce((a, d) => a + d.minutes, 0);
  const rationale = [
    `Planned ${Math.round(planned / 60)}h across the week — about 85% of your ${input.dailyMinutes}-minute days, so a bad day doesn't break the plan.`,
    input.dsaPattern ? `DSA focuses on ${input.dsaPattern.replace(/-/g, " ")}, this week's pattern.` : "",
    Object.keys(input.reviewsByDay).length ? "Reviews sit on the days they come due." : "",
    "Sunday stays light: review the week and reset.",
  ]
    .filter(Boolean)
    .join(" ");
  return { days, rationale };
}
