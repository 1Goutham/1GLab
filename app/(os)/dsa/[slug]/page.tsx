import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { dsaView } from "@/lib/data/derive";
import { DSA_PATTERNS } from "@/content/dsa";
import { MISTAKE_LABELS, patternName } from "@/lib/engine/dsa";
import { Chip, Difficulty, Label } from "@/components/ui/primitives";
import { AttemptLogger } from "@/components/dsa/attempt-logger";
import { formatDay } from "@/lib/engine/dates";

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const st = await loadState(user);
  const p = st.problems.find((x) => x.id === slug);
  if (!p) notFound();
  const attempts = st.attempts.filter((a) => a.problemId === slug).reverse();
  const rec = dsaView(st).recs.find((r) => r.problem.id === slug);
  const review = st.reviews.find((r) => r.itemType === "dsa" && r.itemId === slug && !r.completedAt);
  const pattern = DSA_PATTERNS.find((x) => x.id === p.pattern);
  const siblings = st.problems.filter((x) => x.pattern === p.pattern && x.id !== slug).slice(0, 5);

  return (
    <div>
      <Link href={`/dsa?pattern=${p.pattern}`} className="group mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        DSA · {patternName(p.pattern)}
      </Link>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Difficulty level={p.difficulty} />
            <span className="font-mono text-[11px] text-faint">~{p.minutes} min</span>
            {p.freq === 3 && <Chip>Interview favourite</Chip>}
            {review && <Chip tone="warn">Re-solve due {formatDay(review.dueAt)}</Chip>}
          </div>
          <h1 className="mt-4 font-display text-4xl font-light tracking-tight text-white md:text-5xl">{p.title}</h1>
          {rec && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">{rec.reason}</p>}
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tactile group mt-6 inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-sm text-fg hover:border-white/25"
          >
            Open on LeetCode <ArrowUpRight className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>

          <div className="mt-12">
            <AttemptLogger problemId={slug} estimate={p.minutes} hint={p.hint} />
          </div>
        </div>

        <aside className="space-y-10">
          {pattern && (
            <div>
              <Label className="mb-3">The pattern</Label>
              <div className="font-display text-lg text-white">{pattern.name}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{pattern.idea}</p>
            </div>
          )}
          <div>
            <Label className="mb-3">Your attempts</Label>
            {attempts.length === 0 ? (
              <p className="text-[13.5px] text-faint">None yet. The first honest attempt is the most useful data point.</p>
            ) : (
              <ul className="space-y-3">
                {attempts.map((a) => (
                  <li key={a.id} className="border-l-2 pl-3" style={{ borderColor: a.solved && !a.solutionViewed ? "var(--accent)" : "var(--bad)" }}>
                    <div className="text-[13.5px] text-fg">
                      {a.solved ? (a.solutionViewed ? "Solved after peeking" : "Solved") : "Not solved"} · {a.minutes} min
                    </div>
                    <div className="font-mono text-[11px] text-faint">
                      {formatDay(a.day)} · confidence {a.confidence}/5 {a.hintsUsed ? `· ${a.hintsUsed} hint${a.hintsUsed > 1 ? "s" : ""}` : ""}
                    </div>
                    {a.mistake && <div className="mt-0.5 font-mono text-[11px] text-bad/80">{MISTAKE_LABELS[a.mistake]}</div>}
                    {a.notes && <p className="mt-1 text-[12.5px] text-muted">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Label className="mb-3">Same pattern</Label>
            <ul className="space-y-1.5">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link href={`/dsa/${s.id}`} className="text-[13.5px] text-muted hover:text-fg">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
