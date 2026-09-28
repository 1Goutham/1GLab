import "server-only";
import type { LearnerState } from "@/lib/data/state";
import { dsaView, scoresOf, topicStatus, activityOf, monthStatus } from "@/lib/data/derive";
import { MISTAKE_LABELS, patternName } from "@/lib/engine/dsa";

/**
 * A compact, factual briefing about the learner for the mentor's system
 * prompt. Kept deliberately short (~600 tokens): the mentor should know
 * where Goutham is, what he's weak at and what he's built — not his diary.
 */
export function learnerBrief(st: LearnerState): string {
  const { scores, categories } = scoresOf(st);
  const dsa = dsaView(st);
  const act = activityOf(st);
  const mod = st.modules.find((m) => m.month === st.month);
  const wk = st.weeks.find((w) => w.week === st.week);
  const completed = st.topics.filter((t) => topicStatus(st, t.id)?.status === "completed");
  const inProgress = st.topics.filter((t) => ["learning", "practised"].includes(topicStatus(st, t.id)?.status ?? ""));
  const catNames = Object.fromEntries(st.categories.map((c) => [c.id, c.name]));
  const weakest = [...scores.values()]
    .filter((s) => st.topics.some((t) => t.week <= st.week + 2 && t.skillIds.includes(s.id)))
    .sort((a, b) => a.overall - b.overall)
    .slice(0, 5);
  const strongest = [...scores.values()].sort((a, b) => b.overall - a.overall).slice(0, 5);
  const weakPatterns = [...dsa.stats.values()].filter((s) => s.attempted > 0).sort((a, b) => b.weakness - a.weakness).slice(0, 3);
  const recentMistakes = st.attempts
    .filter((a) => a.mistake)
    .slice(-5)
    .map((a) => `${st.problems.find((p) => p.id === a.problemId)?.title ?? a.problemId} (${MISTAKE_LABELS[a.mistake!]})`);
  const journal = st.journal.slice(0, 3).map((j) => `${j.date}: confused by "${j.confused.slice(0, 140)}"; revisit "${j.revisit.slice(0, 100)}"`);
  const months = monthStatus(st);

  return [
    `Learner: ${st.user.name}. ${st.user.currentLevel}. Goal: ${st.user.mainGoal}`,
    `Background: B.Tech AI & Data Science; ships React/Next.js/TypeScript/Node/MongoDB apps; built AI apps on Gemini/OpenAI APIs (Ideako, ZtudyLock, IdeaGuard AI, FabricNest). Newer to Python/FastAPI, PyTorch, Postgres, Redis, system design, ML internals.`,
    `Program: day ${st.day}/180, week ${st.week}/24, month ${st.month} — "${mod?.title ?? ""}". This week: ${wk?.title ?? ""} (${wk?.focus ?? ""}). DSA pattern this week: ${wk ? patternName(wk.dsaPattern) : "—"}.`,
    `Daily time: ${st.user.dailyMinutes} min. Streak: ${act.streak} days. Self-rated confidence — DSA ${st.user.dsaConfidence}/5, AI ${st.user.aiConfidence}/5.`,
    `Completed topics (${completed.length}): ${completed.slice(-8).map((t) => t.title).join("; ") || "none yet"}.`,
    `In progress: ${inProgress.map((t) => `${t.title} (level ${topicStatus(st, t.id)?.levelReached}/5)`).join("; ") || "none"}.`,
    `Category scores (0-100): ${Object.entries(categories).map(([k, v]) => `${catNames[k] ?? k} ${v}`).join(", ")}.`,
    `Weakest in-focus skills: ${weakest.map((s) => `${s.name} ${s.overall}`).join(", ")}.`,
    `Strongest skills: ${strongest.map((s) => `${s.name} ${s.overall}`).join(", ")}.`,
    `DSA: ${dsa.solved} solved. Weak patterns: ${weakPatterns.map((p) => `${patternName(p.pattern)} (weakness ${p.weakness.toFixed(2)})`).join(", ") || "not enough data"}. Recent mistakes: ${recentMistakes.join("; ") || "none logged"}.`,
    `Months: ${months.map((m) => `M${m.module.month} ${m.topicsCompleted}/${m.topicsTotal} topics, ${m.labsCompleted}/${m.labsTotal} labs`).join(" | ")}.`,
    `Projects: ${st.projects.map((p) => `${p.name} [${p.status}]`).join(", ")}. Flagship: Cortex (personal AI research assistant, grows monthly).`,
    journal.length ? `Recent journal: ${journal.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
