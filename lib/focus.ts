/** Link into full-screen focus mode for a mission. */
export function focusHref(f: { title: string; refType: string; refId: string }, minutes: number, mission?: string) {
  const q = new URLSearchParams({ title: f.title, type: f.refType, ref: f.refId, min: String(Math.max(15, minutes || 45)) });
  if (mission) q.set("mission", mission.slice(0, 280));
  return `/focus?${q.toString()}`;
}
