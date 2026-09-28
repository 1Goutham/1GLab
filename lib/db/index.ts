import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One connection pool per server instance. In dev, Next.js hot-reloads
 * modules, so the pool is parked on globalThis to avoid leaking connections.
 * `prepare: false` keeps it compatible with transaction poolers (Neon,
 * Supabase, PgBouncer) that Vercel deployments usually sit behind.
 */
const globalForDb = globalThis as unknown as { __aiosSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at Postgres.");
  return postgres(url, { prepare: false, max: process.env.VERCEL ? 3 : 10, idle_timeout: 20 });
}

const sql = globalForDb.__aiosSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__aiosSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
export type DB = typeof db;
