"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action, slug } from "./util";
import { afterProgress, logEvent } from "@/lib/data/effects";
import { loadState } from "@/lib/data/state";

const where = (userId: string, labId: string) => and(eq(s.labProgress.userId, userId), eq(s.labProgress.labId, labId));

async function ensure(userId: string, labId: string) {
  await db.insert(s.labProgress).values({ userId, labId, status: "in_progress", startedAt: new Date() }).onConflictDoNothing();
  return (await db.query.labProgress.findFirst({ where: where(userId, labId) }))!;
}

export const startLab = action(z.object({ labId: slug }), async ({ labId }, user) => {
  const existing = await db.query.labProgress.findFirst({ where: where(user.id, labId) });
  await ensure(user.id, labId);
  if (!existing) await logEvent(user, "lab_started", { refType: "lab", refId: labId });
  return null;
});

export const toggleLabStep = action(z.object({ labId: slug, index: z.number().int().min(0).max(30) }), async ({ labId, index }, user) => {
  const p = await ensure(user.id, labId);
  const set = new Set(p.stepsDone);
  const adding = !set.has(index);
  if (adding) set.add(index);
  else set.delete(index);
  const stepsDone = [...set].sort((a, b) => a - b);
  await db.update(s.labProgress).set({ stepsDone }).where(where(user.id, labId));
  if (adding) await logEvent(user, "lab_step", { refType: "lab", refId: labId, minutes: 15, meta: { index } });
  return { stepsDone };
});

export const revealHint = action(z.object({ labId: slug }), async ({ labId }, user) => {
  const p = await ensure(user.id, labId);
  await db.update(s.labProgress).set({ hintsUsed: p.hintsUsed + 1 }).where(where(user.id, labId));
  return { hintsUsed: p.hintsUsed + 1 };
});

export const completeLab = action(
  z.object({
    labId: slug,
    notes: z.string().max(8000).default(""),
    repoUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).default(""),
  }),
  async ({ labId, notes, repoUrl }, user) => {
    const before = await loadState({ ...user });
    const p = await ensure(user.id, labId);
    await db
      .update(s.labProgress)
      .set({ status: "completed", notes, repoUrl: repoUrl || null, completedAt: p.completedAt ?? new Date() })
      .where(where(user.id, labId));
    if (p.status !== "completed") await logEvent(user, "lab_completed", { refType: "lab", refId: labId, minutes: 30 });
    return afterProgress(user, before);
  },
);
