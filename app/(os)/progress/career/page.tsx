import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { scoresOf, topicStatus } from "@/lib/data/derive";
import { readinessBand } from "@/lib/engine/progress";
import { Label, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const metadata = { title: "Career readiness" };

/**
 * Capabilities, not predictions. Each area gets a band — and the band is only
 * as credible as the evidence listed under it.
 */
const AREAS: { name: string; match: (skill: { categoryId: string; parentId: string | null }) => boolean }[] = [
  { name: "AI Engineering", match: (s) => s.categoryId === "ai-depth" },
  { name: "AI Systems", match: (s) => s.categoryId === "ai-systems" },
  { name: "Backend", match: (s) => s.categoryId === "advanced-dev" },
  { name: "Frontend", match: (s) => s.parentId === "frontend-craft" },
  { name: "Product Engineering", match: (s) => s.parentId === "product-thinking" },
  { name: "System Design", match: (s) => s.categoryId === "system-design" },
  { name: "DSA", match: (s) => s.categoryId === "dsa" },
  { name: "Cloud", match: (s) => s.categoryId === "cloud-devops" },
  { name: "Security", match: (s) => s.categoryId === "security" },
  { name: "Communication", match: (s) => s.categoryId === "communication" },
];

const BANDS = ["Beginner", "Working", "Strong", "Advanced"] as const;

export default async function CareerPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const { scores } = scoresOf(st);

  return (
    <div>
      <Link href="/progress" className="group mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5" /> Progress
      </Link>
      <PageHeader
        eyebrow="Private · career readiness"
        title="What you can prove you can do."
        description="Bands come from evidence: shipped labs, completed concepts, solved problems, passed explanations and projects. Self-reported baselines count for less and are marked."
      />

      <div className="border-b border-line">
        {AREAS.map((area) => {
          const skills = st.skills.filter((k) => !k.isGroup && area.match(k));
          const ids = new Set(skills.map((k) => k.id));
          const vals = skills.map((k) => scores.get(k.id)!).filter(Boolean);
          const score = vals.length ? Math.round(vals.reduce((a, s) => a + s.overall, 0) / vals.length) : 0;
          const band = readinessBand(score);
          const selfReported = vals.every((v) => v.selfReported);

          const topics = st.topics.filter((t) => t.skillIds.some((x) => ids.has(x)) && topicStatus(st, t.id)?.status === "completed");
          const labs = st.labs.filter((l) => l.skillIds.some((x) => ids.has(x)) && st.labProgress.find((p) => p.labId === l.id)?.status === "completed");
          const problems = area.name === "DSA" ? [...new Set(st.attempts.filter((a) => a.solved && !a.solutionViewed).map((a) => a.problemId))] : [];
          const projects = st.projects.filter((p) => Object.entries(p.skillEvidence).some(([k, v]) => ids.has(k) && v >= 50));
          const explained = st.reviews.filter((r) => r.itemType === "topic" && (r.kind === "explain" || r.kind === "interview") && r.result === "pass" && st.topics.find((t) => t.id === r.itemId)?.skillIds.some((x) => ids.has(x)));
          const evidenceCount = topics.length + labs.length + problems.length + projects.length + explained.length;

          return (
            <section key={area.name} className="grid gap-6 border-t border-line py-8 md:grid-cols-[240px_1fr]">
              <div>
                <h2 className="font-display text-2xl font-light text-white">{area.name}</h2>
                <div className="mt-4 flex gap-1">
                  {BANDS.map((b) => (
                    <span key={b} className={cn("h-1.5 flex-1 rounded-full", BANDS.indexOf(b) <= BANDS.indexOf(band) ? "bg-accent" : "bg-white/[0.08]")} />
                  ))}
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg">{band}</span>
                  <span className="font-mono text-[11px] text-faint">{score}</span>
                </div>
                {selfReported && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-warn/80">mostly self-reported</div>}
              </div>
              <div>
                <Label className="mb-3">Evidence · {evidenceCount}</Label>
                {evidenceCount === 0 ? (
                  <p className="text-[13.5px] text-faint">No evidence yet. The band above is your starting baseline.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {projects.map((p) => (
                      <Ev key={p.id} href={`/projects/${p.id}`} kind="project">
                        {p.name}
                      </Ev>
                    ))}
                    {labs.map((l) => (
                      <Ev key={l.id} href={`/labs/${l.id}`} kind="lab">
                        {l.title}
                      </Ev>
                    ))}
                    {topics.map((t) => (
                      <Ev key={t.id} href={`/learn/${t.id}`} kind="concept">
                        {t.title}
                      </Ev>
                    ))}
                    {explained.map((r) => (
                      <Ev key={r.id} href={`/learn/${r.itemId}`} kind="explained">
                        {st.topics.find((t) => t.id === r.itemId)?.title}
                      </Ev>
                    ))}
                    {problems.slice(0, 12).map((id) => (
                      <Ev key={id} href={`/dsa/${id}`} kind="solved">
                        {st.problems.find((p) => p.id === id)?.title}
                      </Ev>
                    ))}
                    {problems.length > 12 && <span className="self-center font-mono text-[11px] text-faint">+{problems.length - 12} more</span>}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Ev({ href, kind, children }: { href: string; kind: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] text-fg hover:border-line-strong">
      <span className="font-mono text-[9.5px] uppercase tracking-wider text-faint group-hover:text-accent">{kind}</span>
      {children}
    </Link>
  );
}
