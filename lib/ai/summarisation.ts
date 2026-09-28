import "server-only";
import type { LearnerState } from "@/lib/data/state";
import { insightOf } from "@/lib/data/derive";
import { getProvider } from "./provider";
import { learnerBrief } from "./context";

/**
 * Journal analysis: the mentor reads the last two weeks of journal entries and
 * names one pattern worth acting on. Offline, the deterministic insight engine
 * (repeated-term detection, learned-but-not-built, etc.) answers instead.
 */
export async function analyseJournal(st: LearnerState): Promise<{ text: string; source: "ai" | "engine" }> {
  const entries = st.journal.slice(0, 14);
  const fallback = () => {
    const insight = insightOf(st);
    return {
      text: insight
        ? `${insight.text} → [${insight.cta}](${insight.href})`
        : entries.length < 3
          ? "Write a few more entries — patterns show up after about three days of honest notes."
          : "No repeating confusion in your recent entries. Whatever you're doing, keep doing it.",
      source: "engine" as const,
    };
  };
  const provider = getProvider();
  if (!provider || entries.length === 0) return fallback();
  try {
    const text = await provider.complete({
      system:
        "You are a senior engineering mentor reading your mentee's engineering journal. Find ONE recurring pattern (a concept mentioned repeatedly but never implemented, a repeated bug class, avoidance, a confusion that keeps returning). Write 2-4 sentences in second person: what you noticed with specific evidence (quote briefly), why it matters, and one concrete action for tomorrow that maps to his curriculum (a topic, lab or DSA pattern). No preamble.",
      messages: [
        {
          role: "user",
          content:
            `Learner:\n${learnerBrief(st)}\n\nJournal (newest first):\n` +
            entries
              .map((j) => `## ${j.date}\nLearned: ${j.learned}\nBuilt: ${j.built}\nBroke: ${j.broke}\nFixed: ${j.fixed}\nConfused: ${j.confused}\nCan explain: ${j.canExplain}\nRevisit: ${j.revisit}`)
              .join("\n\n"),
        },
      ],
      maxTokens: 1200,
    });
    return { text: text.trim(), source: "ai" };
  } catch {
    return fallback();
  }
}
