import { and, desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { loadState } from "@/lib/data/state";
import { weekStart } from "@/lib/engine/dates";
import { PageHeader } from "@/components/ui/primitives";
import { TaskBoard } from "@/components/tasks/task-board";
import { WeekPlan } from "@/components/tasks/week-plan";

export const metadata = { title: "Tasks & Plan" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ new?: string; plan?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const st = await loadState(user);
  const [tasks, plan] = await Promise.all([
    db
      .select()
      .from(s.tasks)
      .where(and(eq(s.tasks.userId, user.id), inArray(s.tasks.status, ["todo", "doing", "done"])))
      .orderBy(desc(s.tasks.createdAt))
      .limit(200),
    db.query.weekPlans.findFirst({ where: and(eq(s.weekPlans.userId, user.id), eq(s.weekPlans.weekStart, weekStart(st.today))) }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Tasks & plan"
        title="Keep moving — even on bad days."
        description="Every task carries an energy cost. On a low-energy day, filter to what still moves you forward."
      />
      <WeekPlan
        today={st.today}
        autoOpen={sp.plan === "1"}
        plan={plan ? { weekStart: plan.weekStart, rationale: plan.rationale, days: plan.days } : null}
      />
      <TaskBoard
        autoNew={sp.new === "1"}
        skills={st.skills.filter((k) => !k.isGroup).map((k) => ({ id: k.id, name: k.name }))}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          priority: t.priority,
          minutes: t.minutes,
          energy: t.energy,
          difficulty: t.difficulty,
          status: t.status,
          skill: t.skillId ? st.skills.find((k) => k.id === t.skillId)?.name ?? null : null,
          deadline: t.deadline,
          today: st.today,
        }))}
      />
    </div>
  );
}
