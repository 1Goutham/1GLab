/** Streaks, consistency and learning velocity from the activity log. */
import { addDays, daysBetween } from "./dates";

/** Consecutive active days ending today (or yesterday, if today hasn't started yet). */
export function currentStreak(activeDays: Set<string>, today: string): number {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (activeDays.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(activeDays: Set<string>): number {
  const days = [...activeDays].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Share of days active in the last `window` days (0..1). */
export function consistency(activeDays: Set<string>, today: string, window = 14, startDate?: string) {
  let span = window;
  if (startDate) span = Math.min(window, daysBetween(startDate, today) + 1);
  if (span <= 0) return 0;
  let n = 0;
  for (let i = 0; i < span; i++) if (activeDays.has(addDays(today, -i))) n++;
  return n / span;
}

/** Last `days` days as { day, minutes, count } for sparkline/heatmap use. */
export function dailySeries(events: { day: string; minutes: number | null }[], today: string, days = 28) {
  const map = new Map<string, { minutes: number; count: number }>();
  for (const e of events) {
    const m = map.get(e.day) ?? { minutes: 0, count: 0 };
    m.minutes += e.minutes ?? 0;
    m.count += 1;
    map.set(e.day, m);
  }
  const out: { day: string; minutes: number; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, ...(map.get(day) ?? { minutes: 0, count: 0 }) });
  }
  return out;
}
