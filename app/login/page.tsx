import { redirect } from "next/navigation";
import { authMode, authProblems } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const mode = authMode();
  if (mode === "dev-open" && !sp.error) redirect("/");

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
          <div className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
            Signed in, but the database is empty — its tables haven&apos;t been created yet. From your machine, run:
            <pre className="mt-3 overflow-x-auto rounded bg-black/40 p-3 font-mono text-[12px] text-fg">DATABASE_URL=&quot;…your Vercel DATABASE_URL…&quot; npm run db:setup</pre>
            Then reload this page.
          </div>
        ) : sp.error === "db" ? (
          <p className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
            The app can&apos;t reach the database. Check that <code className="font-mono">DATABASE_URL</code> is set in Vercel (Project → Settings → Environment Variables), uses the pooled
            connection string, and then redeploy.
          </p>
        ) : mode === "misconfigured" ? (
          <div className="mt-8 rounded-lg border border-warn/30 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
            Sign-in isn&apos;t configured yet:
            <ul className="mt-2 list-disc pl-5">
              {authProblems().map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2">Add them in Vercel → Project → Settings → Environment Variables, then redeploy.</p>
          </div>
        ) : (
          <LoginForm next={sp.next ?? "/"} />
        )}
      </div>
    </div>
  );
}
