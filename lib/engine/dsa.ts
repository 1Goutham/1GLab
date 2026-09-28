/**
 * DSA weakness map + recommendation engine.
 *
 * Recommends problems for a reason, never at random:
 *   1. re-solves that are due (you failed or wobbled on these)
 *   2. weak patterns (recent fails, low confidence, repeated mistake types)
 *   3. this week's curriculum pattern
 *   4. difficulty progression inside a pattern (easy → medium → hard)
 *   5. interview relevance
 */
import { daysBetween } from "./dates";

export type MistakeType = "pattern" | "logic" | "syntax" | "edge_case" | "complexity" | "misread" | "forgot";

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  pattern: "Didn't understand pattern",
  logic: "Logic error",
  syntax: "Syntax error",
  edge_case: "Edge case",
  complexity: "Complexity mistake",
  misread: "Misread question",
  forgot: "Forgot technique",
};

export type Problem = {
  id: string;
  title: string;
  pattern: string;
  difficulty: "easy" | "medium" | "hard";
  minutes: number;
  freq: number;
  order: number;
};

export type Attempt = {
  problemId: string;
  solved: boolean;
  solutionViewed: boolean;
  hintsUsed: number;
  confidence: number;
  minutes: number;
  mistake: MistakeType | null;
  day: string; // ISO date
};

export type PatternStat = {
  pattern: string;
  total: number;
  attempted: number;
  solved: number;
  /** Unique problems solved cleanly (no solution viewed). */
  clean: number;
  recentFails: number;
  recentAttempts: number;
  avgConfidence: number | null;
  topMistake: MistakeType | null;
  mistakeCounts: Partial<Record<MistakeType, number>>;
  /** Actual time vs estimate across attempts (1 = on estimate). */
  timeRatio: number | null;
  /** 0 = strong, 1 = very weak. Unattempted patterns are neutral (0.5). */
  weakness: number;
  mastery: number; // 0-100
};

export function patternStats(problems: Problem[], attempts: Attempt[], today: string, windowDays = 14): Map<string, PatternStat> {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const stats = new Map<string, PatternStat>();
  for (const p of problems) {
    if (!stats.has(p.pattern)) {
      stats.set(p.pattern, {
        pattern: p.pattern,
        total: 0,
        attempted: 0,
        solved: 0,
        clean: 0,
        recentFails: 0,
        recentAttempts: 0,
        avgConfidence: null,
        topMistake: null,
        mistakeCounts: {},
        timeRatio: null,
        weakness: 0.5,
        mastery: 0,
      });
    }
    stats.get(p.pattern)!.total++;
  }

  const latest = new Map<string, Attempt>();
  const solvedIds = new Set<string>();
  const cleanIds = new Set<string>();
  const attemptedIds = new Set<string>();
  const ratios = new Map<string, number[]>();
  const sorted = [...attempts].sort((a, b) => a.day.localeCompare(b.day));

  for (const a of sorted) {
    const prob = byId.get(a.problemId);
    if (!prob) continue;
    const s = stats.get(prob.pattern)!;
    attemptedIds.add(a.problemId);
    latest.set(a.problemId, a);
    if (a.solved) solvedIds.add(a.problemId);
    if (a.solved && !a.solutionViewed) cleanIds.add(a.problemId);
    const recent = daysBetween(a.day, today) <= windowDays;
    if (recent) {
      s.recentAttempts++;
      if (!a.solved || a.solutionViewed) s.recentFails++;
      if (a.mistake) s.mistakeCounts[a.mistake] = (s.mistakeCounts[a.mistake] ?? 0) + 1;
    }
    if (a.minutes > 0) {
      const r = ratios.get(prob.pattern) ?? [];
      r.push(a.minutes / prob.minutes);
      ratios.set(prob.pattern, r);
    }
  }

  const confByPattern = new Map<string, number[]>();
  for (const [pid, a] of latest) {
    const prob = byId.get(pid)!;
    const arr = confByPattern.get(prob.pattern) ?? [];
    arr.push(a.confidence);
    confByPattern.set(prob.pattern, arr);
  }

  for (const s of stats.values()) {
    const ids = problems.filter((p) => p.pattern === s.pattern).map((p) => p.id);
    s.attempted = ids.filter((id) => attemptedIds.has(id)).length;
    s.solved = ids.filter((id) => solvedIds.has(id)).length;
    s.clean = ids.filter((id) => cleanIds.has(id)).length;
    const conf = confByPattern.get(s.pattern);
    s.avgConfidence = conf?.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null;
    const top = Object.entries(s.mistakeCounts).sort((a, b) => b[1] - a[1])[0];
    s.topMistake = (top?.[0] as MistakeType) ?? null;
    const r = ratios.get(s.pattern);
    s.timeRatio = r?.length ? r.reduce((a, b) => a + b, 0) / r.length : null;

    if (s.attempted === 0) {
      s.weakness = 0.5;
    } else {
      const failRate = s.recentAttempts ? s.recentFails / s.recentAttempts : 0;
      const confGap = s.avgConfidence === null ? 0.5 : (5 - s.avgConfidence) / 4;
      const slow = s.timeRatio === null ? 0 : Math.min(1, Math.max(0, s.timeRatio - 1));
      s.weakness = Math.min(1, 0.5 * failRate + 0.35 * confGap + 0.15 * slow);
    }
    // Mastery: clean coverage of the pattern (first 6 problems matter most) × confidence.
    const coverage = Math.min(1, s.clean / Math.min(6, s.total));
    const confFactor = s.avgConfidence === null ? 0 : s.avgConfidence / 5;
    s.mastery = Math.round(100 * coverage * (0.6 + 0.4 * confFactor) * (1 - 0.4 * s.weakness));
  }
  return stats;
}

