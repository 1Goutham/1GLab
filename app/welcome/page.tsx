import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/engine/dates";
import { Onboarding } from "./onboarding";

export const metadata = { title: "Welcome" };

/**
 * First run. Six essential questions, prefilled with what we already know
 * about Goutham — confirm or edit, then the first week is generated.
 */
export default async function Welcome() {
  const user = await requireUser({ allowUnonboarded: true });
  if (user.onboarded) redirect("/");
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-6 py-16 md:py-24">
      <Onboarding
        defaults={{
          currentLevel: user.currentLevel,
          dailyMinutes: user.dailyMinutes,
          mainGoal: user.mainGoal,
          currentProjects: user.currentProjects,
          dsaConfidence: user.dsaConfidence,
          aiConfidence: user.aiConfidence,
          startDate: todayISO(user.timezone),
        }}
      />
    </div>
  );
}
