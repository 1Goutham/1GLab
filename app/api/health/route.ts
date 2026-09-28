import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "unreachable";
  }
  const ai = providerStatus();
  return Response.json({ status: database === "ok" ? "ok" : "degraded", database, ai: ai.online ? ai.provider : "offline" });
}
