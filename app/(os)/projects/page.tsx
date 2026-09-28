import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { Chip, Label, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const flagship = st.projects.find((p) => p.isFlagship);
  const others = st.projects.filter((p) => !p.isFlagship).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const skillName = (id: string) => st.skills.find((k) => k.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader eyebrow="Projects" title="What your projects actually prove." description="Each project is measured by the skills it demonstrates — and what it would take to demonstrate more." />

      {flagship && (
        <Link href={`/projects/${flagship.id}`} className="group relative block overflow-hidden rounded-2xl border border-accent/30 bg-accent/[0.03] p-6 md:p-8">
          <div className="flex items-center justify-between">
            <Label className="text-accent">Flagship</Label>
            <ArrowUpRight className="size-5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
          </div>
          <h2 className="mt-4 font-display text-4xl font-light text-white">{flagship.name}</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">{flagship.description}</p>
          <div className="mt-8 grid grid-cols-3 gap-2 md:grid-cols-6">
            {flagship.milestones.map((m, i) => (
              <div key={m.title}>
                <div className={cn("h-1 rounded-full", m.done ? "bg-accent" : (m.month ?? 0) === st.month ? "bg-accent/40" : "bg-white/[0.08]")} />
                <div className="mt-2 font-mono text-[10px] text-faint">M{m.month ?? i + 1}</div>
                <div className={cn("mt-0.5 text-[12px] leading-snug", m.done ? "text-fg" : "text-muted")}>{m.title}</div>
              </div>
            ))}
          </div>
        </Link>
      )}

      <ul className="mt-12 border-b border-line">
        {others.map((p, i) => {
          const ev = Object.entries(p.skillEvidence).sort((a, b) => b[1] - a[1]);
          return (
            <li key={p.id} className="row-line border-t border-line">
              <Link href={`/projects/${p.id}`} className="grid gap-4 py-7 md:grid-cols-[60px_1fr_280px]">
                <span className="row-index font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-[26px] font-light text-white">{p.name}</span>
                    <Chip tone={p.status === "shipped" ? "accent" : "muted"}>{p.status}</Chip>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">{p.tagline}</div>
                  <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">{p.description}</p>
                </div>
                <div className="space-y-1.5">
                  {ev.slice(0, 5).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_1fr_28px] items-center gap-2">
                      <span className="truncate text-[12px] text-muted">{skillName(k)}</span>
                      <span className="h-[3px] rounded-full bg-white/[0.07]">
                        <span className="meter-fill block h-full rounded-full" style={{ width: `${v}%`, background: v >= 60 ? "var(--accent)" : v >= 30 ? "var(--fg-muted)" : "var(--bad)" }} />
                      </span>
                      <span className="text-right font-mono text-[10.5px] text-faint">{v}</span>
                    </div>
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
