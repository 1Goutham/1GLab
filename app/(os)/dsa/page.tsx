import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { dsaView } from "@/lib/data/derive";
import { DSA_PATTERNS } from "@/content/dsa";
import { MISTAKE_LABELS, patternName } from "@/lib/engine/dsa";
import { Bracket, Chip, Difficulty, Label, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { StatusMark } from "@/components/ui/status-mark";
import { cn } from "@/lib/cn";

export const metadata = { title: "DSA" };

export default async function DsaPage({ searchParams }: { searchParams: Promise<{ pattern?: string }> }) {
  const { pattern } = await searchParams;
  const user = await requireUser();
  const st = await loadState(user);
  const v = dsaView(st);
  const statusOf = (id: string) => {
    const as = st.attempts.filter((a) => a.problemId === id);
    if (!as.length) return "not_started";
    return as.some((a) => a.solved && !a.solutionViewed) ? "completed" : "in_progress";
  };
  const totalAttempts = st.attempts.length;
  const mistakes = new Map<string, number>();
  for (const a of st.attempts) if (a.mistake) mistakes.set(a.mistake, (mistakes.get(a.mistake) ?? 0) + 1);
  const dueResolves = st.reviews.filter((r) => r.itemType === "dsa" && !r.completedAt && r.dueAt <= st.today).length;
  const list = st.problems.filter((p) => !pattern || p.pattern === pattern);

  return (
    <div>
      <PageHeader
        eyebrow="DSA"
        title="Patterns, not problem counts."
        description={
          v.weekPattern
            ? `This week's pattern: ${patternName(v.weekPattern)}. Every attempt — solved or not — sharpens the recommendations.`
            : "Every attempt sharpens the recommendations."
        }
      >
        <div className="flex gap-8">
          <Stat label="Solved" value={v.solved} />
          <Stat label="Attempts" value={totalAttempts} />
          <Stat label="Re-solves due" value={dueResolves} />
        </div>
      </PageHeader>

      <Section label="Recommended now" className="mt-0">
        <ol className="border-b border-line">
          {v.recs.slice(0, 4).map((r, i) => (
            <li key={r.problem.id} className="row-line border-t border-line">
              <div className="grid grid-cols-[36px_1fr] gap-4 py-5 md:grid-cols-[36px_1fr_auto]">
                <span className="row-index font-mono text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/dsa/${r.problem.id}`} className="font-display text-[20px] font-light text-white hover:text-accent">
                      {r.problem.title}
                    </Link>
                    <Difficulty level={r.problem.difficulty} />
                    <span className="font-mono text-[11px] text-faint">{patternName(r.problem.pattern)}</span>
                    {r.kind === "resolve" && <Chip tone="warn">Re-solve</Chip>}
                    {r.kind === "weakness" && <Chip tone="bad">Weak spot</Chip>}
                  </div>
                  <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                    <span className="text-faint">Why — </span>
                    {r.reason}
                  </p>
                </div>
                <div className="hidden items-start md:flex">
                  <Bracket href={`/dsa/${r.problem.id}`}>Solve</Bracket>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section label="Weakness map" action={pattern && <Bracket href="/dsa" className="text-[12px]">All patterns</Bracket>}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {DSA_PATTERNS.map((pt) => {
            const s = v.stats.get(pt.id);
            const tone = !s?.attempted ? "none" : s.weakness >= 0.5 ? "bad" : s.weakness >= 0.3 ? "warn" : "good";
            return (
              <Link
                key={pt.id}
                href={`/dsa?pattern=${pt.id}`}
                title={pt.idea}
                className={cn("group relative bg-bg p-3.5 transition-colors hover:bg-white/[0.03]", pattern === pt.id && "bg-white/[0.05]", v.weekPattern === pt.id && "shadow-[inset_0_2px_0_var(--accent)]")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-fg">{pt.name}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : tone === "good" ? "bg-accent" : "bg-white/15",
                    )}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-display text-xl font-extralight tabular-nums text-white">{s?.mastery ?? 0}</span>
                  <span className="font-mono text-[10.5px] text-faint">
                    {s?.solved ?? 0}/{s?.total ?? 0}
                  </span>
                </div>
                <div className="mt-2 h-[2px] rounded-full bg-white/[0.06]">
                  <div className="meter-fill h-full rounded-full bg-[var(--d-dsa)]" style={{ width: `${s?.mastery ?? 0}%` }} />
                </div>
                {s?.topMistake && <div className="mt-2 truncate font-mono text-[10px] text-bad/80">{MISTAKE_LABELS[s.topMistake]}</div>}
              </Link>
            );
          })}
        </div>
        {mistakes.size > 0 && (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Label>Mistake profile</Label>
            {[...mistakes.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k} className="font-mono text-[11.5px] text-muted">
                  {MISTAKE_LABELS[k as keyof typeof MISTAKE_LABELS]} <span className="text-fg">{n}</span>
                </span>
              ))}
          </div>
        )}
      </Section>

      <Section label={pattern ? patternName(pattern) : "All problems"}>
        <ul className="border-b border-line">
          {list.map((p) => {
            const st2 = statusOf(p.id);
            const last = [...st.attempts].reverse().find((a) => a.problemId === p.id);
            return (
              <li key={p.id} className="row-line border-t border-line">
                <Link href={`/dsa/${p.id}`} className="grid grid-cols-[28px_1fr_auto] items-center gap-4 py-3.5 md:grid-cols-[28px_1fr_140px_110px_60px]">
                  <StatusMark status={st2} />
                  <span className="truncate text-[14.5px] text-fg">{p.title}</span>
                  <span className="hidden font-mono text-[11px] text-faint md:block">{patternName(p.pattern)}</span>
                  <span className="hidden md:block">
                    <Difficulty level={p.difficulty} />
                  </span>
                  <span className="text-right font-mono text-[11px] text-faint">{last ? `${last.confidence}/5` : `${p.minutes}m`}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
