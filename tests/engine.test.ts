import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, programDay, programWeek, weekStart } from "../lib/engine/dates";
import { firstTopicReview, nextTopicReview, dsaReviewAfterAttempt } from "../lib/engine/srs";
import { patternStats, recommendProblems, type Attempt, type Problem } from "../lib/engine/dsa";
import { scoreSkills } from "../lib/engine/progress";
import { buildMission, type MissionLab, type MissionTopic } from "../lib/engine/mission";
import { planWeek } from "../lib/engine/planner";
import { pickInsight, repeatedJournalTerm } from "../lib/engine/insights";
import { currentStreak } from "../lib/engine/activity";
import { monthUnlocked } from "../lib/engine/weekly";

const today = "2026-09-28";

test("dates: program day/week and week start", () => {
  assert.equal(programDay("2026-09-11", today), 18);
  assert.equal(programWeek("2026-09-11", today), 3);
  assert.equal(weekStart("2026-09-28"), "2026-09-28"); // a Monday
  assert.equal(weekStart("2026-10-04"), "2026-09-28"); // Sunday belongs to the same week
  assert.equal(daysBetween("2026-09-28", addDays("2026-09-28", 30)), 30);
});

test("srs: topic ladder is day 3 quiz → day 7 explain → day 14 implement → day 30 interview", () => {
  const r1 = firstTopicReview("2026-09-01");
  assert.deepEqual(r1, { stage: 1, kind: "quiz", dueAt: "2026-09-03" });
  const r2 = nextTopicReview(1, "pass", "2026-09-03")!;
  assert.equal(r2.kind, "explain");
  assert.equal(r2.dueAt, "2026-09-07");
  const r3 = nextTopicReview(2, "pass", "2026-09-07")!;
  assert.equal(r3.kind, "implement");
  assert.equal(r3.dueAt, "2026-09-14");
  const r4 = nextTopicReview(3, "pass", "2026-09-14")!;
  assert.equal(r4.kind, "interview");
  assert.equal(r4.dueAt, "2026-09-30");
  assert.equal(nextTopicReview(4, "pass", "2026-09-30"), null);
});

test("srs: failing repeats the same rung gently; partial comes back sooner", () => {
  assert.deepEqual(nextTopicReview(2, "fail", today), { stage: 2, kind: "explain", dueAt: addDays(today, 2) });
  const partial = nextTopicReview(2, "partial", today)!;
  assert.equal(partial.stage, 3);
  assert.ok(daysBetween(today, partial.dueAt) < 7);
});

test("srs: DSA re-solve timing depends on how the attempt went", () => {
  assert.equal(dsaReviewAfterAttempt({ solved: false, solutionViewed: false, hintsUsed: 0, confidence: 2 }, today)!.dueAt, addDays(today, 2));
  assert.equal(dsaReviewAfterAttempt({ solved: true, solutionViewed: false, hintsUsed: 0, confidence: 2 }, today)!.dueAt, addDays(today, 4));
  assert.equal(dsaReviewAfterAttempt({ solved: true, solutionViewed: false, hintsUsed: 0, confidence: 5 }, today, 1), null);
});

const problems: Problem[] = [
  { id: "a1", title: "A1", pattern: "arrays", difficulty: "easy", minutes: 20, freq: 3, order: 0 },
  { id: "a2", title: "A2", pattern: "arrays", difficulty: "medium", minutes: 35, freq: 2, order: 1 },
  { id: "s1", title: "S1", pattern: "sliding-window", difficulty: "medium", minutes: 35, freq: 3, order: 2 },
  { id: "s2", title: "S2", pattern: "sliding-window", difficulty: "medium", minutes: 35, freq: 2, order: 3 },
  { id: "s3", title: "S3", pattern: "sliding-window", difficulty: "easy", minutes: 20, freq: 1, order: 4 },
];
const fail = (problemId: string, day: string): Attempt => ({ problemId, solved: false, solutionViewed: true, hintsUsed: 2, confidence: 1, minutes: 50, mistake: "pattern", day });

test("dsa: repeated failures make a pattern weak and drive the recommendation", () => {
  const attempts = [fail("s1", "2026-09-25"), fail("s2", "2026-09-26"), fail("s1", "2026-09-27")];
  const stats = patternStats(problems, attempts, today);
  assert.ok(stats.get("sliding-window")!.weakness > 0.6);
  assert.equal(stats.get("sliding-window")!.topMistake, "pattern");
  const recs = recommendProblems({ problems, attempts, dueResolves: [], weekPattern: "arrays", today });
  assert.equal(recs[0].problem.id, "s3");
  assert.equal(recs[0].kind, "weakness");
  assert.match(recs[0].reason, /struggled with sliding window 3 times/);
});

test("dsa: due re-solves come first", () => {
  const attempts = [fail("a1", "2026-09-26")];
  const recs = recommendProblems({ problems, attempts, dueResolves: [{ problemId: "a1", dueAt: today }], weekPattern: "arrays", today });
  assert.equal(recs[0].kind, "resolve");
  assert.equal(recs[0].problem.id, "a1");
});

