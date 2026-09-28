import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { OWNER_ID, requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { dsaView, scoresOf } from "@/lib/data/derive";
import { ENGINEERING_MAP } from "@/lib/engine/progress";
import { DOMAIN_COLOR, Meter } from "@/components/ui/primitives";

export const metadata = { title: "Showcase — Goutham G" };

/**
 * "Here is what I can build." Public only when enabled in Settings. Shows
 * projects, shipped labs, skills and DSA milestones — never the journal,
 * notes, mentor conversations or reflections.
 */
export default async function Showcase() {
  const owner = await db.query.users.findFirst({ where: eq(users.id, OWNER_ID) });
  const user = owner?.showcasePublic ? owner : await requireUser();
  const st = await loadState(user);
  const { categories } = scoresOf(st);
  const dsa = dsaView(st);
  const projects = st.projects.filter((p) => p.showcase && p.status !== "planned");
  const labs = st.labs.filter((l) => st.labProgress.find((p) => p.labId === l.id)?.status === "completed");
  const concepts = st.topicProgress.filter((p) => p.status === "completed").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Goutham G · AI Engineering journey</div>
      <h1 className="mt-6 font-display text-5xl font-extralight leading-[1.05] tracking-tight text-white md:text-7xl">
        Here&apos;s what I can build.
      </h1>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-muted">
        Day {st.day} of a 180-day program to become an advanced AI engineer — full-stack product engineering, going deep on models, retrieval, agents, evaluation and system design.
      </p>

      <div className="mt-14 grid grid-cols-2 gap-8 border-y border-line py-8 md:grid-cols-4">
        {[
          ["Concepts understood", concepts],
          ["Labs shipped", labs.length],
          ["DSA solved", dsa.solved],
          ["Projects", projects.length],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div className="font-display text-4xl font-extralight text-white">{v}</div>
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{k}</div>
          </div>
        ))}
      </div>

      <section className="mt-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Projects</div>
        <ul className="mt-6 border-b border-line">
          {projects.map((p, i) => (
            <li key={p.id} className="row-line grid gap-4 border-t border-line py-8 md:grid-cols-[60px_1fr_auto]">
              <span className="row-index font-mono text-[13px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="font-display text-[28px] font-light text-white">{p.name}</div>
                <div className="text-[13px] text-muted">{p.tagline}</div>
                <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted">{p.description}</p>
                <p className="mt-3 font-mono text-[11.5px] text-faint">{p.architecture}</p>
              </div>
              <div className="flex gap-4 md:flex-col md:items-end">
                {p.live && (
                  <a href={p.live} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-fg hover:text-accent">
                    Live <ArrowUpRight className="size-3.5" />
                  </a>
                )}
                {p.github && (
                  <a href={p.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-fg hover:text-accent">
                    Code <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {labs.length > 0 && (
        <section className="mt-20">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Engineering experiments</div>
          <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
            {labs.map((l) => {
              const repo = st.labProgress.find((p) => p.labId === l.id)?.repoUrl;
              return (
                <li key={l.id} className="bg-bg p-5">
                  <div className="text-[15px] text-fg">{l.title}</div>
                  <p className="mt-1 text-[13px] text-muted">{l.objective}</p>
                  {repo && (
                    <a href={repo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-[11.5px] text-accent">
                      {repo.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Skills — backed by evidence</div>
        <div className="mt-6 max-w-xl space-y-4">
          {ENGINEERING_MAP.map((row) => {
            const v = Math.round(row.categories.reduce((a, c) => a + (categories[c] ?? 0), 0) / row.categories.length);
            return (
              <div key={row.label} className="grid grid-cols-[90px_1fr_30px] items-center gap-3">
                <span className="text-[13.5px] text-muted">{row.label}</span>
                <Meter value={v} segments={20} color={DOMAIN_COLOR[row.domain]} />
                <span className="text-right font-mono text-[11px] text-faint">{v}</span>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-24 flex items-center justify-between border-t border-line pt-6 font-mono text-[11px] text-faint">
        <a href="https://1goutham.space" className="hover:text-fg">
          1goutham.space
        </a>
        <Link href="/" className="hover:text-fg">
          1G · AI Engineering OS
        </Link>
      </footer>
    </div>
  );
}