export type Recommendation = {
  problem: Problem;
  reason: string;
  kind: "resolve" | "weakness" | "week" | "progression" | "interview";
  score: number;
};

const PATTERN_NAMES: Record<string, string> = {
  "two-pointers": "two pointers",
  "sliding-window": "sliding window",
  "linked-list": "linked lists",
  "binary-search": "binary search",
  "dynamic-programming": "dynamic programming",
  "union-find": "union find",
  bst: "BSTs",
};
export const patternName = (p: string) => PATTERN_NAMES[p] ?? p.replace(/-/g, " ");

function difficultyFit(p: Problem, s: PatternStat | undefined) {
  const clean = s?.clean ?? 0;
  if (p.difficulty === "easy") return clean < 2 ? 1 : 0.2;
  if (p.difficulty === "medium") return clean >= 1 ? 1 : 0.35;
  return clean >= 4 ? 0.9 : 0.05;
}

export function recommendProblems(input: {
  problems: Problem[];
  attempts: Attempt[];
  dueResolves: { problemId: string; dueAt: string }[];
  weekPattern: string | null;
  today: string;
  limit?: number;
}): Recommendation[] {
  const { problems, attempts, dueResolves, weekPattern, today, limit = 5 } = input;
  const stats = patternStats(problems, attempts, today);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const attempted = new Set(attempts.map((a) => a.problemId));
  const lastAttempt = new Map<string, Attempt>();
  for (const a of [...attempts].sort((a, b) => a.day.localeCompare(b.day))) lastAttempt.set(a.problemId, a);

  const recs: Recommendation[] = [];

  for (const r of dueResolves) {
    const p = byId.get(r.problemId);
    const last = lastAttempt.get(r.problemId);
    if (!p || !last) continue;
    const why = last.mistake ? ` (${MISTAKE_LABELS[last.mistake].toLowerCase()})` : "";
    const when = daysBetween(last.day, today);
    recs.push({
      problem: p,
      kind: "resolve",
      score: 100 + (daysBetween(r.dueAt, today) || 0),
      reason: !last.solved || last.solutionViewed
        ? `You couldn't crack this ${when} day${when === 1 ? "" : "s"} ago${why}. Solve it cold — no hints — to prove the idea stuck.`
        : `You solved this with low confidence${why}. A clean re-solve now locks the pattern in.`,
    });
  }

  for (const p of problems) {
    if (attempted.has(p.id)) continue;
    const s = stats.get(p.pattern);
    const weak = s && s.attempted > 0 ? s.weakness : 0;
    const isWeek = weekPattern === p.pattern;
    const fit = difficultyFit(p, s);
    const score = weak * 40 + (isWeek ? 22 : 0) + fit * 18 + p.freq * 4 - p.order * 0.01;

    let kind: Recommendation["kind"] = "progression";
    let reason: string;
    if (s && weak >= 0.45 && s.recentFails >= 2) {
      kind = "weakness";
      const mistake = s.topMistake ? ` — mostly "${MISTAKE_LABELS[s.topMistake].toLowerCase()}"` : "";
      reason = `You struggled with ${patternName(p.pattern)} ${s.recentFails} times in the last two weeks${mistake}. This problem targets exactly that.`;
    } else if (isWeek) {
      kind = "week";
      reason =
        (s?.clean ?? 0) === 0
          ? `This week's pattern is ${patternName(p.pattern)}. Start here — it's the cleanest example of the idea.`
          : `This week's pattern is ${patternName(p.pattern)}. You've got ${s!.clean} clean solve${s!.clean === 1 ? "" : "s"}; this is the next step up.`;
    } else if (p.freq === 3) {
      kind = "interview";
      reason = `Asked constantly in interviews, and it's the next ${p.difficulty} step in ${patternName(p.pattern)}.`;
    } else {
      reason = `Next step in ${patternName(p.pattern)} at the right difficulty for where you are.`;
    }
    recs.push({ problem: p, kind, score, reason });
  }

  const top = recs.sort((a, b) => b.score - a.score).slice(0, limit);
  // Several picks from the same pattern shouldn't all repeat the same "why".
  const seen = new Map<string, number>();
  for (const r of top) {
    if (r.kind === "resolve") continue;
    const n = seen.get(r.problem.pattern) ?? 0;
    seen.set(r.problem.pattern, n + 1);
    if (n === 0) continue;
    r.reason =
      r.problem.freq === 3
        ? `Then this one: a classic ${r.problem.difficulty} ${patternName(r.problem.pattern)} problem interviewers love.`
        : `Then this one: it pushes the same ${patternName(r.problem.pattern)} idea a step further.`;
  }
  return top;
}
