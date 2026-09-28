import { requireUser } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { continueTopic, missionOf } from "@/lib/data/derive";
import { providerStatus } from "@/lib/ai/provider";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileTabBar, MobileTopBar } from "@/components/shell/mobile-nav";
import { CommandPalette } from "@/components/shell/command-palette";
import { Toaster } from "@/components/shell/toaster";
import { focusHref } from "@/lib/focus";

export default async function OSLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const st = await loadState(user);
  const cont = continueTopic(st);
  const mission = missionOf(st);
  const next = mission.items.find((i) => !i.done && i.focus);
  const dsa = mission.items.find((i) => i.kind === "dsa");
  const ai = providerStatus();

  return (
    <div className="min-h-dvh">
      <Sidebar day={st.day} dueReviews={mission.dueReviews} ai={{ online: ai.online, provider: ai.provider }} />
      <MobileTopBar day={st.day} />
      <main className="lg:pl-[232px]">
        <div className="mx-auto w-full max-w-[1180px] px-5 pb-32 pt-8 md:px-10 md:pt-12 lg:pb-20">{children}</div>
      </main>
      <MobileTabBar />
      <CommandPalette
        ctx={{
          continueHref: cont ? `/learn/${cont.topic.id}` : null,
          missionHref: dsa && !dsa.done ? dsa.href : null,
          missionFocus: next?.focus ? focusHref(next.focus, next.minutes, next.mission) : null,
          projects: st.projects.map((p) => ({ id: p.id, name: p.name })),
        }}
      />
      <Toaster />
    </div>
  );
}
