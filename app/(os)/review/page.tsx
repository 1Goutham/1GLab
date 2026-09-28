import Link from "next/link";
import { inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { LessonContent } from "@/content/types";
import { loadState } from "@/lib/data/state";
import { quizFor } from "@/lib/ai/quiz";
import { addDays, formatDay } from "@/lib/engine/dates";
import { TOPIC_LADDER } from "@/lib/engine/srs";
import { Bracket, Empty, Label, PageHeader, Section } from "@/components/ui/primitives";
import { ReviewSession, type ReviewCard } from "@/components/review/review-session";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const open = st.reviews.filter((r) => !r.completedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const due = open.filter((r) => r.dueAt <= st.today).slice(0, 8);
  const upcoming = open.filter((r) => r.dueAt > st.today && r.dueAt <= addDays(st.today, 7));

  const topicIds = [...new Set(due.filter((r) => r.itemType === "topic").map((r) => r.itemId))];
  const lessons = topicIds.length ? await db.select().from(s.lessons).where(inArray(s.lessons.topicId, topicIds)) : [];

  const cards: ReviewCard[] = [];
  for (const r of due) {
    if (r.itemType === "dsa") {
      const p = st.problems.find((x) => x.id === r.itemId);
      if (p) cards.push({ id: r.id, kind: "resolve", title: p.title, href: `/dsa/${p.id}`, prompt: "Re-solve it from a blank editor. No hints for the first 15 minutes.", stage: r.stage });
      continue;
    }
    const lesson = lessons.find((l) => l.topicId === r.itemId)?.content as LessonContent | undefined;
    const topic = st.topics.find((t) => t.id === r.itemId);
    if (!lesson || !topic) continue;
    const retries = st.reviews.filter((x) => x.itemId === r.itemId && x.stage === r.stage && x.completedAt).length;
    if (r.kind === "quiz") {
      const q = await quizFor(lesson, topic.title, retries);
      cards.push({ id: r.id, kind: "quiz", title: topic.title, href: `/learn/${topic.id}`, questions: q.questions, stage: r.stage });
    } else {
      cards.push({
        id: r.id,
        kind: r.kind as "explain" | "implement" | "interview",
        title: topic.title,
        href: `/learn/${topic.id}`,
        stage: r.stage,
        prompt: r.kind === "explain" ? lesson.explainPrompt : r.kind === "implement" ? lesson.implementPrompt : lesson.levels.l5.question,
        answer: r.kind === "interview" ? lesson.levels.l5.answer : r.kind === "explain" ? `${lesson.levels.l1}\n\n${lesson.levels.l2.text}` : lesson.levels.l3.text,
      });
    }
  }
  const minutes = cards.reduce((a, c) => a + (c.kind === "resolve" ? 20 : TOPIC_LADDER.find((l) => l.kind === c.kind)?.minutes ?? 5), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Review"
        title={cards.length ? "Short, sharp recall." : "Nothing due. Retention is compounding."}
        description="Day 3 quiz, day 7 explain it back, day 14 implement from memory, day 30 interview question. Short on purpose — stop when the timer says so."
      >
        <Bracket href="/review/weekly">Weekly review</Bracket>
      </PageHeader>

      {cards.length ? (
        <>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            {cards.length} due · about {minutes} min
          </p>
          <ReviewSession cards={cards} />
        </>
      ) : (
        <Empty title="You're clear." body="Complete a topic and its first quiz arrives two days later. Failed DSA attempts come back as cold re-solves." action={<Bracket href="/">Back to today</Bracket>} />
      )}

      {upcoming.length > 0 && (
        <Section label="Next 7 days">
          <ul className="border-b border-line">
            {upcoming.map((r) => {
              const title = r.itemType === "dsa" ? st.problems.find((p) => p.id === r.itemId)?.title : st.topics.find((t) => t.id === r.itemId)?.title;
              return (
                <li key={r.id} className="grid grid-cols-[110px_1fr_110px] gap-4 border-t border-line py-3 text-[14px]">
                  <span className="font-mono text-[11.5px] text-faint">{formatDay(r.dueAt)}</span>
                  <Link href={r.itemType === "dsa" ? `/dsa/${r.itemId}` : `/learn/${r.itemId}`} className="truncate text-fg hover:text-accent">
                    {title}
                  </Link>
                  <span className="text-right font-mono text-[11px] uppercase tracking-wider text-faint">{r.kind}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section label="How the ladder works">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
          {[{ d: "Day 1", k: "Learn + do" }, ...TOPIC_LADDER.map((l) => ({ d: `Day ${l.offset + 1}`, k: l.label }))].map((x, i) => (
            <div key={x.d} className="bg-bg p-4">
              <Label>{x.d}</Label>
              <div className={i === 0 ? "mt-2 text-[14px] text-accent" : "mt-2 text-[14px] text-fg"}>{x.k}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
