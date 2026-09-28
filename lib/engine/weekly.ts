/** Weekly engineering review and monthly level-up criteria. */
import { patternName } from "./dsa";

export type WeeklyInput = {
  topicsCompleted: { id: string; title: string }[];
  dsaSolved: number;
  dsaAttempted: number;
  labsCompleted: { id: string; title: string }[];
  focusMinutes: number;
  learnMinutes: number;
  categoryNow: Record<string, number>;
  categoryWeekAgo: Record<string, number> | null;
  categoryNames: Record<string, string>;
  patternMasteryNow: Record<string, number>;
  patternMasteryWeekAgo: Record<string, number> | null;
  failedReviews: { title: string }[];
  overdueTopics: { title: string }[];
  weakestSkills: { name: string; overall: number }[];
  nextWeekTopics: { title: string }[];
  weakPatterns: string[];
};

export type WeeklyReview = {
  learned: number;
  learnedTitles: string[];
  solved: number;
  built: number;
  builtTitles: string[];
  deepWorkMinutes: number;
  weakestArea: string | null;
  mostImproved: string | null;
  forgotten: string[];
  nextFocus: string[];
};

export function weeklyReview(i: WeeklyInput): WeeklyReview {
  const weakestCat = Object.entries(i.categoryNow).sort((a, b) => a[1] - b[1])[0];

  let mostImproved: string | null = null;
  let bestDelta = 0;
  if (i.categoryWeekAgo) {
    for (const [k, v] of Object.entries(i.categoryNow)) {
      const d = v - (i.categoryWeekAgo[k] ?? v);
      if (d > bestDelta) {
        bestDelta = d;
        mostImproved = i.categoryNames[k] ?? k;
      }
    }
  }
  for (const [k, v] of Object.entries(i.patternMasteryNow)) {
    const d = v - (i.patternMasteryWeekAgo?.[k] ?? 0);
    if (d > bestDelta) {
      bestDelta = d;
      mostImproved = patternName(k)[0].toUpperCase() + patternName(k).slice(1);
    }
  }

  const forgotten = [...new Set([...i.failedReviews.map((r) => r.title), ...i.overdueTopics.map((t) => t.title)])].slice(0, 3);

  const nextFocus: string[] = [];
  for (const s of i.weakestSkills.slice(0, 2)) nextFocus.push(s.name);
  for (const p of i.weakPatterns.slice(0, 1)) nextFocus.push(patternName(p)[0].toUpperCase() + patternName(p).slice(1));
  for (const t of i.nextWeekTopics) if (nextFocus.length < 4) nextFocus.push(t.title);

  return {
    learned: i.topicsCompleted.length,
    learnedTitles: i.topicsCompleted.map((t) => t.title),
    solved: i.dsaSolved,
    built: i.labsCompleted.length,
    builtTitles: i.labsCompleted.map((l) => l.title),
    deepWorkMinutes: i.focusMinutes + i.learnMinutes,
    weakestArea: weakestCat ? i.categoryNames[weakestCat[0]] ?? weakestCat[0] : null,
    mostImproved,
    forgotten,
    nextFocus: [...new Set(nextFocus)].slice(0, 4),
  };
}

/**
 * A month's level unlocks when the work is genuinely done: most of its
 * concepts completed, and at least two of its labs built.
 */
export function monthUnlocked(i: { topicsTotal: number; topicsCompleted: number; labsCompleted: number }) {
  if (i.topicsTotal === 0) return false;
  return i.topicsCompleted / i.topicsTotal >= 0.75 && i.labsCompleted >= 2;
}
