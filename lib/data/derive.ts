import "server-only";
import type { LearnerState } from "./state";
import { patternStats, recommendProblems, type Attempt, type Problem } from "@/lib/engine/dsa";
import { categoryScores, nextWeakness, scoreSkills, type SkillScore, type Dimension } from "@/lib/engine/progress";
import { buildMission, type MissionLab, type MissionTopic } from "@/lib/engine/mission";
import { pickInsight } from "@/lib/engine/insights";
import { currentStreak, consistency, dailySeries, longestStreak } from "@/lib/engine/activity";
import { addDays, daysBetween } from "@/lib/engine/dates";
import { reviewMinutes } from "@/lib/engine/srs";
import { monthUnlocked } from "@/lib/engine/weekly";

/** Pure-ish derivations on top of `loadState`. Every page uses these, so every page agrees. */

export function problemsOf(st: LearnerState): Problem[] {
  return st.problems.map((p) => ({ id: p.id, title: p.title, pattern: p.pattern, difficulty: p.difficulty, minutes: p.minutes, freq: p.freq, order: p.order }));
}

export function attemptsOf(st: LearnerState): Attempt[] {
  return st.attempts.map((a) => ({
    problemId: a.problemId,
    solved: a.solved,
    solutionViewed: a.solutionViewed,
    hintsUsed: a.hintsUsed,
    confidence: a.confidence,
    minutes: a.minutes,
    mistake: a.mistake,
    day: a.day,
  }));
}

export function dsaView(st: LearnerState) {
  const stats = patternStats(problemsOf(st), attemptsOf(st), st.today);
  const dueResolves = st.reviews
    .filter((r) => r.itemType === "dsa" && !r.completedAt && r.dueAt <= st.today)
    .map((r) => ({ problemId: r.itemId, dueAt: r.dueAt }));
  const weekPattern = st.weeks.find((w) => w.week === st.week)?.dsaPattern ?? null;
  const recs = recommendProblems({ problems: problemsOf(st), attempts: attemptsOf(st), dueResolves, weekPattern, today: st.today, limit: 6 });
  const weak = [...stats.values()].filter((s) => s.attempted > 0).sort((a, b) => b.weakness - a.weakness)[0] ?? null;
  const solvedIds = new Set(st.attempts.filter((a) => a.solved).map((a) => a.problemId));
  return { stats, recs, weakPattern: weak && weak.weakness >= 0.4 ? weak : null, weekPattern, solved: solvedIds.size };
}

export function scoresOf(st: LearnerState) {
  const { stats } = dsaView(st);
  const dsaMastery: Record<string, number> = {};
  for (const [k, v] of stats) dsaMastery[k] = v.attempted ? v.mastery : 0;
  const scores = scoreSkills({
    skills: st.skills.filter((k) => !k.isGroup).map((k) => ({ id: k.id, name: k.name, categoryId: k.categoryId, parentId: k.parentId, baseline: k.baseline })),
    topics: st.topics,
    topicProgress: st.topicProgress,
    labs: st.labs.map((l) => ({ id: l.id, title: l.title, skillIds: l.skillIds, week: l.week })),
    labProgress: st.labProgress,
    projectEvidence: st.projects.map((p) => p.skillEvidence),
    dsaMastery: Object.fromEntries(Object.entries(dsaMastery).filter(([, v]) => v > 0)),
    reviews: st.reviews.map((r) => ({
      itemType: r.itemType,
      itemId: r.itemType === "dsa" ? st.problems.find((p) => p.id === r.itemId)?.pattern ?? r.itemId : r.itemId,
      kind: r.kind,
      result: r.result,
      completed: Boolean(r.completedAt),
      overdue: !r.completedAt && daysBetween(r.dueAt, st.today) > 2,
    })),
  });
  return { scores, categories: categoryScores(scores) };
}

