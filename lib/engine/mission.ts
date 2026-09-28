/**
 * Today's Mission.
 *
 * Four missions, in the order they should be done: a DSA rep while the mind is
 * fresh, the day's concept, the build, and a short review. The builder adapts:
 *   - it fits the day into the learner's daily time budget
 *   - on low-energy days it swaps the heavy build for a lighter continuation
 *   - watching without building pushes the build mission forward
 *   - a review backlog grows the review mission (but never beyond 25 min)
 */
import type { Recommendation } from "./dsa";

export type MissionKind = "dsa" | "learn" | "build" | "review";

export type MissionItem = {
  kind: MissionKind;
  label: string; // "DSA", "AI DEPTH", "BUILD", "REVIEW"
  title: string;
  mission: string;
  minutes: number;
  difficulty?: "easy" | "medium" | "hard";
  href: string;
  cta: string;
  why?: string;
  done: boolean;
  domain: string;
  focus?: { title: string; refType: string; refId: string };
};

export type MissionTopic = {
  id: string;
  title: string;
  week: number;
  order: number;
  domain: string;
  minutes: number;
  difficulty: "easy" | "medium" | "hard";
  miniTaskTitle: string;
  status: string; // not_started | learning | practised | completed
  completedToday: boolean;
  touchedToday: boolean;
};

export type MissionLab = {
  id: string;
  title: string;
  week: number;
  minutes: number;
  difficulty: "easy" | "medium" | "hard";
  objective: string;
  status: string;
  isFlagship: boolean;
  touchedToday: boolean;
  stepsDone: number;
  stepsTotal: number;
};

export type MissionSignals = {
  videosWatched7d: number;
  buildsDone7d: number;
  overdueReviews: number;
  energy: "low" | "medium" | "high";
};

const DOMAIN_LABEL: Record<string, string> = {
  ai: "AI DEPTH",
  backend: "ENGINEERING",
  frontend: "PRODUCT",
  systems: "SYSTEMS",
  cloud: "INFRASTRUCTURE",
  security: "SECURITY",
  product: "PRODUCT",
  dsa: "CS FOUNDATIONS",
};

export function nextTopic(topics: MissionTopic[], week: number): MissionTopic | null {
  const ordered = [...topics].sort((a, b) => a.week - b.week || a.order - b.order);
  // Anything touched today stays the day's topic (so the card can show it as done).
  const today = ordered.find((t) => t.completedToday || (t.touchedToday && t.status !== "completed"));
  if (today) return today;
  // In-progress topics first, then the earliest unfinished topic up to this week, then look ahead.
  return (
    ordered.find((t) => t.status === "learning" || t.status === "practised") ??
    ordered.find((t) => t.week <= week && t.status !== "completed") ??
    ordered.find((t) => t.status !== "completed") ??
    null
  );
}

export function nextLab(labs: MissionLab[], week: number): MissionLab | null {
  const ordered = [...labs].sort((a, b) => a.week - b.week || Number(a.isFlagship) - Number(b.isFlagship) || a.minutes - b.minutes);
  return (
    ordered.find((l) => l.touchedToday) ??
    ordered.find((l) => l.status === "in_progress") ??
    ordered.find((l) => l.week <= week && l.status !== "completed" && !l.isFlagship) ??
    ordered.find((l) => l.week <= week && l.status !== "completed") ??
    ordered.find((l) => l.status !== "completed") ??
    null
  );
}

