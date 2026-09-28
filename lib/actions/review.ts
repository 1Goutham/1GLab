"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action } from "./util";
import { afterProgress, logEvent } from "@/lib/data/effects";
import { loadState } from "@/lib/data/state";
import { nextTopicReview } from "@/lib/engine/srs";
import { addDays, todayISO } from "@/lib/engine/dates";

export const submitReview = action(
  z.object({
    reviewId: z.number().int().positive(),
    result: z.enum(["pass", "partial", "fail"]),
    response: z.string().max(8000).default(""),
  }),
  async ({ reviewId, result, response }, user) => {
    const before = await loadState({ ...user });
    const review = await db.query.reviews.findFirst({ where: and(eq(s.reviews.id, reviewId), eq(s.reviews.userId, user.id)) });
    if (!review || review.completedAt) throw new Error("Review not found");
    await db.update(s.reviews).set({ completedAt: new Date(), result, response: response || null }).where(eq(s.reviews.id, reviewId));
    if (review.itemType === "topic") {
      const next = nextTopicReview(review.stage, result, todayISO(user.timezone));
      if (next) await db.insert(s.reviews).values({ userId: user.id, itemType: "topic", itemId: review.itemId, ...next });
    }
    await logEvent(user, "review_done", { refType: review.itemType, refId: review.itemId, minutes: 5, meta: { kind: review.kind, result } });
    return afterProgress(user, before);
  },
);

/** Push a review a couple of days out — for genuinely bad days. */
export const snoozeReview = action(z.object({ reviewId: z.number().int().positive(), days: z.number().int().min(1).max(7) }), async ({ reviewId, days }, user) => {
  const review = await db.query.reviews.findFirst({ where: and(eq(s.reviews.id, reviewId), eq(s.reviews.userId, user.id)) });
  if (!review) throw new Error("Review not found");
  await db.update(s.reviews).set({ dueAt: addDays(todayISO(user.timezone), days) }).where(eq(s.reviews.id, reviewId));
  return null;
});
