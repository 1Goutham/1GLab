import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { topicStatus } from "@/lib/data/derive";
import { DomainDot, DOMAIN_LABEL, Label, Meter, PageHeader } from "@/components/ui/primitives";
import { StatusMark } from "@/components/ui/status-mark";
import { formatMinutes } from "@/lib/engine/dates";
import { cn } from "@/lib/cn";

export const metadata = { title: "Learn" };

const FILTERS = ["all", "ai", "backend", "systems", "cloud", "security", "frontend", "product"] as const;

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { domain = "all" } = await searchParams;
  const user = await requireUser();
  const st = await loadState(user);
  const done = st.topics.filter((t) => topicStatus(st, t.id)?.status === "completed").length;

  return (
    <div>
      <PageHeader
        eyebrow="Learn"
        title="Every concept, five levels deep."
        description="Each topic goes from a plain-language idea to the implementation underneath — and never ends without you doing something with it."
      >
        <div className="text-right">
          <div className="font-display text-3xl font-extralight tabular-nums text-white">
            {done}
            <span className="text-lg text-faint">/{st.topics.length}</span>
          </div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">concepts completed</div>
        </div>
      </PageHeader>

      <div className="mb-10 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/learn" : `/learn?domain=${f}`}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] transition-colors",
              domain === f ? "border-white/25 bg-white/[0.06] text-fg" : "border-line text-muted hover:text-fg",
            )}
          >
            {f !== "all" && <DomainDot domain={f} />}
            {f === "all" ? "All" : DOMAIN_LABEL[f]}
          </Link>
        ))}
      </div>

      <div className="space-y-16">
        {st.modules.map((m) => {
          const weeks = st.weeks.filter((w) => w.moduleId === m.id);
          const topics = st.topics.filter((t) => t.moduleId === m.id && (domain === "all" || t.domain === domain));
          if (!topics.length) return null;
          const mDone = st.topics.filter((t) => t.moduleId === m.id && topicStatus(st, t.id)?.status === "completed").length;
          const mTotal = st.topics.filter((t) => t.moduleId === m.id).length;
          return (
            <section key={m.id} id={`month-${m.month}`}>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Label index={String(m.month).padStart(2, "0")}>Month {m.month}</Label>
                  <h2 className={cn("mt-3 font-display text-2xl font-light", m.month === st.month ? "text-white" : "text-fg/80")}>{m.title}</h2>
                </div>
                <div className="w-40">
                  <div className="mb-1.5 text-right font-mono text-[10.5px] text-faint">
                    {mDone}/{mTotal}
                  </div>
                  <Meter value={(mDone / mTotal) * 100} />
                </div>
              </div>
              {weeks.map((w) => {
                const ts = topics.filter((t) => t.week === w.week);
                if (!ts.length) return null;
                return (
                  <div key={w.week} className="mb-6">
                    <div className="mb-1 flex items-baseline gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                      <span className={cn(w.week === st.week && "text-accent")}>W{String(w.week).padStart(2, "0")}</span>
                      <span>{w.title}</span>
                      {w.week === st.week && <span className="text-accent">· this week</span>}
                    </div>
                    <ul className="border-b border-line">
                      {ts.map((t) => {
                        const p = topicStatus(st, t.id);
                        return (
                          <li key={t.id} className="row-line border-t border-line">
                            <Link href={`/learn/${t.id}`} className="grid grid-cols-[28px_1fr] items-start gap-4 py-4 md:grid-cols-[28px_1fr_140px_70px]">
                              <StatusMark status={p?.status ?? "not_started"} className="mt-1" />
                              <div className="min-w-0">
                                <div className="text-[16px] text-fg">{t.title}</div>
                                <div className="mt-0.5 truncate text-[13px] text-muted">{t.summary}</div>
                              </div>
                              <div className="hidden items-center gap-2 pt-1 font-mono text-[10.5px] uppercase tracking-wider text-faint md:flex">
                                <DomainDot domain={t.domain} /> {DOMAIN_LABEL[t.domain]}
                              </div>
                              <div className="hidden pt-1 text-right font-mono text-[11px] text-faint md:block">
                                {p && p.levelReached > 0 && p.status !== "completed" ? `L${p.levelReached}/5` : formatMinutes(t.minutes)}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