test("progress: baseline fades out as evidence arrives", () => {
  const input = (levelReached: number, miniTaskDone: boolean) => ({
    skills: [{ id: "attention", name: "Attention", categoryId: "ai-depth", parentId: "transformers", baseline: 40 }],
    topics: [{ id: "self-attention", title: "Self-attention", skillIds: ["attention"], week: 10 }],
    topicProgress: levelReached ? [{ topicId: "self-attention", levelReached, miniTaskDone, status: "completed" }] : [],
    labs: [],
    labProgress: [],
    projectEvidence: [],
    dsaMastery: {},
    reviews: [],
  });
  const none = scoreSkills(input(0, false)).get("attention")!;
  assert.equal(none.overall, 40);
  assert.ok(none.selfReported);
  const done = scoreSkills(input(5, true)).get("attention")!;
  assert.equal(done.dims.knowledge, 100);
  assert.equal(done.dims.implementation, 100);
  assert.ok(done.overall > 40 && done.overall <= 100);
});

const topic = (o: Partial<MissionTopic>): MissionTopic => ({
  id: "t",
  title: "T",
  week: 1,
  order: 0,
  domain: "ai",
  minutes: 60,
  difficulty: "medium",
  miniTaskTitle: "mini",
  status: "not_started",
  completedToday: false,
  touchedToday: false,
  ...o,
});
const lab = (o: Partial<MissionLab>): MissionLab => ({
  id: "l",
  title: "L",
  week: 1,
  minutes: 90,
  difficulty: "medium",
  objective: "build",
  status: "not_started",
  isFlagship: false,
  touchedToday: false,
  stepsDone: 0,
  stepsTotal: 5,
  ...o,
});

test("mission: four missions, in-progress topic first, reflect when no reviews", () => {
  const { items } = buildMission({
    week: 1,
    dailyMinutes: 150,
    dsa: { problem: problems[0], reason: "why", kind: "week", score: 1 },
    dsaDoneToday: null,
    topics: [topic({ id: "a", order: 0 }), topic({ id: "b", order: 1, status: "learning" })],
    labs: [lab({})],
    reviewsDue: { count: 0, minutes: 0, dsaFails: 0 },
    reviewsDoneToday: 0,
    journaledToday: false,
    signals: { videosWatched7d: 0, buildsDone7d: 0, overdueReviews: 0, energy: "medium" },
  });
  assert.deepEqual(items.map((i) => i.kind), ["dsa", "learn", "build", "reflect"]);
  assert.equal(items[1].title, "T");
  assert.equal(items[1].href, "/learn/b");
});

test("mission: watching without building moves the build up and shrinks to budget", () => {
  const { items, note } = buildMission({
    week: 1,
    dailyMinutes: 90,
    dsa: { problem: problems[0], reason: "why", kind: "week", score: 1 },
    dsaDoneToday: null,
    topics: [topic({})],
    labs: [lab({ minutes: 180 })],
    reviewsDue: { count: 3, minutes: 15, dsaFails: 1 },
    reviewsDoneToday: 0,
    journaledToday: false,
    signals: { videosWatched7d: 4, buildsDone7d: 0, overdueReviews: 0, energy: "medium" },
  });
  assert.equal(items[1].kind, "build");
  assert.match(note!, /watched more than you've built/);
  assert.ok(items.find((i) => i.kind === "build")!.minutes >= 20);
  assert.equal(items.at(-1)!.title, "Yesterday's mistakes");
});

test("planner: never plans more than ~85% of the day and keeps Sunday light", () => {
  const { days } = planWeek({
    weekStart: "2026-09-28",
    dailyMinutes: 150,
    topics: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, title: `T${i}`, minutes: 60 })),
    labs: [{ id: "l", title: "L", minutes: 600, isFlagship: false }],
    dsaPattern: "arrays",
    dsaPerDay: 1,
    reviewsByDay: { "2026-09-30": 2 },
    unfinishedTasks: [],
  });
  assert.equal(days.length, 7);
  for (const d of days) assert.ok(d.minutes <= Math.round(150 * 0.85) + 25, `${d.date} has ${d.minutes}`);
  assert.ok(days[6].items.some((i) => i.title.includes("Weekly")));
  assert.ok(days[2].items.some((i) => i.type === "review"));
});

test("insights: learned-but-not-built beats everything", () => {
  const insight = pickInsight({
    completedTopics: [{ id: "rag-pipeline", title: "The RAG pipeline", skillIds: ["rag"] }],
    labs: [{ id: "pdf-rag-assistant", title: "PDF RAG assistant", skillIds: ["rag"], topicIds: ["rag-pipeline"], status: "not_started", week: 14 }],
    currentWeek: 14,
    videosWatched7d: 5,
    buildsDone7d: 0,
    overdueReviews: 0,
    reviewsDone7d: 0,
    topicsCompleted7d: 0,
    weakPattern: null,
    journalTexts: [],
    knownTerms: [],
  })!;
  assert.equal(insight.kind, "learned-not-built");
  assert.equal(insight.href, "/labs/pdf-rag-assistant");
});

test("insights: repeated journal term is detected", () => {
  const hit = repeatedJournalTerm(["vector databases confuse me", "read about vector databases", "Vector Databases again"], [
    { term: "Vector databases", topicId: "vector-databases-pgvector", completed: false },
  ]);
  assert.equal(hit?.count, 3);
});

test("streak counts back from today or yesterday", () => {
  const days = new Set(["2026-09-26", "2026-09-27"]);
  assert.equal(currentStreak(days, today), 2);
  days.add(today);
  assert.equal(currentStreak(days, today), 3);
});

test("level-up needs real work", () => {
  assert.equal(monthUnlocked({ topicsTotal: 12, topicsCompleted: 12, labsCompleted: 1 }), false);
  assert.equal(monthUnlocked({ topicsTotal: 12, topicsCompleted: 9, labsCompleted: 2 }), true);
});
