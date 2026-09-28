/** Date helpers. All "days" are ISO dates (YYYY-MM-DD) in the learner's timezone. */

export const PROGRAM_DAYS = 180;
export const PROGRAM_WEEKS = 24;

export function todayISO(timeZone = "Asia/Kolkata", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hourIn(timeZone = "Asia/Kolkata", now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now)) % 24;
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUTC(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toUTC(toISO) - toUTC(fromISO)) / 86_400_000);
}

/** Day 1 is the start date. */
export function programDay(startISO: string, today: string): number {
  return Math.max(1, Math.min(PROGRAM_DAYS, daysBetween(startISO, today) + 1));
}

export function programWeek(startISO: string, today: string): number {
  return Math.max(1, Math.min(PROGRAM_WEEKS, Math.ceil(programDay(startISO, today) / 7)));
}

export function programMonth(week: number): number {
  return Math.max(1, Math.min(6, Math.ceil(week / 4)));
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const dow = new Date(toUTC(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function isSunday(iso: string) {
  return new Date(toUTC(iso)).getUTCDay() === 0;
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(toUTC(iso)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
