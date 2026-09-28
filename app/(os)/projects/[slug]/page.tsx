import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft, Code2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { Chip, Label } from "@/components/ui/primitives";
import { ProjectEditor } from "@/components/projects/project-editor";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const st = await loadState(user);
  const p = st.projects.find((x) => x.id === slug);
  if (!p) notFound();
  const skills = st.skills.filter((k) => !k.isGroup).map((k) => ({ id: k.id, name: k.name }));
  const flagshipLabs = p.isFlagship ? st.labs.filter((l) => l.isFlagship) : [];

  return (
    <div>
      <Link href="/projects" className="group mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5" /> Projects
      </Link>
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={p.status === "shipped" ? "accent" : "muted"}>{p.status}</Chip>
          {p.isFlagship && <Chip tone="accent">Flagship</Chip>}
          {p.year && <span className="font-mono text-[11px] text-faint">{p.year}</span>}
        </div>
        <h1 className="mt-4 font-display text-5xl font-light tracking-tight text-white">{p.name}</h1>
        <p className="mt-1 text-[15px] text-muted">{p.tagline}</p>
        <p className="mt-5 text-[15.5px] leading-relaxed text-fg/90">{p.description}</p>
        <div className="mt-6 flex flex-wrap gap-5">
          {p.live && (
            <a href={p.live} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13.5px] text-fg hover:text-accent">
              Live <ArrowUpRight className="size-3.5" />
            </a>
          )}
          {p.github && (
            <a href={p.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[13.5px] text-fg hover:text-accent">
              <Code2 className="size-3.5" /> GitHub
            </a>
          )}
        </div>
      </header>

      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
        <div className="bg-bg p-5">
          <Label className="mb-3">Architecture</Label>
          <p className="font-mono text-[12.5px] leading-relaxed text-fg">{p.architecture}</p>
        </div>
        <div className="bg-bg p-5">
          <Label className="mb-3">Technologies</Label>
          <div className="flex flex-wrap gap-1.5">
            {p.technologies.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          {p.features.length > 0 && (
            <>
              <Label className="mb-2 mt-5">Features</Label>
              <p className="text-[13px] leading-relaxed text-muted">{p.features.join(" · ")}</p>
            </>
          )}
        </div>
      </div>

      {flagshipLabs.length > 0 && (
        <div className="mt-10">
          <Label className="mb-4">Built month by month</Label>
          <ol className="border-b border-line">
            {flagshipLabs.map((l) => {
              const done = st.labProgress.find((x) => x.labId === l.id)?.status === "completed";
              return (
                <li key={l.id} className="grid grid-cols-[50px_1fr_auto] gap-4 border-t border-line py-3.5">
                  <span className="font-mono text-[11px] text-faint">M{Math.ceil(l.week / 4)}</span>
                  <Link href={`/labs/${l.id}`} className={done ? "text-accent" : "text-fg hover:text-accent"}>
                    {l.title}
                  </Link>
                  <span className="font-mono text-[11px] text-faint">{done ? "shipped" : `week ${l.week}`}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <ProjectEditor
        project={{
          id: p.id,
          status: p.status,
          skillEvidence: p.skillEvidence,
          bugs: p.bugs,
          decisions: p.decisions,
          learningOutcomes: p.learningOutcomes,
          milestones: p.milestones,
          improvements: p.improvements,
          showcase: p.showcase,
        }}
        skills={skills}
      />
    </div>
  );
}
