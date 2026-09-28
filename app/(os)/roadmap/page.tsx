import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { monthStatus, topicStatus } from "@/lib/data/derive";
import { Bracket, DOMAIN_COLOR, Label, PageHeader } from "@/components/ui/primitives";
import { patternName } from "@/lib/engine/dsa";
import { cn } from "@/lib/cn";

export const metadata = { title: "Roadmap" };

/**
 * The six-month roadmap as a single vertical track. It evolves as you go:
 * completed weeks fill in, the current week pulses, finished months turn
 * into unlocked levels, and the flagship project grows alongside.
 */
export default async function RoadmapPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const months = monthStatus(st);

  return (
    <div>
      <PageHeader
        eyebrow="Roadmap"
        title="Six months to Advanced AI Engineer."
        description="Engineering foundations first, then the models, then the systems around them. Every month unlocks a level and a new capability in your flagship project."
      />

      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-6 w-px bg-line md:left-[27px]" aria-hidden />
        {months.map(({ module: m, topicsCompleted, topicsTotal, labsCompleted, labsTotal, unlocked, current }) => {
          const weeks = st.weeks.filter((w) => w.moduleId === m.id);
          const past = m.month < st.month;
          const future = m.month > st.month;
          return (
            <li key={m.id} className="relative pb-16 pl-14 md:pl-20">
              <span
                className={cn(
                  "absolute left-0 top-0 grid size-10 place-items-center rounded-full border bg-bg font-mono text-[13px] md:size-14 md:text-[15px]",
                  unlocked ? "border-accent bg-accent text-accent-ink" : current ? "border-accent text-accent" : "border-line-strong text-faint",
                )}
              >
                {unlocked ? <Check className="size-5" strokeWidth={2.5} /> : String(m.month).padStart(2, "0")}
                {current && !unlocked && <span className="absolute inset-0 animate-ping rounded-full border border-accent/40 [animation-duration:2.6s]" />}
              </span>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Label>
                  Month {m.month} {current && "· now"}
                </Label>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: unlocked ? "var(--accent)" : "var(--fg-faint)" }}>
                  Level {String(m.month).padStart(2, "0")} — {m.levelTitle} {unlocked ? "· unlocked" : ""}
                </span>
              </div>
              <h2 className={cn("mt-3 font-display text-[28px] font-light leading-tight md:text-[34px]", future ? "text-fg/60" : "text-white")}>{m.title}</h2>
              <p className="mt-2 max-w-2xl text-[14.5px] text-muted">{m.subtitle}</p>

              <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-2">
                  {weeks.map((w) => {
                    const ts = st.topics.filter((t) => t.week === w.week);
                    const d = ts.filter((t) => topicStatus(st, t.id)?.status === "completed").length;
                    const isNow = w.week === st.week;
                    return (
                      <div key={w.week} className={cn("rounded-xl border px-4 py-3.5", isNow ? "border-accent/35 bg-accent/[0.03]" : "border-line")}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-baseline gap-3">
                            <span className={cn("font-mono text-[11px]", isNow ? "text-accent" : "text-faint")}>W{String(w.week).padStart(2, "0")}</span>
                            <span className="text-[15px] text-fg">{w.title}</span>
                          </div>
                          <span className="font-mono text-[11px] text-faint">
                            {d}/{ts.length}
                          </span>
                        </div>
                        <div className="mt-2.5 flex gap-1">
                          {ts.map((t) => {
                            const s = topicStatus(st, t.id)?.status;
                            return (
                              <Link
                                key={t.id}
                                href={`/learn/${t.id}`}
                                title={t.title}
                                className={cn("h-1.5 flex-1 rounded-full transition-opacity hover:opacity-70", s === "completed" ? "" : s ? "opacity-60" : "bg-white/[0.07]")}
                                style={{ background: s ? DOMAIN_COLOR[t.domain] : undefined }}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                          {ts.map((t) => (
                            <Link key={t.id} href={`/learn/${t.id}`} className="hover:text-fg">
                              {t.title}
                            </Link>
                          ))}
                          <span className="font-mono text-[11px] text-faint">+ DSA: {patternName(w.dsaPattern)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <aside className="space-y-6">
                  <div>
                    <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">You&apos;ll be able to</div>
                    <ul className="space-y-1.5">
                      {m.outcomes.slice(0, 5).map((o) => (
                        <li key={o} className="flex gap-2 text-[13px] leading-snug text-muted">
                          <span className="mt-[7px] h-px w-2 shrink-0 bg-white/30" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn("rounded-xl border p-4", past || current ? "border-line-strong" : "border-dashed border-line")}>
                    <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                      Flagship · Cortex {future && <Lock className="size-3" />}
                    </div>
                    <div className="mt-2 font-display text-[17px] text-fg">{m.flagship.title}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{m.flagship.detail}</p>
                  </div>
                  <div className="flex gap-6 font-mono text-[11px] text-faint">
                    <span>
                      {topicsCompleted}/{topicsTotal} concepts
                    </span>
                    <span>
                      {labsCompleted}/{labsTotal} labs
                    </span>
                  </div>
                  {unlocked && <Bracket href={`/level-up/${m.month}`}>See level {m.month}</Bracket>}
                </aside>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