export function buildMission(input: {
  week: number;
  dailyMinutes: number;
  dsa: Recommendation | null;
  dsaDoneToday: { title: string; id: string } | null;
  topics: MissionTopic[];
  labs: MissionLab[];
  reviewsDue: { count: number; minutes: number; dsaFails: number };
  reviewsDoneToday: number;
  signals: MissionSignals;
}): { items: MissionItem[]; note: string | null } {
  const { week, dailyMinutes, dsa, dsaDoneToday, topics, labs, reviewsDue, reviewsDoneToday, signals } = input;
  const items: MissionItem[] = [];
  let note: string | null = null;

  // 01 — DSA
  if (dsaDoneToday) {
    items.push({
      kind: "dsa",
      label: "DSA",
      title: dsaDoneToday.title,
      mission: "Logged. Patterns get built one honest attempt at a time.",
      minutes: 0,
      href: `/dsa/${dsaDoneToday.id}`,
      cta: "Review attempt",
      done: true,
      domain: "dsa",
    });
  } else if (dsa) {
    const p = dsa.problem;
    items.push({
      kind: "dsa",
      label: "DSA",
      title: p.title,
      mission:
        dsa.kind === "resolve"
          ? "Re-solve from a blank editor. No hints, no peeking."
          : `Solve it without looking at the solution. Say the pattern out loud before you code.`,
      minutes: p.minutes,
      difficulty: p.difficulty,
      href: `/dsa/${p.id}`,
      cta: "Start mission",
      why: dsa.reason,
      done: false,
      domain: "dsa",
      focus: { title: p.title, refType: "dsa", refId: p.id },
    });
  }

  // 02 — Learn
  const topic = nextTopic(topics, week);
  if (topic) {
    items.push({
      kind: "learn",
      label: DOMAIN_LABEL[topic.domain] ?? "LEARN",
      title: topic.title,
      mission: `Work through all five levels, then do the mini task: ${topic.miniTaskTitle}.`,
      minutes: topic.minutes,
      difficulty: topic.difficulty,
      href: `/learn/${topic.id}`,
      cta: topic.status === "not_started" ? "Learn" : "Continue",
      done: topic.completedToday,
      domain: topic.domain,
      focus: { title: topic.title, refType: "topic", refId: topic.id },
    });
  }

  // 03 — Build
  const lab = nextLab(labs, week);
  if (lab) {
    const lowEnergy = signals.energy === "low";
    const remaining = lab.stepsTotal ? Math.round(lab.minutes * (1 - lab.stepsDone / lab.stepsTotal)) : lab.minutes;
    const slice = Math.min(lowEnergy ? 30 : 90, Math.max(20, remaining));
    items.push({
      kind: "build",
      label: lab.isFlagship ? "FLAGSHIP" : "BUILD",
      title: lab.title,
      mission:
        lab.status === "in_progress"
          ? `Continue from step ${lab.stepsDone + 1} of ${lab.stepsTotal}. Ship one step end to end.`
          : lab.objective,
      minutes: slice,
      difficulty: lab.difficulty,
      href: `/labs/${lab.id}`,
      cta: "Open lab",
      done: lab.touchedToday,
      domain: lab.isFlagship ? "product" : "backend",
      focus: { title: lab.title, refType: "lab", refId: lab.id },
    });
    if (signals.videosWatched7d >= 3 && signals.buildsDone7d === 0) {
      note = "You've watched more than you've built this week. The build is today's priority.";
      const b = items.pop()!;
      items.splice(Math.min(1, items.length), 0, b);
    }
  }

  // 04 — Review
  if (reviewsDue.count > 0 || reviewsDoneToday > 0) {
    const minutes = Math.min(25, Math.max(10, reviewsDue.minutes));
    items.push({
      kind: "review",
      label: "REVIEW",
      title: reviewsDue.dsaFails > 0 ? "Yesterday's mistakes" : "Spaced review",
      mission:
        reviewsDue.count === 0
          ? "All caught up. Retention is compounding."
          : `${reviewsDue.count} item${reviewsDue.count === 1 ? "" : "s"} due — short, sharp recall. Stop at ${minutes} minutes.`,
      minutes: reviewsDue.count ? minutes : 0,
      href: "/review",
      cta: "Review",
      done: reviewsDue.count === 0,
      domain: "systems",
    });
    if (signals.overdueReviews > 5 && !note) note = "Reviews are piling up. Clearing them today protects everything you've learned.";
  }

  // Fit the day into the budget: shrink the build first, never the concept.
  const total = items.filter((i) => !i.done).reduce((a, i) => a + i.minutes, 0);
  if (total > dailyMinutes) {
    const build = items.find((i) => i.kind === "build" && !i.done);
    if (build) build.minutes = Math.max(20, build.minutes - (total - dailyMinutes));
  }
  if (signals.energy === "low" && !note) note = "Low-energy day: smaller slices, same direction. Showing up still counts.";

  return { items, note };
}
