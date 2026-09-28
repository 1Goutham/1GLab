import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { Chip, Difficulty, Label } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { CodeBlock } from "@/components/ui/code-block";
import { LabWorkbench } from "@/components/labs/lab-workbench";
import { formatMinutes } from "@/lib/engine/dates";
import { focusHref } from "@/lib/focus";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: (await params).slug.replace(/-/g, " ") };
}

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const st = await loadState(user);
  const lab = st.labs.find((l) => l.id === slug);
  if (!lab) notFound();
  const p = st.labProgress.find((x) => x.labId === slug);
  const skills = lab.skillIds.map((id) => st.skills.find((k) => k.id === id)?.name ?? id);
  const topics = lab.topicIds.map((id) => st.topics.find((t) => t.id === id)).filter(Boolean);

  return (
    <div>
      <Link href="/labs" className="group mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Labs · Week {lab.week}
      </Link>

      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">{lab.isFlagship ? "Flagship lab" : "Lab"}</span>
          <Difficulty level={lab.difficulty} />
          <span className="font-mono text-[11px] text-faint">{formatMinutes(lab.minutes)}</span>
          {p?.status === "completed" && <Chip tone="accent">Shipped</Chip>}
        </div>
        <h1 className="mt-4 font-display text-4xl font-light leading-[1.08] tracking-tight text-white md:text-[48px]">{lab.title}</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-fg/90">{lab.objective}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {skills.map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
        </div>
        <div className="mt-7">
          <ButtonLink href={focusHref({ title: lab.title, refType: "lab", refId: slug }, Math.min(120, lab.minutes), lab.objective)} size="sm">
            <Timer className="size-3.5" /> Focus mode
          </ButtonLink>
        </div>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
            <div className="bg-bg p-5">
              <Label className="mb-2">Objective</Label>
              <p className="text-[14px] leading-relaxed text-fg">{lab.objective}</p>
            </div>
            <div className="bg-bg p-5">
              <Label className="mb-2">Expected output</Label>
              <p className="text-[14px] leading-relaxed text-fg">{lab.expectedOutput}</p>
            </div>
          </div>

          {lab.starter && (
            <div className="mt-10">
              <Label className="mb-4">Starter</Label>
              <CodeBlock code={lab.starter.code} lang={lab.starter.lang} title={lab.starter.title} note={lab.starter.note} />
            </div>
          )}

          <LabWorkbench
            labId={slug}
            steps={lab.steps.map((s) => ({ title: s.title, detail: <Markdown className="text-[14px]">{s.detail}</Markdown> }))}
            hints={lab.hints}
            initial={{ status: p?.status ?? "not_started", stepsDone: p?.stepsDone ?? [], hintsUsed: p?.hintsUsed ?? 0, notes: p?.notes ?? "", repoUrl: p?.repoUrl ?? "" }}
            stretch={lab.stretch}
            learned={lab.learned}
          />
        </div>

        <aside className="space-y-8">
          <div>
            <Label className="mb-3">Prerequisites</Label>
            <ul className="space-y-1.5 text-[13.5px] text-muted">
              {lab.prerequisites.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-[9px] h-px w-2 shrink-0 bg-white/30" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          {topics.length > 0 && (
            <div>
              <Label className="mb-3">Applies</Label>
              <ul className="space-y-1.5">
                {topics.map((t) => (
                  <li key={t!.id}>
                    <Link href={`/learn/${t!.id}`} className="text-[13.5px] text-fg hover:text-accent">
                      {t!.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <Label className="mb-3">Stuck?</Label>
            <Link href={`/mentor?mode=debug`} className="text-[13.5px] text-muted hover:text-fg">
              Debug it with the mentor →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
