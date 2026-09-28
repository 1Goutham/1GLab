import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { activityOf, dsaView, missionOf, monthStatus, scoresOf, weaknessOf, topicStatus } from "@/lib/data/derive";
import { DIMENSIONS, ENGINEERING_MAP } from "@/lib/engine/progress";
import { DSA_PATTERNS } from "@/content/dsa";
import { addDays, formatMinutes } from "@/lib/engine/dates";
import { Bracket, DOMAIN_COLOR, Label, Meter, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { SkillTree, type TreeCategory } from "@/components/progress/skill-tree";
import { cn } from "@/lib/cn";

export const metadata = { title: "Progress" };

const CAT_COLOR: Record<string, string> = {
  "ai-depth": "var(--d-ai)",
  "ai-systems": "var(--d-ai)",
  dsa: "var(--d-dsa)",
  "advanced-dev": "var(--d-backend)",
  "product-eng": "var(--d-frontend)",
  "system-design": "var(--d-systems)",
  "cloud-devops": "var(--d-cloud)",
  security: "var(--d-security)",
  communication: "var(--fg-muted)",
};

export default async function ProgressPage() {
  const user = await requireUser();
  const st = await loadState(user);
  const { scores, categories } = scoresOf(st);
  const act = activityOf(st);
  const dsa = dsaView(st);
  const months = monthStatus(st);
  const weakness = weaknessOf(st);
  const mission = missionOf(st);
  const current = months.find((m) => m.current);
  const unlockedLevels = months.filter((m) => m.unlocked).length;

  const tree: TreeCategory[] = st.categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: CAT_COLOR[c.id] ?? "var(--accent)",
    score: categories[c.id] ?? 0,
    groups: st.skills
      .filter((g) => g.categoryId === c.id && g.isGroup)
      .map((g) => ({
        id: g.id,
        name: g.name,
        skills: st.skills
          .filter((k) => k.parentId === g.id)
          .map((k) => {
            const sc = scores.get(k.id)!;
            return { id: k.id, name: k.name, overall: sc.overall, selfReported: sc.selfReported, dims: DIMENSIONS.map((d) => ({ label: d.label, value: sc.dims[d.id] })) };
          }),
      })),
  }));

  const leaves = [...scores.values()];
  const evidenced = leaves.filter((s) => !s.selfReported);
  const strongest = [...(evidenced.length >= 3 ? evidenced : leaves)].sort((a, b) => b.overall - a.overall).slice(0, 4);
  const inFocus = leaves.filter((s) => st.topics.some((t) => t.week <= st.week + 1 && t.skillIds.includes(s.id)));
  const weakest = [...inFocus].sort((a, b) => a.overall - b.overall).slice(0, 4);

  const completedTopics = st.topicProgress.filter((p) => p.status === "completed");
  const weeksElapsed = Math.max(1, Math.ceil(st.day / 7));
  const velocity = completedTopics.length / weeksElapsed;
  const doneReviews = st.reviews.filter((r) => r.completedAt && r.result);
  const retention = doneReviews.length ? Math.round((100 * doneReviews.filter((r) => r.result !== "fail").length) / doneReviews.length) : null;
  const maxMin = Math.max(30, ...act.series.map((d) => d.minutes));
  const nextAction = mission.items.find((i) => !i.done);
  const growth = st.snapshots.slice(-30);

  return (
    <div>
      <PageHeader eyebrow="Progress" title="Evidence, not percentages." description="Every number here is backed by something you did: topics, mini tasks, labs, problems, reviews, projects. Self-reported baselines fade out as real evidence arrives.">
        <Bracket href="/progress/career">Career readiness</Bracket>
      </PageHeader>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
        <div className="bg-bg p-6 md:col-span-2">
          <Label>Current level</Label>
          <div className="mt-3 font-display text-3xl font-light text-white">
            Level {String(Math.max(1, unlockedLevels)).padStart(2, "0")} <span className="text-muted">·</span> {current?.module.levelTitle}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {current ? `${current.topicsCompleted}/${current.topicsTotal} concepts and ${current.labsCompleted}/${current.labsTotal} labs this month` : ""}
          </p>
          <div className="mt-5 flex gap-1">
            {months.map((m) => (
              <div key={m.module.id} className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="meter-fill h-full rounded-full bg-accent" style={{ width: `${(100 * m.topicsCompleted) / Math.max(1, m.topicsTotal)}%` }} />
                </div>
                <div className={cn("mt-1.5 font-mono text-[10px]", m.current ? "text-accent" : "text-faint")}>M{m.module.month}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bg p-6">
          <Stat label="Day" value={`${st.day}/180`} sub={`${Math.round((100 * st.day) / 180)}% of the program`} />
        </div>
        <div className="bg-bg p-6">
          <Stat label="Streak" value={act.streak} sub={`longest ${act.longest} · consistency ${Math.round(act.consistency * 100)}%`} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-6">
        <Stat label="Concepts" value={completedTopics.length} sub={`${velocity.toFixed(1)} / week`} />
        <Stat label="Labs" value={st.labProgress.filter((p) => p.status === "completed").length} />
        <Stat label="DSA solved" value={dsa.solved} />
        <Stat label="Deep work" value={formatMinutes(act.focusTotal)} />
        <Stat label="Retention" value={retention === null ? "—" : `${retention}%`} sub={`${doneReviews.length} reviews`} />
        <Stat label="Explanations" value={st.reviews.filter((r) => (r.kind === "explain" || r.kind === "interview") && r.result === "pass").length} sub="passed" />
      </div>

      <Section label="What to do next">
        <div className="grid gap-px overflow-hidden rounded-xl border border-accent/25 bg-line md:grid-cols-2">
          <div className="bg-bg p-6">
            <Label className="text-accent">Next action</Label>
            {nextAction ? (
              <>
                <div className="mt-3 font-display text-2xl font-light text-white">{nextAction.title}</div>
                <p className="mt-1 text-[13.5px] text-muted">{nextAction.mission}</p>
                <div className="mt-4">
                  <Bracket href={nextAction.href}>{nextAction.cta}</Bracket>
                </div>
              </>
            ) : (
              <p className="mt-3 text-muted">Today&apos;s mission is done. Journal, then rest.</p>
            )}
          </div>
          <div className="bg-bg p-6">
            <Label>Your next weakness</Label>
            {weakness ? (
              <>
                <div className="mt-3 font-display text-2xl font-light text-white">{weakness.skill.name}</div>
                <p className="mt-1 text-[13.5px] text-muted">{weakness.action}</p>
                <p className="mt-3 font-mono text-[11px] text-faint">
                  {DIMENSIONS.map((d) => `${d.label.split(" ")[0]} ${weakness.skill.dims[d.id] ?? "—"}`).join(" · ")}
                </p>
              </>
            ) : (
              <p className="mt-3 text-muted">Not enough evidence yet.</p>
            )}
          </div>
        </div>
      </Section>

      <Section label="Skill tree">
        <SkillTree categories={tree} />
      </Section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <div>
          <Label>Engineering depth</Label>
          <div className="mt-5 space-y-3.5">
            {ENGINEERING_MAP.map((row) => {
              const v = Math.round(row.categories.reduce((a, c) => a + (categories[c] ?? 0), 0) / row.categories.length);
              return (
                <div key={row.label} className="grid grid-cols-[80px_1fr_30px] items-center gap-3">
                  <span className="text-[13px] text-muted">{row.label}</span>
                  <Meter value={v} segments={20} color={DOMAIN_COLOR[row.domain]} />
                  <span className="text-right font-mono text-[11px] text-faint">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Last 28 days</Label>
          <div className="mt-5 flex h-28 items-end gap-[3px]">
            {act.series.map((d) => (
              <div key={d.day} className="group relative flex-1" title={`${d.day}: ${Math.round(d.minutes)} min`}>
                <div
                  className={cn("rounded-[2px]", d.day === st.today ? "bg-accent" : d.minutes ? "bg-white/40" : "bg-white/[0.06]")}
                  style={{ height: `${Math.max(3, (d.minutes / maxMin) * 112)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
            <span>{addDays(st.today, -27).slice(5)}</span>
            <span>today</span>
          </div>
        </div>
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <div>
          <Label>Strengths</Label>
          <ul className="mt-4 space-y-2">
            {strongest.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-line pb-2 text-[14px]">
                <span className="text-fg">{s.name}</span>
                <span className="font-mono text-[11px] text-muted">
                  {s.overall}
                  {s.selfReported && <span className="text-faint"> · self-reported</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Label>Weaknesses in focus</Label>
          <ul className="mt-4 space-y-2">
            {weakest.map((s) => {
              const topic = st.topics.find((t) => t.skillIds.includes(s.id) && topicStatus(st, t.id)?.status !== "completed");
              return (
                <li key={s.id} className="flex items-center justify-between border-b border-line pb-2 text-[14px]">
                  {topic ? (
                    <Link href={`/learn/${topic.id}`} className="text-fg hover:text-accent">
                      {s.name}
                    </Link>
                  ) : (
                    <span className="text-fg">{s.name}</span>
                  )}
                  <span className="font-mono text-[11px] text-muted">{s.overall}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Section label="DSA patterns">
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
          {DSA_PATTERNS.map((p) => {
            const s = dsa.stats.get(p.id);
            return (
              <Link key={p.id} href={`/dsa?pattern=${p.id}`} className="group">
                <div className="truncate text-[12px] text-muted group-hover:text-fg">{p.name}</div>
                <Meter value={s?.mastery ?? 0} color="var(--d-dsa)" className="mt-1.5" />
              </Link>
            );
          })}
        </div>
      </Section>

      {growth.length > 1 && (
        <Section label="Growth over time">
          <GrowthChart points={growth.map((g) => ({ date: g.date, v: Math.round(Object.values(g.categories).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(g.categories).length)) }))} />
        </Section>
      )}
    </div>
  );
}

function GrowthChart({ points }: { points: { date: string; v: number }[] }) {
  const W = 800;
  const H = 140;
  const min = Math.min(...points.map((p) => p.v)) - 2;
  const max = Math.max(...points.map((p) => p.v)) + 2;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / Math.max(1, max - min)) * H;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none" aria-label="Average skill score over time">
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="rgba(157,255,80,0.06)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
        <span>
          {points[0].date} · {points[0].v}
        </span>
        <span>
          {points.at(-1)!.date} · {points.at(-1)!.v}
        </span>
      </div>
    </div>
  );
}
