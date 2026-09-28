import { redirect } from "next/navigation";
import { authMode } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const mode = authMode();
  if (mode === "dev-open" && sp.error !== "seed") redirect("/");

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <span className="grid size-9 place-items-center whitespace-nowrap rounded-lg border border-line-strong font-display text-[14px] font-semibold">
            <span>1<span className="text-accent">G</span></span>
          </span>
          <span className="font-display text-[15px] text-fg">AI Engineering OS</span>
        </div>
        <h1 className="font-display text-3xl font-light text-white">Welcome back.</h1>
        <p className="mt-2 text-sm text-muted">Today&apos;s mission is waiting.</p>
        {sp.error === "seed" ? (
          <p className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm text-warn">
            The database has no learner yet. Run <code className="font-mono">npm run db:setup</code> and reload.
          </p>
        ) : mode === "misconfigured" ? (
          <p className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm text-warn">
            Sign-in isn&apos;t configured. Set <code className="font-mono">OWNER_EMAIL</code>, <code className="font-mono">OWNER_PASSWORD</code> and{" "}
            <code className="font-mono">AUTH_SECRET</code> in your environment.
          </p>
        ) : (
          <LoginForm next={sp.next ?? "/"} />
        )}
      </div>
    </div>
  );
}
