import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { LessonContent } from "@/content/types";
import type { LearnerState } from "@/lib/data/state";
import { dsaView, scoresOf, missionOf } from "@/lib/data/derive";
import type { MentorMode } from "./mentor";

/**
 * The offline mentor. When no model is configured (or the provider is down)
 * the mentor still teaches — straight from the curriculum, following the same
 * behaviour: simple first, then a check for understanding.
 */
const OFFLINE_NOTE = "_Your mentor is taking a short break — answering from your curriculum instead. You can continue today's mission offline._\n\n";

async function findTopic(query: string, st: LearnerState) {
  const q = query.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const t of st.topics) {
    const terms = [t.title.toLowerCase(), ...t.tags.map((x) => x.toLowerCase()), t.id.replace(/-/g, " ")];
    let score = 0;
    for (const term of terms) {
      if (q.includes(term)) score += term.length * 2;
      else for (const w of term.split(/\W+/)) if (w.length > 3 && q.includes(w)) score += w.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: t.id, score };
  }
  if (!best) return null;
  const topic = st.topics.find((t) => t.id === best!.id)!;
  const lesson = await db.query.lessons.findFirst({ where: eq(s.lessons.topicId, topic.id) });
  return lesson ? { topic, lesson: lesson.content as LessonContent } : null;
}

export async function offlineMentorReply(mode: MentorMode, messages: { role: string; content: string }[], st: LearnerState): Promise<string> {
  const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const found = await findTopic(last, st);

  if (mode === "career") {
    const { categories } = scoresOf(st);
    const names = Object.fromEntries(st.categories.map((c) => [c.id, c.name]));
    const gaps = Object.entries(categories).sort((a, b) => a[1] - b[1]).slice(0, 3);
    return (
      OFFLINE_NOTE +
      `Based on your evidence so far, your three biggest gaps for an advanced AI engineering role:\n\n` +
      gaps.map(([k, v], i) => `${i + 1}. **${names[k] ?? k}** — ${v}/100. Open Progress → Career readiness to see the evidence behind it.`).join("\n") +
      `\n\nThe roadmap closes these in order; the fastest lever is finishing labs, because implementation carries the most weight.`
    );
  }

  if (mode === "challenge") {
    const rec = dsaView(st).recs[0];
    return (
      OFFLINE_NOTE +
      (rec
        ? `Here's your challenge: **${rec.problem.title}** (${rec.problem.difficulty}).\n\n${rec.reason}\n\nRules: 25 minutes, no hints, say the pattern before you write code. Log the attempt honestly in DSA when you're done.`
        : "Pick the hardest unfinished lab this month and do it without the hints.")
    );
  }

  if (mode === "review") {
    const due = st.reviews.filter((r) => !r.completedAt && r.dueAt <= st.today);
    return OFFLINE_NOTE + (due.length ? `You have ${due.length} review${due.length === 1 ? "" : "s"} due. Open Review — they take about ${Math.min(25, due.length * 5)} minutes.` : "Nothing due. Your retention is on track — go build something.");
  }

  if (mode === "debug") {
    return (
      OFFLINE_NOTE +
      [
        "Let's debug it like engineers:",
        "1. **Reproduce** — what's the smallest input that fails every time?",
        "2. **Read the error literally** — which line, which value, which type?",
        "3. **Expectation vs reality** — write down what you expected at that line and print what you got.",
        "4. **Halve the search space** — comment out or log at the midpoint of the pipeline.",
        "5. **Change one thing** at a time, and note it in today's journal under *What broke / How I fixed it*.",
      ].join("\n")
    );
  }

  if (!found) {
    const next = missionOf(st).items.find((i) => !i.done);
    return (
      OFFLINE_NOTE +
      `I couldn't match that to a topic in your curriculum. Try naming the concept (e.g. "embeddings", "Redis", "self-attention").` +
      (next ? `\n\nMeanwhile, your next mission is **${next.title}** — [${next.cta}](${next.href}).` : "")
    );
  }

  const { topic, lesson } = found;
  const quiz = lesson.quiz[0];
  if (mode === "interview") {
    return OFFLINE_NOTE + `**Interview question — ${topic.title}**\n\n${lesson.levels.l5.question}\n\nAnswer in 4-6 sentences. When you're done, compare with the model answer on the topic page (Level 5).`;
  }
  if (mode === "socratic") {
    return OFFLINE_NOTE + `Let's reason about **${topic.title}** without me giving the answer.\n\n${lesson.hook.split("\n\n")[0]}\n\nSo: ${quiz ? quiz.q : lesson.levels.l5.question}`;
  }
  return (
    OFFLINE_NOTE +
    `**${topic.title}, simply:** ${lesson.levels.l1}\n\n**Mental model:** ${lesson.levels.l2.text.split("\n\n")[0]}\n\n` +
    (quiz
      ? `Want to test your understanding?\n\n**${quiz.q}**\n\n${quiz.options.map((o, i) => `- **${String.fromCharCode(65 + i)}.** ${o}`).join("\n")}\n\nReply with a letter.`
      : `Open [the full lesson](/learn/${topic.id}) for the deeper levels.`)
  );
}

/** Check a letter answer against the last offline quiz question the mentor asked. */
export async function offlineQuizFollowUp(messages: { role: string; content: string }[], st: LearnerState): Promise<string | null> {
  const last = messages.at(-1);
  const prev = messages.at(-2);
  if (!last || last.role !== "user" || !prev || prev.role !== "assistant") return null;
  const letter = last.content.trim().match(/^([A-Da-d])\b/)?.[1]?.toUpperCase();
  if (!letter) return null;
  const titleMatch = prev.content.match(/\*\*(.+?), simply:\*\*/);
  if (!titleMatch) return null;
  const topic = st.topics.find((t) => t.title === titleMatch[1]);
  if (!topic) return null;
  const rows = await db.select().from(s.lessons).where(inArray(s.lessons.topicId, [topic.id])).orderBy(asc(s.lessons.id));
  const quiz = (rows[0]?.content as LessonContent | undefined)?.quiz[0];
  if (!quiz) return null;
  const correct = String.fromCharCode(65 + quiz.answer);
  return letter === correct
    ? `Correct — **${correct}**. ${quiz.explain}\n\nNext step up: ${(rows[0].content as LessonContent).levels.l5.question}`
    : `Not quite — it's **${correct}**. ${quiz.explain}\n\nRe-read Level 2 of [${topic.title}](/learn/${topic.id}), then try the mini task — it'll make this concrete.`;
}
