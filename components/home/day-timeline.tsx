import { cn } from "@/lib/cn";

/**
 * 180 ticks — the whole program at a glance. Past days are drawn, active days
 * are brighter, today is lime, and month boundaries are labelled.
 */
export function DayTimeline({ day, activeDays, months }: { day: number; activeDays: Set<number>; months: { month: number; title: string }[] }) {
  return (
    <div className="w-full">
      <div className="flex h-7 items-end gap-[2px]" aria-label={`Day ${day} of 180`}>
        {Array.from({ length: 180 }, (_, i) => {
          const d = i + 1;
          const isToday = d === day;
          const past = d < day;
          const active = activeDays.has(d);
          const monthStart = i % 30 === 0;
          return (
            <span
              key={d}
              className={cn(
                "flex-1 rounded-[1px] transition-colors",
                isToday ? "h-7 bg-accent" : monthStart ? "h-5" : "h-3",
                !isToday && (active ? "bg-white/55" : past ? "bg-white/15" : "bg-white/[0.06]"),
              )}
            />
          );
        })}
      </div>
      <div className="mt-2 hidden grid-cols-6 font-mono text-[10px] uppercase tracking-wider text-faint sm:grid">
        {months.map((m) => (
          <span key={m.month} className={cn("truncate pr-2", Math.ceil(day / 30) === m.month && "text-muted")}>
            M{m.month} · {m.title.split(" + ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
