import Link from "next/link";
import { ArrowUpRight, CornerDownRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { activityOf, continueTopic, dsaView, insightOf, missionOf, monthStatus, scoresOf, weaknessOf } from "@/lib/data/derive";
import { ENGINEERING_MAP } from "@/lib/engine/progress";
import { daysBetween, formatDay, formatMinutes, greeting, hourIn, isSunday } from "@/lib/engine/dates";
import { MissionList } from "@/components/home/mission-list";
import { DayTimeline } from "@/components/home/day-timeline";
import { Bracket, DOMAIN_COLOR, Label, Meter, Stat } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const metadata = { title: "Today" };

type Energy = "low" | "medium" | "high";

export default async function Home({ searchParams }: { searchParams: Promise<{ energy?: string }> }) {
  const sp = await searchParams;
  const energy: Energy = sp.energy === "low" || sp.energy === "high" ? sp.energy : "medium";
  const user = await requireUser();
  const st = await loadState(user);

  const mission = missionOf(st, energy);
  const act = activityOf(st);
  const { categories } = scoresOf(st);
  const insight = insightOf(st);
  const cont = continueTopic(st);
  const weakness = weaknessOf(st);
  const dsa = dsaView(st);
  const months = monthStatus(st);
  const mod = st.modules.find((m) => m.month === st.month);
  const wk = st.weeks.find((w) => w.week === st.week);

  const doneCount = mission.items.filter((i) => i.done).length;
  const remaining = mission.items.filter((i) => !i.done).reduce((a, i) => a + i.minutes, 0);
  const activeDays = new Set(st.events.map((e) => daysBetween(st.user.startDate, e.day) + 1));
  const labsDone = st.labProgress.filter((p) => p.status === "completed").length;
  const topicsDone = st.topicProgress.filter((p) => p.status === "completed").length;
  const unlockedMonth = months.find((m) => m.unlocked && !st.events.some((e) => e.type === "level_up" && e.refId === String(m.module.month)));

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="rise">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          <span>{formatDay(st.today, { weekday: "long", day: "numeric", month: "long" })}</span>
          <span className="h-px w-4 bg-line-strong" />
          <span>
            Week {st.week} · Month {st.month}
          </span>
        </div>
        <h1 className="mt-5 font-display text-[40px] font-extralight leading-[1.05] tracking-tight text-white md:text-[64px]">
          {greeting(hourIn(st.user.timezone))}, {st.user.name}.
        </h1>
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-xl space-y-1.5 text-[15px] text-muted">
            <p>
              You are building towards <span className="font-medium tracking-wide text-fg">{st.user.headline.toUpperCase()}</span>.
            </p>
            <p>
              Current focus: <span className="text-fg">{mod?.title}</span>
              {wk && (
                <>
                  <span className="text-faint"> — </span>
                  {wk.title}
                </>
              )}
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="font-display text-5xl font-extralight tabular-nums text-white">{st.day}</span>
            <span className="ml-1 text-sm text-faint">/ 180</span>
          </div>
        </div>
        <div className="mt-6">
          <DayTimeline day={st.day} activeDays={activeDays} months={st.modules.map((m) => ({ month: m.month, title: m.title }))} />
        </div>
      </section>

      {unlockedMonth && (
        <Link
          href={`/level-up/${unlockedMonth.module.month}`}
          className="group mt-10 flex items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent/[0.06] px-5 py-4"
        >
          <span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">Level {String(unlockedMonth.module.month).padStart(2, "0")} unlocked</span>
            <span className="mt-0.5 block font-display text-lg text-white">{unlockedMonth.module.levelTitle}</span>
          </span>
          <ArrowUpRight className="nudge-x size-5 text-accent" />
        </Link>
      )}

      {isSunday(st.today) && (
        <Link href="/review/weekly" className="group mt-6 flex items-center justify-between gap-4 rounded-xl border border-line-strong px-5 py-4 hover:border-white/25">
          <span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Sunday</span>
            <span className="mt-0.5 block font-display text-lg text-white">Your weekly engineering review is ready.</span>
          </span>
          <ArrowUpRight className="nudge-x size-5 text-muted" />
        </Link>
      )}

      <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        {/* ── Today's mission ─────────────────────────────────────────── */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Label>Today&apos;s mission</Label>
              <p className="mt-2 text-sm text-muted">
                {doneCount === mission.items.length && mission.items.length > 0
                  ? "All done. Reflect in the journal, then rest — tomorrow compounds on today."
                  : `${doneCount} of ${mission.items.length} done · ${formatMinutes(remaining)} left`}
              </p>
            </div>
            <EnergyToggle energy={energy} />
          </div>
          {mission.note && <p className="mb-4 border-l-2 border-accent/60 pl-3 text-[13.5px] text-muted">{mission.note}</p>}
          <MissionList items={mission.items} />

          {cont && (
            <Link href={`/learn/${cont.topic.id}`} className="group mt-10 flex items-center justify-between gap-6 border-b border-line pb-5">
              <div>
                <Label>Continue</Label>
                <div className="mt-3 flex items-center gap-2 font-display text-xl font-light text-white">
                  <span className="text-muted">{cont.module?.title.split(" + ")[0]}</span>
                  <CornerDownRight className="size-4 text-faint" />
                  {cont.topic.title}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[11px] text-faint">level {cont.level}/5</div>
                <Meter value={(cont.level / 5) * 100} className="mt-2 w-24" />
              </div>
            </Link>
          )}
        </section>

        {/* ── Side rail ───────────────────────────────────────────────── */}
        <aside className="space-y-12">
          {insight && (
            <div>
              <Label>One thing to improve</Label>
              <p className="mt-4 font-display text-[19px] font-light leading-snug text-white">&ldquo;{insight.text}&rdquo;</p>
              <div className="mt-4">
                <Bracket href={insight.href}>{insight.cta}</Bracket>
              </div>
            </div>
          )}

          <div>
            <Label>Your engineering map</Label>
            <div className="mt-5 space-y-3.5">
              {ENGINEERING_MAP.slice(0, 5).map((row) => {
                const vals = row.categories.map((c) => categories[c] ?? 0);
                const v = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                return (
                  <div key={row.label} className="grid grid-cols-[64px_1fr_28px] items-center gap-3">
                    <span className="text-[13px] text-muted">{row.label}</span>
                    <Meter value={v} segments={10} color={DOMAIN_COLOR[row.domain]} />
                    <span className="text-right font-mono text-[11px] tabular-nums text-faint">{v}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Bracket href="/progress" className="text-[12px]">
                Full skill map
              </Bracket>
            </div>
          </div>

          {weakness && (
            <div>
              <Label>Your next weakness</Label>
              <p className="mt-3 text-[14px] leading-relaxed text-fg">{weakness.action}</p>
              <p className="mt-1 font-mono text-[11px] text-faint">
                {weakness.skill.name} · {weakness.dimension} {weakness.skill.dims[weakness.dimension]}%
              </p>
            </div>
          )}

          <div>
            <Label>Daily progress</Label>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
              <Stat label="Today" value={`${doneCount}/${mission.items.length}`} sub="missions" />
              <Stat label="Streak" value={act.streak} sub={act.streak === 1 ? "day" : "days"} />
              <Stat label="Focus" value={formatMinutes(act.focusToday)} sub="today" />
              <Stat label="Solved" value={dsa.solved} sub="DSA problems" />
              <Stat label="Concepts" value={topicsDone} sub="completed" />
              <Stat label="Labs" value={labsDone} sub="shipped" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EnergyToggle({ energy }: { energy: Energy }) {
  const opts: { v: Energy; label: string }[] = [
    { v: "low", label: "Low" },
    { v: "medium", label: "Normal" },
    { v: "high", label: "High" },
  ];
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Energy</span>
      <div className="flex rounded-lg border border-line p-0.5">
        {opts.map((o) => (
          <Link
            key={o.v}
            href={o.v === "medium" ? "/" : `/?energy=${o.v}`}
            scroll={false}
            className={cn("rounded-md px-2.5 py-1 text-[12px] transition-colors", energy === o.v ? "bg-white/[0.08] text-fg" : "text-faint hover:text-muted")}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
