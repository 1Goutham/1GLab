"use server";

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action, slug } from "./util";
import { afterProgress, logEvent } from "@/lib/data/effects";
import { loadState } from "@/lib/data/state";
import { dsaReviewAfterAttempt } from "@/lib/engine/srs";
import { todayISO } from "@/lib/engine/dates";

export const logAttempt = action(
  z.object({
    problemId: slug,
    solved: z.boolean(),
    minutes: z.number().int().min(1).max(600),
    hintsUsed: z.number().int().min(0).max(10),
    solutionViewed: z.boolean(),
    confidence: z.number().int().min(1).max(5),
    mistake: z.enum(["pattern", "logic", "syntax", "edge_case", "complexity", "misread", "forgot"]).nullable(),
    notes: z.string().max(4000).default(""),
  }),
  async (input, user) => {
    const before = await loadState({ ...user });
    const today = todayISO(user.timezone);
    await db.insert(s.dsaAttempts).values({ ...input, userId: user.id, notes: input.notes || null });

    // Close any open re-solve for this problem; its outcome is this attempt.
    const open = await db.query.reviews.findFirst({
      where: and(eq(s.reviews.userId, user.id), eq(s.reviews.itemType, "dsa"), eq(s.reviews.itemId, input.problemId), isNull(s.reviews.completedAt)),
    });
    const clean = input.solved && !input.solutionViewed;
    if (open) {
      await db
        .update(s.reviews)
        .set({ completedAt: new Date(), result: clean ? (input.confidence >= 4 ? "pass" : "partial") : "fail" })
        .where(eq(s.reviews.id, open.id));
    }
    const next = dsaReviewAfterAttempt(input, today, open?.stage ?? 0);
    if (next) await db.insert(s.reviews).values({ userId: user.id, itemType: "dsa", itemId: input.problemId, ...next });

    await logEvent(user, "dsa_attempt", {
      refType: "dsa",
      refId: input.problemId,
      minutes: input.minutes,
      meta: { solved: input.solved, mistake: input.mistake },
    });
    const feedback = await afterProgress(user, before);
    return { feedback, nextReview: next?.dueAt ?? null };
  },
);
