import { requireUser } from "@/lib/auth";
import { FocusSession } from "@/components/focus-session";
import { Toaster } from "@/components/shell/toaster";

export const metadata = { title: "Focus" };

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ title?: string; type?: string; ref?: string; min?: string; mission?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const minutes = Math.min(240, Math.max(5, Number(sp.min) || 45));
  const back = sp.type === "topic" && sp.ref ? `/learn/${sp.ref}` : sp.type === "lab" && sp.ref ? `/labs/${sp.ref}` : sp.type === "dsa" && sp.ref ? `/dsa/${sp.ref}` : "/";
  return (
    <>
      <FocusSession
        title={(sp.title ?? "Deep work").slice(0, 160)}
        mission={sp.mission?.slice(0, 400) ?? null}
        refType={sp.type ?? null}
        refId={sp.ref ?? null}
        minutes={minutes}
        workHref={back}
      />
      <Toaster />
    </>
  );
}