export function activityOf(st: LearnerState) {
  const days = new Set(st.events.map((e) => e.day));
  const focusMinutes = (from: string) =>
    st.events.filter((e) => e.day >= from && (e.type === "focus_done")).reduce((a, e) => a + (e.minutes ?? 0), 0);
  return {
    streak: currentStreak(days, st.today),
    longest: longestStreak(days),
    consistency: consistency(days, st.today, 14, st.user.startDate),
    series: dailySeries(
      st.events.filter((e) => e.minutes).map((e) => ({ day: e.day, minutes: e.minutes })),
      st.today,
      28,
    ),
    activeToday: days.has(st.today),
    focusToday: focusMinutes(st.today),
    focusTotal: st.events.filter((e) => e.type === "focus_done").reduce((a, e) => a + (e.minutes ?? 0), 0),
    eventsSince: (from: string, type: string) => st.events.filter((e) => e.day >= from && e.type === type),
  };
}

export function topicStatus(st: LearnerState, id: string) {
  return st.topicProgress.find((p) => p.topicId === id);
}

export function missionOf(st: LearnerState, energy: "low" | "medium" | "high" = "medium") {
  const dsa = dsaView(st);
  const week7 = addDays(st.today, -6);
  const todayAttempt = [...st.attempts].reverse().find((a) => a.day === st.today);
  const touchedToday = (type: string, id: string) => st.events.some((e) => e.day === st.today && e.refId === id && e.type.startsWith(type));

  const topics: MissionTopic[] = st.topics.map((t) => {
    const p = topicStatus(st, t.id);
    return {
      id: t.id,
      title: t.title,
      week: t.week,
      order: t.order,
      domain: t.domain,
      minutes: t.minutes,
      difficulty: t.difficulty,
      miniTaskTitle: t.miniTaskTitle,
      status: p?.status ?? "not_started",
      completedToday: Boolean(p?.completedAt && st.dayOf(p.completedAt) === st.today),
      touchedToday: touchedToday("topic", t.id) || touchedToday("mini_task", t.id),
    };
  });
  const labs: MissionLab[] = st.labs.map((l) => {
    const p = st.labProgress.find((x) => x.labId === l.id);
    return {
      id: l.id,
      title: l.title,
      week: l.week,
      minutes: l.minutes,
      difficulty: l.difficulty,
      objective: l.objective,
      status: p?.status ?? "not_started",
      isFlagship: l.isFlagship,
      touchedToday: touchedToday("lab", l.id),
      stepsDone: p?.stepsDone.length ?? 0,
      stepsTotal: l.steps.length,
    };
  });

  const due = st.reviews.filter((r) => !r.completedAt && r.dueAt <= st.today);
  const overdue = due.filter((r) => daysBetween(r.dueAt, st.today) > 2).length;
  const reviewsDoneToday = st.reviews.filter((r) => r.completedAt && st.dayOf(r.completedAt) === st.today).length;

  const mission = buildMission({
    week: st.week,
    dailyMinutes: st.user.dailyMinutes,
    dsa: dsa.recs[0] ?? null,
    dsaDoneToday: todayAttempt ? { id: todayAttempt.problemId, title: st.problems.find((p) => p.id === todayAttempt.problemId)?.title ?? todayAttempt.problemId } : null,
    topics,
    labs,
    reviewsDue: {
      count: due.length,
      minutes: due.reduce((a, r) => a + reviewMinutes(r.kind), 0),
      dsaFails: due.filter((r) => r.itemType === "dsa").length,
    },
    reviewsDoneToday,
    journaledToday: st.journal.some((j) => j.date === st.today),
    signals: {
      videosWatched7d: st.events.filter((e) => e.day >= week7 && e.type === "video_watched").length,
      buildsDone7d: st.events.filter((e) => e.day >= week7 && (e.type === "lab_completed" || e.type === "mini_task_done" || e.type === "lab_started")).length,
      overdueReviews: overdue,
      energy,
    },
  });
  return { ...mission, dueReviews: due.length, overdue };
}

