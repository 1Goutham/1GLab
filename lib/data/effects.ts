import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { User } from "@/lib/auth";
import { todayISO } from "@/lib/engine/dates";
import { loadState, type LearnerState } from "./state";
import { activityOf, scoresOf } from "./derive";
import { ACHIEVEMENTS } from "@/content/achievements";

export async function logEvent(
  user: User,
  type: s.ActivityType,
  ref?: { refType?: string; refId?: string; minutes?: number; meta?: Record<string, unknown> },
) {
  await db.insert(s.activityEvents).values({
    userId: user.id,
    type,
    refType: ref?.refType ?? null,
    refId: ref?.refId ?? null,
    minutes: ref?.minutes ?? null,
    meta: ref?.meta ?? null,
    day: todayISO(user.timezone),
  });
}

export type ProgressFeedback = {
  improved: { name: string; from: number; to: number }[];
  unlocked: { title: string; description: string }[];
};

/** Snapshot the skill scores for today (one row per day, last write wins). */
export async function snapshot(st: LearnerState) {
  const { scores, categories } = scoresOf(st);
  const skillsMap: Record<string, number> = {};
  for (const sc of scores.values()) skillsMap[sc.id] = sc.overall;
  await db
    .insert(s.progressSnapshots)
    .values({ userId: st.user.id, date: st.today, categories, skills: skillsMap })
    .onConflictDoUpdate({
      target: [s.progressSnapshots.userId, s.progressSnapshots.date],
      set: { categories, skills: skillsMap },
    });
  return scores;
}

function ruleMet(rule: (typeof ACHIEVEMENTS)[number]["rule"], st: LearnerState): boolean {
  switch (rule.kind) {
    case "dsa_solved":
      return new Set(st.attempts.filter((a) => a.solved).map((a) => a.problemId)).size >= rule.count;
    case "streak":
      return activityOf(st).streak >= rule.days;
    case "lab_completed":
      if (rule.slug) return st.labProgress.some((p) => p.labId === rule.slug && p.status === "completed");
      return st.labProgress.filter((p) => p.status === "completed").length >= (rule.count ?? 1);
    case "topics_completed":
      return st.topicProgress.filter((p) => p.status === "completed").length >= rule.count;
    case "project_shipped":
      return st.projects.some((p) => p.shippedAt && st.dayOf(p.shippedAt)! >= st.user.startDate);
    case "explain_passed":
      return st.reviews.filter((r) => (r.kind === "explain" || r.kind === "interview") && r.result === "pass").length >= rule.count;
    case "journal_fixes":
      return st.journal.filter((j) => j.broke.trim() && j.fixed.trim()).length >= rule.count;
    case "focus_hours":
      return activityOf(st).focusTotal / 60 >= rule.hours;
  }
}

/**
 * Run after any progress-changing mutation: re-snapshot, unlock earned
 * milestones, and report what genuinely changed so the UI can say
 * "Skill improved" instead of "+10 XP".
 */
export async function afterProgress(user: User, before?: LearnerState): Promise<ProgressFeedback> {
  const st = await loadState({ ...user });
  const after = await snapshot(st);
  const improved: ProgressFeedback["improved"] = [];
  if (before) {
    const { scores: prev } = scoresOf(before);
    for (const sc of after.values()) {
      const p = prev.get(sc.id);
      if (p && sc.overall - p.overall >= 1) improved.push({ name: sc.name, from: p.overall, to: sc.overall });
    }
    improved.sort((a, b) => b.to - b.from - (a.to - a.from));
  }

  const owned = new Set(
    (await db.select({ id: s.userAchievements.achievementId }).from(s.userAchievements).where(sql`${s.userAchievements.userId} = ${user.id}`)).map(
      (r) => r.id,
    ),
  );
  const unlocked: ProgressFeedback["unlocked"] = [];
  for (const a of ACHIEVEMENTS) {
    if (owned.has(a.id) || !ruleMet(a.rule, st)) continue;
    await db.insert(s.userAchievements).values({ userId: user.id, achievementId: a.id }).onConflictDoNothing();
    unlocked.push({ title: a.title, description: a.description });
  }
  return { improved: improved.slice(0, 3), unlocked };
}
