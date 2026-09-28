"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action, slug } from "./util";
import { afterProgress, logEvent } from "@/lib/data/effects";
import { loadState } from "@/lib/data/state";
import { firstTopicReview } from "@/lib/engine/srs";
import { todayISO } from "@/lib/engine/dates";

async function ensureProgress(userId: string, topicId: string) {
  const existing = await db.query.topicProgress.findFirst({
    where: and(eq(s.topicProgress.userId, userId), eq(s.topicProgress.topicId, topicId)),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(s.topicProgress)
    .values({ userId, topicId, status: "learning", startedAt: new Date() })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.query.topicProgress.findFirst({ where: and(eq(s.topicProgress.userId, userId), eq(s.topicProgress.topicId, topicId)) }))!;
}

const where = (userId: string, topicId: string) => and(eq(s.topicProgress.userId, userId), eq(s.topicProgress.topicId, topicId));

/** Mark a level (1..5) as understood. Levels only move forward. */
export const reachLevel = action(z.object({ topicId: slug, level: z.number().int().min(1).max(5) }), async ({ topicId, level }, user) => {
  const p = await ensureProgress(user.id, topicId);
  if (p.levelReached === 0) await logEvent(user, "topic_started", { refType: "topic", refId: topicId });
  if (level > p.levelReached) {
    await db.update(s.topicProgress).set({ levelReached: level }).where(where(user.id, topicId));
    await logEvent(user, "topic_level", { refType: "topic", refId: topicId, minutes: 8, meta: { level } });
  }
  return { level: Math.max(level, p.levelReached) };
});

/** Toggle one checklist item of the mini task. All items checked = mini task done. */
export const toggleMiniTaskCheck = action(
  z.object({ topicId: slug, index: z.number().int().min(0).max(20), total: z.number().int().min(1).max(20) }),
  async ({ topicId, index, total }, user) => {
    const before = await loadState({ ...user });
    const p = await ensureProgress(user.id, topicId);
    const set = new Set(p.miniTaskChecks);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    const checks = [...set].sort((a, b) => a - b);
    const done = checks.length >= total;
    await db
      .update(s.topicProgress)
      .set({ miniTaskChecks: checks, miniTaskDone: done, status: done && p.status === "learning" ? "practised" : p.status })
      .where(where(user.id, topicId));
    if (done && !p.miniTaskDone) {
      await logEvent(user, "mini_task_done", { refType: "topic", refId: topicId, minutes: 20 });
      return { checks, done, feedback: await afterProgress(user, before) };
    }
    return { checks, done, feedback: null };
  },
);

/** Complete a topic: reflection + confidence, then schedule the review ladder. */
export const completeTopic = action(
  z.object({
    topicId: slug,
    confidence: z.number().int().min(1).max(5),
    reflection: z.string().max(4000).default(""),
  }),
  async ({ topicId, confidence, reflection }, user) => {
    const before = await loadState({ ...user });
    const p = await ensureProgress(user.id, topicId);
    if (!p.miniTaskDone) throw new Error("Mini task not done");
    const today = todayISO(user.timezone);
    await db
      .update(s.topicProgress)
      .set({ status: "completed", confidence, reflection, levelReached: 5, completedAt: p.completedAt ?? new Date() })
      .where(where(user.id, topicId));
    if (p.status !== "completed") {
      const r = firstTopicReview(today);
      await db.insert(s.reviews).values({ userId: user.id, itemType: "topic", itemId: topicId, stage: r.stage, kind: r.kind, dueAt: r.dueAt });
      await logEvent(user, "topic_completed", { refType: "topic", refId: topicId, minutes: 10, meta: { confidence } });
    }
    return afterProgress(user, before);
  },
);

export const saveTopicNote = action(
  z.object({ topicId: slug, title: z.string().min(1).max(200), body: z.string().min(1).max(20000) }),
  async ({ topicId, title, body }, user) => {
    await db.insert(s.notes).values({ userId: user.id, topicId, title, body });
    return null;
  },
);