export function insightOf(st: LearnerState) {
  const dsa = dsaView(st);
  const week7 = addDays(st.today, -6);
  const completed = st.topics.filter((t) => topicStatus(st, t.id)?.status === "completed");
  return pickInsight({
    completedTopics: completed.map((t) => ({ id: t.id, title: t.title, skillIds: t.skillIds })),
    labs: st.labs.map((l) => ({
      id: l.id,
      title: l.title,
      skillIds: l.skillIds,
      topicIds: l.topicIds,
      week: l.week,
      status: st.labProgress.find((p) => p.labId === l.id)?.status ?? "not_started",
    })),
    currentWeek: st.week,
    videosWatched7d: st.events.filter((e) => e.day >= week7 && e.type === "video_watched").length,
    buildsDone7d: st.events.filter((e) => e.day >= week7 && ["lab_completed", "mini_task_done", "lab_started"].includes(e.type)).length,
    overdueReviews: st.reviews.filter((r) => !r.completedAt && daysBetween(r.dueAt, st.today) > 2).length,
    reviewsDone7d: st.events.filter((e) => e.day >= week7 && e.type === "review_done").length,
    topicsCompleted7d: st.events.filter((e) => e.day >= week7 && e.type === "topic_completed").length,
    weakPattern: dsa.weakPattern,
    journalTexts: st.journal.slice(0, 14).flatMap((j) => [j.confused, j.revisit, j.learned]),
    knownTerms: st.topics.flatMap((t) => {
      const done = topicStatus(st, t.id)?.status === "completed";
      const lab = st.labs.find((l) => l.topicIds.includes(t.id));
      const terms = [t.title.split(/[:&(]/)[0].trim(), ...t.tags].filter((x) => x.length >= 4);
      return terms.map((term) => ({ term, topicId: t.id, completed: done, labId: lab?.id }));
    }),
  });
}

/** The single topic to resume: most recently touched unfinished topic. */
export function continueTopic(st: LearnerState) {
  const inProgress = st.topicProgress
    .filter((p) => p.status !== "completed" && p.status !== "not_started")
    .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))[0];
  const t = inProgress ? st.topics.find((x) => x.id === inProgress.topicId) : null;
  if (!t) return null;
  const mod = st.modules.find((m) => m.id === t.moduleId);
  return { topic: t, module: mod, level: inProgress!.levelReached };
}

export function monthStatus(st: LearnerState) {
  return st.modules.map((m) => {
    const ts = st.topics.filter((t) => t.moduleId === m.id);
    const ls = st.labs.filter((l) => l.moduleId === m.id);
    const tDone = ts.filter((t) => topicStatus(st, t.id)?.status === "completed").length;
    const lDone = ls.filter((l) => st.labProgress.find((p) => p.labId === l.id)?.status === "completed").length;
    return {
      module: m,
      topicsTotal: ts.length,
      topicsCompleted: tDone,
      labsTotal: ls.length,
      labsCompleted: lDone,
      unlocked: monthUnlocked({ topicsTotal: ts.length, topicsCompleted: tDone, labsCompleted: lDone }),
      current: m.month === st.month,
    };
  });
}

export const WEAKNESS_ACTION: Record<Dimension, (skill: SkillScore) => string> = {
  knowledge: (s) => `Learn the next ${s.name} topic properly — all five levels.`,
  implementation: (s) => `Implement something with ${s.name} — a mini task or a lab, not another read.`,
  projects: (s) => `Use ${s.name} in a real project. Evidence beats intention.`,
  problemSolving: (s) => `Solve ${s.name} problems cold — no hints for the first 15 minutes.`,
  explanation: (s) => `Explain ${s.name} out loud to the mentor in five sentences.`,
  retention: (s) => `Review ${s.name} before it fades — your recall is slipping.`,
};

export function weaknessOf(st: LearnerState) {
  const { scores } = scoresOf(st);
  const focus = new Set<string>();
  for (const t of st.topics.filter((t) => t.week <= st.week && t.week >= st.week - 4)) t.skillIds.forEach((x) => focus.add(x));
  const w = nextWeakness(scores, [...focus]);
  if (!w) return null;
  return { ...w, action: WEAKNESS_ACTION[w.dimension](w.skill) };
}
