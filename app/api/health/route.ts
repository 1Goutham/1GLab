import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerStatus } from "@/lib/ai/provider";
import { authProblems, dbProblem } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Public diagnostics — reports configuration state, never secret values. */
export async function GET() {
  let database = "ok";
  let seeded = false;
  if (!process.env.DATABASE_URL) database = "DATABASE_URL not set";
  else {
    try {
      const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from topics`);
      seeded = (rows[0]?.n ?? 0) > 0;
      if (!seeded) database = "connected, but not seeded — run npm run db:seed";
    } catch (err) {
      database = dbProblem(err) === "seed" ? "connected, but tables missing — run npm run db:setup" : "unreachable — check DATABASE_URL";
    }
  }
  const ai = providerStatus();
  return Response.json({
    status: database === "ok" && authProblems().filter((p) => !p.includes("optional")).length === 0 ? "ok" : "needs attention",
    database,
    auth: authProblems(),
    ai: ai.online ? ai.provider : "offline",
  });
}
