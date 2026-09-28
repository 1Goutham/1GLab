import { desc, eq } from "drizzle-orm";
import { requireUser, authMode } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { providerStatus } from "@/lib/ai/provider";
import { logout } from "@/lib/actions/settings";
import { ACHIEVEMENTS } from "@/content/achievements";
import { Bracket, PageHeader, Section } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/settings/profile-form";
import { cn } from "@/lib/cn";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const ai = providerStatus();
  const unlocked = await db.select().from(s.userAchievements).where(eq(s.userAchievements.userId, user.id)).orderBy(desc(s.userAchievements.unlockedAt));
  const got = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Settings" title="Tune the OS." />
      <ProfileForm
        initial={{
          currentLevel: user.currentLevel,
          dailyMinutes: user.dailyMinutes,
          mainGoal: user.mainGoal,
          currentProjects: user.currentProjects,
          dsaConfidence: user.dsaConfidence,
          aiConfidence: user.aiConfidence,
          startDate: user.startDate,
          timezone: user.timezone,
          showcasePublic: user.showcasePublic,
        }}
      />

      <Section label="Engineering milestones">
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const at = got.get(a.id);
            return (
              <li key={a.id} className={cn("bg-bg p-4", !at && "opacity-45")}>
                <div className="flex items-center gap-2.5">
                  <span className={cn("size-1.5 rounded-full", at ? "bg-accent" : "bg-white/20")} />
                  <span className={cn("text-[14px]", at ? "text-white" : "text-muted")}>{a.title}</span>
                </div>
                <p className="mt-1 pl-4 text-[12.5px] text-muted">{a.description}</p>
                {at && <p className="mt-1 pl-4 font-mono text-[10.5px] text-faint">{at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section label="System">
        <dl className="border-b border-line text-[14px]">
          <Row k="AI mentor" v={ai.online ? `${ai.provider} · ${ai.model}` : "Offline mode — set ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY"} ok={ai.online} />
          <Row k="YouTube" v={process.env.YOUTUBE_API_KEY ? "YouTube Data API enabled" : "Curated recommendations (set YOUTUBE_API_KEY to resolve live videos)"} ok={Boolean(process.env.YOUTUBE_API_KEY)} />
          <Row k="Sign-in" v={authMode() === "password" ? "Password protected" : "Local development — open"} ok={authMode() === "password"} />
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <Bracket href="/showcase">Open showcase</Bracket>
          {authMode() === "password" && (
            <form action={logout}>
              <button className="font-mono text-[12.5px] text-faint hover:text-bad">Sign out</button>
            </form>
          )}
        </div>
      </Section>
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-t border-line py-3">
      <dt className="flex items-center gap-2 text-muted">
        <span className={cn("size-1.5 rounded-full", ok ? "bg-accent" : "bg-warn")} />
        {k}
      </dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}
