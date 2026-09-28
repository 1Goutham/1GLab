import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { Chip, Difficulty, DomainDot, Label, PageHeader } from "@/components/ui/primitives";
import { StatusMark } from "@/components/ui/status-mark";
import { cn } from "@/lib/cn";

export const metadata = { title: "Labs" };

const DURATIONS = ["20m", "45m", "90m", "3h", "1d", "weekend"] as const;
const DUR_LABEL: Record<string, string> = { "20m": "20 min", "45m": "45 min", "90m": "90 min", "3h": "3 hours", "1d": "1 day", weekend: "Weekend" };

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const user = await requireUser();
  const st = await loadState(user);
  const status = (id: string) => st.labProgress.find((p) => p.labId === id)?.status ?? "not_started";
  const labs = st.labs.filter((l) => !t || l.duration === t);
  const flagship = st.labs.filter((l) => l.isFlagship);
  const done = st.labs.filter((l) => status(l.id) === "completed").length;

  return (
    <div>
      <PageHeader
        eyebrow="Labs"
        title="Small builds. Real artefacts."
        description="Twenty minutes to a weekend. Each lab has an objective, an expected output and a stretch goal — the evidence that you can actually build it."
      >
        <div className="text-right">
          <div className="font-display text-3xl font-extralight tabular-nums text-white">
            {done}
            <span className="text-lg text-faint">/{st.labs.length}</span>
          </div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">labs shipped</div>
        </div>
      </PageHeader>

      <section className="mb-14">
        <Label>Flagship — Cortex, built month by month</Label>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-6">
          {flagship.map((l) => {
            const s = status(l.id);
            const m = Math.ceil(l.week / 4);
            return (
              <Link key={l.id} href={`/labs/${l.id}`} className={cn("group bg-bg p-4 transition-colors hover:bg-white/[0.03]", m === st.month && "bg-accent/[0.04]")}>
                <div className="flex items-center justify-between font-mono text-[10.5px] text-faint">
                  M{m}
                  <StatusMark status={s} className="size-3.5" />
                </div>
                <div className={cn("mt-6 text-[13.5px] leading-snug", s === "completed" ? "text-accent" : "text-fg")}>{l.title.replace(/^Cortex v[\d.]+:?\s*/i, "")}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-1.5">
        <Link href="/labs" className={cn("rounded-full border px-3 py-1 text-[12.5px]", !t ? "border-white/25 bg-white/[0.06] text-fg" : "border-line text-muted hover:text-fg")}>
          Any length
        </Link>
        {DURATIONS.map((d) => (
          <Link key={d} href={`/labs?t=${d}`} className={cn("rounded-full border px-3 py-1 text-[12.5px]", t === d ? "border-white/25 bg-white/[0.06] text-fg" : "border-line text-muted hover:text-fg")}>
            {DUR_LABEL[d]}
          </Link>
        ))}
      </div>

      <ul className="border-b border-line">
        {labs.map((l) => {
          const s = status(l.id);
          return (
            <li key={l.id} className="row-line border-t border-line">
              <Link href={`/labs/${l.id}`} className="grid grid-cols-[28px_1fr] gap-4 py-5 md:grid-cols-[28px_1fr_100px_110px]">
                <StatusMark status={s} className="mt-1" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[16px] text-fg">{l.title}</span>
                    {l.isFlagship && <Chip tone="accent">Flagship</Chip>}
                    {l.week === st.week && <Chip>This week</Chip>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{l.objective}</p>
                </div>
                <div className="hidden pt-1 md:block">
                  <Difficulty level={l.difficulty} />
                </div>
                <div className="hidden items-start justify-end gap-2 pt-1 font-mono text-[11px] text-faint md:flex">
                  <DomainDot domain={l.domain} className="mt-1" />
                  {DUR_LABEL[l.duration]} · W{l.week}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
