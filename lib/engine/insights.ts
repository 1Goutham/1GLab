/**
 * The personalisation engine's voice: one sharp, actionable observation at a
 * time, backed by the learner's own data. Rules are ordered by how much they
 * matter for real competence; the first that fires wins.
 */
import { patternName, type PatternStat, MISTAKE_LABELS } from "./dsa";

export type Insight = { text: string; cta: string; href: string; kind: string };

export type InsightInput = {
  completedTopics: { id: string; title: string; skillIds: string[] }[];
  labs: { id: string; title: string; skillIds: string[]; topicIds: string[]; status: string; week: number }[];
  currentWeek: number;
  videosWatched7d: number;
  buildsDone7d: number;
  overdueReviews: number;
  reviewsDone7d: number;
  topicsCompleted7d: number;
  weakPattern: PatternStat | null;
  journalTexts: string[];
  knownTerms: { term: string; topicId: string; completed: boolean; labId?: string }[];
};

export function repeatedJournalTerm(texts: string[], terms: InsightInput["knownTerms"]) {
  const corpus = texts.join("\n").toLowerCase();
  let best: { term: string; count: number; topicId: string; labId?: string } | null = null;
  for (const t of terms) {
    if (t.completed) continue;
    const needle = t.term.toLowerCase();
    let count = 0;
    let i = corpus.indexOf(needle);
    while (i !== -1) {
      count++;
      i = corpus.indexOf(needle, i + needle.length);
    }
    if (count >= 3 && (!best || count > best.count)) best = { term: t.term, count, topicId: t.topicId, labId: t.labId };
  }
  return best;
}

export function pickInsight(i: InsightInput): Insight | null {
  // 1. Learned it but never built it: the gap between knowing and doing.
  for (const t of [...i.completedTopics].reverse()) {
    const lab = i.labs.find((l) => l.topicIds.includes(t.id) && l.status === "not_started");
    if (lab) {
      return {
        kind: "learned-not-built",
        text: `You've learned ${t.title}, but haven't built ${lab.title} yet. Knowing isn't the same as shipping.`,
        cta: "Start lab",
        href: `/labs/${lab.id}`,
      };
    }
  }

  // 2. The journal keeps mentioning something that hasn't been implemented.
  const term = repeatedJournalTerm(i.journalTexts, i.knownTerms);
  if (term) {
    return {
      kind: "journal-term",
      text: `You've mentioned "${term.term}" ${term.count} times in your journal without implementing it. Make it tomorrow's lab.`,
      cta: term.labId ? "Open lab" : "Learn it",
      href: term.labId ? `/labs/${term.labId}` : `/learn/${term.topicId}`,
    };
  }

  // 3. Watching instead of building.
  if (i.videosWatched7d >= 3 && i.buildsDone7d === 0) {
    const lab = i.labs.find((l) => l.status !== "completed" && l.week <= i.currentWeek);
    return {
      kind: "watch-not-build",
      text: `${i.videosWatched7d} videos this week, zero builds. The next hour should be in an editor, not a player.`,
      cta: "Open a lab",
      href: lab ? `/labs/${lab.id}` : "/labs",
    };
  }

  // 4. A DSA pattern keeps failing.
  if (i.weakPattern && i.weakPattern.recentFails >= 2) {
    const m = i.weakPattern.topMistake ? ` Most common mistake: ${MISTAKE_LABELS[i.weakPattern.topMistake].toLowerCase()}.` : "";
    return {
      kind: "weak-pattern",
      text: `${patternName(i.weakPattern.pattern)[0].toUpperCase() + patternName(i.weakPattern.pattern).slice(1)} has beaten you ${i.weakPattern.recentFails} times in two weeks.${m} Drill it before moving on.`,
      cta: "Practise",
      href: `/dsa?pattern=${i.weakPattern.pattern}`,
    };
  }

  // 5. Completing without reviewing.
  if (i.overdueReviews >= 4 || (i.topicsCompleted7d >= 4 && i.reviewsDone7d === 0)) {
    return {
      kind: "no-review",
      text: `You're finishing topics faster than you're reviewing them. ${i.overdueReviews} reviews overdue — ten minutes now saves relearning later.`,
      cta: "Review",
      href: "/review",
    };
  }

  // 6. Month-level nudge toward the flagship.
  const flagship = i.labs.find((l) => l.id.startsWith("flagship") && l.status !== "completed" && l.week <= i.currentWeek + 1);
  if (flagship) {
    return {
      kind: "flagship",
      text: `Everything this month feeds ${flagship.title}. Keep a running list of what you'll reuse from each lab.`,
      cta: "View flagship",
      href: `/labs/${flagship.id}`,
    };
  }
  return null;
}
