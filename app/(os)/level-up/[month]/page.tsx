import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { dsaView, monthStatus, topicStatus } from "@/lib/data/derive";
import { logEvent } from "@/lib/data/effects";
import { LevelUp } from "@/components/level-up";

export const metadata = { title: "Level up" };

export default async function LevelUpPage({ params }: { params: Promise<{ month: string }> }) {
  const month = Number((await params).month);
  const user = await requireUser();
  const st = await loadState(user);
  const ms = monthStatus(st).find((m) => m.module.month === month);
  if (!ms) notFound();
  const next = st.modules.find((m) => m.month === month + 1);
  const topics = st.topics.filter((t) => t.moduleId === ms.module.id && topicStatus(st, t.id)?.status === "completed");
  const labs = st.labs.filter((l) => l.moduleId === ms.module.id && st.labProgress.find((p) => p.labId === l.id)?.status === "completed");

  // Seeing it counts as having celebrated it — the Home banner stops showing.
  if (ms.unlocked && !st.events.some((e) => e.type === "level_up" && e.refId === String(month))) {
    await logEvent(user, "level_up", { refType: "month", refId: String(month) });
  }

  return (
    <LevelUp
      unlocked={ms.unlocked}
      level={month}
      title={ms.module.levelTitle}
      completed={topics.map((t) => t.title)}
      built={labs.map((l) => l.title)}
      solved={dsaView(st).solved}
      next={next ? next.title : null}
      remaining={{ topics: ms.topicsTotal - ms.topicsCompleted, labs: Math.max(0, 2 - ms.labsCompleted) }}
    />
  );
}
