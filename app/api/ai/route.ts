import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getUserOrThrow, UnauthorizedError } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { generateWeekPlan } from "@/lib/ai/recommendations";
import { analyseJournal } from "@/lib/ai/summarisation";
import { gradeAnswer } from "@/lib/ai/evaluation";
import { AI_LIMIT, rateLimit } from "@/lib/ai/rate-limit";
import type { LessonContent } from "@/content/types";

export const maxDuration = 60;

/**
 * Non-streaming AI tasks behind one authenticated, rate-limited endpoint.
 * Every task has a deterministic fallback, so a missing key never breaks a page.
 */
const Body = z.discriminatedUnion("task", [
  z.object({ task: z.literal("plan-week") }),
  z.object({ task: z.literal("journal-insight") }),
  z.object({ task: z.literal("grade-review"), reviewId: z.number().int().positive(), answer: z.string().max(8000) }),
]);

export async function POST(req: Request) {
  let user;
  try {
    user = await getUserOrThrow();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (!rateLimit(`ai:${user.id}`, AI_LIMIT.limit, AI_LIMIT.windowMs).ok) {
    return Response.json({ error: "Slow down a little — try again in a few minutes." }, { status: 429 });
  }
  const body = parsed.data;
  const st = await loadState(user);

  try {
    switch (body.task) {
      case "plan-week": {
        const plan = await generateWeekPlan(st);
        await db
          .insert(s.weekPlans)
          .values({ userId: user.id, weekStart: plan.weekStart, rationale: plan.rationale, days: plan.days })
          .onConflictDoUpdate({
            target: [s.weekPlans.userId, s.weekPlans.weekStart],
            set: { rationale: plan.rationale, days: plan.days, createdAt: new Date() },
          });
        revalidatePath("/tasks");
        return Response.json(plan);
      }
      case "journal-insight":
        return Response.json(await analyseJournal(st));
      case "grade-review": {
        const review = await db.query.reviews.findFirst({ where: and(eq(s.reviews.id, body.reviewId), eq(s.reviews.userId, user.id)) });
        if (!review || review.itemType !== "topic") return Response.json({ grade: null });
        const lesson = await db.query.lessons.findFirst({ where: eq(s.lessons.topicId, review.itemId) });
        const topic = st.topics.find((t) => t.id === review.itemId);
        if (!lesson || !topic) return Response.json({ grade: null });
        const c = lesson.content as LessonContent;
        const prompt = review.kind === "explain" ? c.explainPrompt : review.kind === "implement" ? c.implementPrompt : c.levels.l5.question;
        const modelAnswer = review.kind === "interview" ? c.levels.l5.answer : `${c.levels.l1}\n${c.levels.l2.text}\n${c.levels.l3.text}\n${c.levels.l5.answer}`;
        return Response.json({ grade: await gradeAnswer({ kind: review.kind, topic: topic.title, prompt, modelAnswer, answer: body.answer }) });
      }
    }
  } catch (err) {
    console.error("[ai]", err);
    return Response.json({ error: "Your mentor is taking a short break. Everything else still works." }, { status: 503 });
  }
}
