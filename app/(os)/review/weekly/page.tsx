import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { and, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { loadState } from "@/lib/data/state";
import { dsaView, scoresOf, topicStatus } from "@/lib/data/derive";
import { weeklyReview } from "@/lib/engine/weekly";
import { addDays, daysBetween, formatDay, formatMinutes } from "@/lib/engine/dates";
import { Bracket, Label } from "@/components/ui/primitives";

export const metadata = { title: "Weekly review" };

export default async function WeeklyReviewPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const from = addDays(st.today, -6);
  const { scores, categories } = scoresOf(st);
  const dsa = dsaView(st);
  const weekAgo = [...st.snapshots].reverse().find((x) => x.date <= addDays(st.today, -7)) ?? null;
  const focusRows = await db
    .select({ m: s.focusSessions.actualMinutes })
    .from(s.focusSessions)
    .where(and(eq(s.focusSessions.userId, user.id), gte(s.focusSessions.startedAt, new Date(`${from}T00:00:00Z`))));
  const ev = st.events.filter((e) => e.day >= from);
  const topicsCompleted = ev.filter((e) => e.type === "topic_completed").map((e) => st.topics.find((t) => t.id === e.refId)).filter((t): t is NonNullable<typeof t> => !!t);
  const labsCompleted = ev.filter((e) => e.type === "lab_completed").map((e) => st.labs.find((l) => l.id === e.refId)).filter((l): l is NonNullable<typeof l> => !!l);
  const solvedIds = new Set(st.attempts.filter((a) => a.day >= from && a.solved).map((a) => a.problemId));
  const inFocus = [...scores.values()].filter((sc) => st.topics.some((t) => t.week <= st.week + 1 && t.skillIds.includes(sc.id)));
  const patternNow: Record<string, number> = {};
  for (const [k, v] of dsa.stats) patternNow[k] = v.mastery;

  const r = weeklyReview({
    topicsCompleted: topicsCompleted.map((t) => ({ id: t.id, title: t.title })),
    dsaSolved: solvedIds.size,
    dsaAttempted: st.attempts.filter((a) => a.day >= from).length,
    labsCompleted: labsCompleted.map((l) => ({ id: l.id, title: l.title })),
    focusMinutes: focusRows.reduce((a, x) => a + (x.m ?? 0), 0),
    learnMinutes: ev.filter((e) => e.type !== "focus_done").reduce((a, e) => a + (e.minutes ?? 0), 0),
    categoryNow: categories,
    categoryWeekAgo: weekAgo?.categories ?? null,
    categoryNames: Object.fromEntries(st.categories.map((c) => [c.id, c.name])),
    patternMasteryNow: patternNow,
    patternMasteryWeekAgo: null,
    failedReviews: st.reviews
      .filter((x) => x.result === "fail" && x.completedAt && daysBetween(st.dayOf(x.completedAt)!, st.today) <= 7)
      .map((x) => ({ title: st.topics.find((t) => t.id === x.itemId)?.title ?? st.problems.find((p) => p.id === x.itemId)?.title ?? x.itemId })),
    overdueTopics: st.reviews
      .filter((x) => !x.completedAt && x.itemType === "topic" && daysBetween(x.dueAt, st.today) > 3)
      .map((x) => ({ title: st.topics.find((t) => t.id === x.itemId)?.title ?? x.itemId })),
    weakestSkills: inFocus.sort((a, b) => a.overall - b.overall).slice(0, 3).map((x) => ({ name: x.name, overall: x.overall })),
    nextWeekTopics: st.topics.filter((t) => t.week === st.week + 1 && topicStatus(st, t.id)?.status !== "completed").map((t) => ({ title: t.title })),
    weakPatterns: dsa.weakPattern ? [dsa.weakPattern.pattern] : [],
  });

  const rows: [string, React.ReactNode][] = [
    ["You learned", `${r.learned} concept${r.learned === 1 ? "" : "s"}`],
    ["Solved", `${r.solved} DSA problem${r.solved === 1 ? "" : "s"}`],
    ["Built", `${r.built} lab${r.built === 1 ? "" : "s"}`],
    ["Deep work", formatMinutes(r.deepWorkMinutes)],
    ["Weakest area", r.weakestArea ?? "—"],
    ["Most improved", r.mostImproved ?? "Not enough history yet"],
    ["Forgotten", r.forgotten.length ? r.forgotten.join(", ") : "Nothing slipped"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/review" className="group mb-10 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5" /> Review
      </Link>
      <Label>
        {formatDay(from)} — {formatDay(st.today)}
      </Label>
      <h1 className="mt-4 font-display text-5xl font-extralight tracking-tight text-white md:text-6xl">Weekly engineering review.</h1>

      <dl className="mt-14 border-b border-line">
        {rows.map(([k, v], i) => (
          <div key={k} className="rise grid grid-cols-[140px_1fr] gap-6 border-t border-line py-5 md:grid-cols-[200px_1fr]" style={{ ["--i" as string]: i }}>
            <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{k}</dt>
            <dd className="font-display text-[22px] font-light text-white">{v}</dd>
          </div>
        ))}
      </dl>

      {(r.learnedTitles.length > 0 || r.builtTitles.length > 0) && (
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {r.learnedTitles.length > 0 && (
            <div>
              <Label className="mb-3">Concepts</Label>
              <ul className="space-y-1 text-[14px] text-muted">{r.learnedTitles.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {r.builtTitles.length > 0 && (
            <div>
              <Label className="mb-3">Labs</Label>
              <ul className="space-y-1 text-[14px] text-muted">{r.builtTitles.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-14 rounded-2xl border border-accent/30 bg-accent/[0.03] p-6 md:p-8">
        <Label className="text-accent">Next week&apos;s focus</Label>
        <ol className="mt-5 space-y-3">
          {r.nextFocus.map((f, i) => (
            <li key={f} className="flex items-baseline gap-4">
              <span className="font-mono text-[12px] text-faint">{i + 1}.</span>
              <span className="font-display text-[20px] font-light text-white">{f}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-6">
          <Bracket href="/tasks?plan=1">Plan my week</Bracket>
          <Bracket href="/journal">Write the reflection</Bracket>
        </div>
      </div>
    </div>
  );
}
