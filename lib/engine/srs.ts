/**
 * Spaced repetition, tuned to be short and not annoying.
 *
 * Topics come back as a ladder of different kinds of recall — each one a
 * harder test of understanding than the last:
 *   day 1 learn → day 3 quiz → day 7 explain → day 14 implement → day 30 interview
 *
 * DSA problems that weren't solved cleanly come back as a cold re-solve.
 */
import { addDays } from "./dates";

export type ReviewKind = "quiz" | "explain" | "implement" | "interview" | "resolve";
export type ReviewResult = "pass" | "partial" | "fail";

/** Offsets are days after the day the topic was completed (day 1). */
export const TOPIC_LADDER: { stage: number; offset: number; kind: ReviewKind; minutes: number; label: string }[] = [
  { stage: 1, offset: 2, kind: "quiz", minutes: 3, label: "Quick quiz" },
  { stage: 2, offset: 6, kind: "explain", minutes: 5, label: "Explain it back" },
  { stage: 3, offset: 13, kind: "implement", minutes: 15, label: "Implement from memory" },
  { stage: 4, offset: 29, kind: "interview", minutes: 5, label: "Interview question" },
];

export type ScheduledReview = { stage: number; kind: ReviewKind; dueAt: string };

export function firstTopicReview(completedOn: string): ScheduledReview {
  const s = TOPIC_LADDER[0];
  return { stage: s.stage, kind: s.kind, dueAt: addDays(completedOn, s.offset) };
}

/**
 * What comes after a topic review.
 * - pass: climb the ladder, keeping the original spacing between rungs.
 * - partial: climb, but come back sooner (half the gap).
 * - fail: same rung again in 2 days — a gentle retry, not a punishment.
 * Returns null when the ladder is finished.
 */
export function nextTopicReview(stage: number, result: ReviewResult, today: string): ScheduledReview | null {
  const idx = TOPIC_LADDER.findIndex((s) => s.stage === stage);
  if (idx < 0) return null;
  if (result === "fail") {
    const s = TOPIC_LADDER[idx];
    return { stage: s.stage, kind: s.kind, dueAt: addDays(today, 2) };
  }
  const next = TOPIC_LADDER[idx + 1];
  if (!next) return null;
  const gap = next.offset - TOPIC_LADDER[idx].offset;
  const days = result === "partial" ? Math.max(2, Math.round(gap / 2)) : gap;
  return { stage: next.stage, kind: next.kind, dueAt: addDays(today, days) };
}

/**
 * When a DSA problem should come back, based on how the attempt went.
 * Returns null when the attempt was clean enough to trust.
 */
export function dsaReviewAfterAttempt(a: {
  solved: boolean;
  solutionViewed: boolean;
  hintsUsed: number;
  confidence: number;
}, today: string, stage = 0): ScheduledReview | null {
  let days: number | null;
  if (!a.solved || a.solutionViewed) days = 2;
  else if (a.confidence <= 2 || a.hintsUsed >= 2) days = 4;
  else if (a.confidence === 3 || a.hintsUsed === 1) days = 10;
  else days = stage === 0 ? 21 : null; // one confirmation re-solve for clean first solves
  if (days === null) return null;
  return { stage: stage + 1, kind: "resolve", dueAt: addDays(today, days) };
}

export function reviewMinutes(kind: ReviewKind) {
  if (kind === "resolve") return 20;
  return TOPIC_LADDER.find((s) => s.kind === kind)?.minutes ?? 5;
}
