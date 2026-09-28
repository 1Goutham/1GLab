import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { User } from "@/lib/auth";
import { addDays, programDay, programMonth, programWeek, todayISO } from "@/lib/engine/dates";

/**
 * Everything the engine needs about the learner, loaded once per request.
 * The whole curriculum is small (≈75 topics, ≈36 labs, ≈120 problems), so a
 * handful of flat queries beats a web of joins — and it keeps every derived
 * view (mission, scores, insights, weekly review) consistent.
 */
export const loadState = cache(async (user: User) => {
  const today = todayISO(user.timezone);
  const since60 = addDays(today, -60);

  const [
    modules,
    weeks,
    topics,
    miniTasks,
    labs,
    topicProgress,
    labProgress,
    problems,
    attempts,
    reviews,
    skills,
    categories,
    projects,
    events,
    journal,
    snapshots,
  ] = await Promise.all([
    db.select().from(s.modules).orderBy(asc(s.modules.month)),
    db.select().from(s.weeks).orderBy(asc(s.weeks.week)),
    db
      .select({
        id: s.topics.id,
        moduleId: s.topics.moduleId,
        week: s.topics.week,
        order: s.topics.order,
        title: s.topics.title,
        domain: s.topics.domain,
        skillIds: s.topics.skillIds,
        difficulty: s.topics.difficulty,
        minutes: s.topics.minutes,
        summary: s.topics.summary,
        tags: s.topics.tags,
      })
      .from(s.topics)
      .where(eq(s.topics.status, "published"))
      .orderBy(asc(s.topics.week), asc(s.topics.order)),
    db
      .select({ topicId: s.lessons.topicId, title: sql<string>`${s.lessons.content}->'miniTask'->>'title'` })
      .from(s.lessons),
    db.select().from(s.labs).where(eq(s.labs.status, "published")).orderBy(asc(s.labs.week), asc(s.labs.minutes)),
    db.select().from(s.topicProgress).where(eq(s.topicProgress.userId, user.id)),
    db.select().from(s.labProgress).where(eq(s.labProgress.userId, user.id)),
    db.select().from(s.dsaProblems).orderBy(asc(s.dsaProblems.order)),
    db.select().from(s.dsaAttempts).where(eq(s.dsaAttempts.userId, user.id)).orderBy(asc(s.dsaAttempts.createdAt)),
    db.select().from(s.reviews).where(eq(s.reviews.userId, user.id)),
    db.select().from(s.skills).orderBy(asc(s.skills.order)),
    db.select().from(s.skillCategories).orderBy(asc(s.skillCategories.order)),
    db.select().from(s.projects).where(eq(s.projects.userId, user.id)),
    db
      .select()
      .from(s.activityEvents)
      .where(and(eq(s.activityEvents.userId, user.id), gte(s.activityEvents.day, since60)))
      .orderBy(desc(s.activityEvents.createdAt)),
    db.select().from(s.journalEntries).where(eq(s.journalEntries.userId, user.id)).orderBy(desc(s.journalEntries.date)).limit(30),
    db.select().from(s.progressSnapshots).where(eq(s.progressSnapshots.userId, user.id)).orderBy(asc(s.progressSnapshots.date)),
  ]);

  const tz = user.timezone;
  const dayOf = (d: Date | null) => (d ? todayISO(tz, d) : null);

  return {
    user,
    today,
    day: programDay(user.startDate, today),
    week: programWeek(user.startDate, today),
    month: programMonth(programWeek(user.startDate, today)),
    modules,
    weeks,
    topics: topics.map((t) => ({ ...t, miniTaskTitle: miniTasks.find((m) => m.topicId === t.id)?.title ?? "the mini task" })),
    labs,
    topicProgress,
    labProgress,
    problems,
    attempts: attempts.map((a) => ({ ...a, day: dayOf(a.createdAt)! })),
    reviews,
    skills,
    categories,
    projects,
    events,
    journal,
    snapshots,
    dayOf,
  };
});

export type LearnerState = Awaited<ReturnType<typeof loadState>>;
