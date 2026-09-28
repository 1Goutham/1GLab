import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { loadState } from "@/lib/data/state";
import { addDays, formatDay } from "@/lib/engine/dates";
import { PageHeader, Label } from "@/components/ui/primitives";
import { JournalEditor } from "@/components/journal/journal-editor";
import { JournalInsight } from "@/components/journal/journal-insight";
import { cn } from "@/lib/cn";

export const metadata = { title: "Journal" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const st = await loadState(user);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= st.today ? sp.date : st.today;
  const [entry, recent] = await Promise.all([
    db.query.journalEntries.findFirst({ where: and(eq(s.journalEntries.userId, user.id), eq(s.journalEntries.date, date)) }),
    db.select({ date: s.journalEntries.date, learned: s.journalEntries.learned }).from(s.journalEntries).where(eq(s.journalEntries.userId, user.id)).orderBy(desc(s.journalEntries.date)).limit(30),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(st.today, -13 + i));
  const written = new Set(recent.map((r) => r.date));

  return (
    <div>
      <PageHeader eyebrow="Engineering journal" title={date === st.today ? "What happened today?" : formatDay(date, { weekday: "long", day: "numeric", month: "long" })} description="Seven honest questions. The mentor reads them to spot what keeps coming back." />

      <div className="mb-10 flex gap-1 overflow-x-auto pb-1">
        {days.map((d) => (
          <Link
            key={d}
            href={d === st.today ? "/journal" : `/journal?date=${d}`}
            className={cn(
              "flex w-11 shrink-0 flex-col items-center gap-1.5 rounded-lg border py-2 font-mono text-[10.5px] transition-colors",
              d === date ? "border-white/25 bg-white/[0.05] text-fg" : "border-transparent text-faint hover:text-muted",
            )}
          >
            <span>{formatDay(d, { weekday: "narrow" })}</span>
            <span className="text-[12px]">{Number(d.slice(8))}</span>
            <span className={cn("size-1 rounded-full", written.has(d) ? "bg-accent" : "bg-white/10")} />
          </Link>
        ))}
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <JournalEditor
          key={date}
          date={date}
          initial={{
            learned: entry?.learned ?? "",
            built: entry?.built ?? "",
            broke: entry?.broke ?? "",
            fixed: entry?.fixed ?? "",
            confused: entry?.confused ?? "",
            canExplain: entry?.canExplain ?? "",
            revisit: entry?.revisit ?? "",
            energy: entry?.energy ?? null,
          }}
        />
        <aside className="space-y-10">
          <JournalInsight hasEntries={recent.length > 0} />
          <div>
            <Label className="mb-3">Recent entries</Label>
            <ul className="space-y-3">
              {recent.slice(0, 8).map((r) => (
                <li key={r.date}>
                  <Link href={`/journal?date=${r.date}`} className="block hover:text-fg">
                    <div className="font-mono text-[11px] text-faint">{formatDay(r.date)}</div>
                    <div className="line-clamp-2 text-[13px] text-muted">{r.learned || "—"}</div>
                  </Link>
                </li>
              ))}
              {recent.length === 0 && <li className="text-[13px] text-faint">Your first entry starts the pattern-finding.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
