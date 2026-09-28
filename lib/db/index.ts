import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One connection pool per server instance, created lazily on first query so
 * that a missing DATABASE_URL produces a clear error at request time (shown
 * on the sign-in page) instead of crashing every route at import time.
 * In dev the pool is parked on globalThis to survive hot reloads.
 * `prepare: false` keeps it compatible with transaction poolers (Neon,
 * Supabase, PgBouncer) that Vercel deployments usually sit behind.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local (or set it in Vercel) and point it at Postgres.");
  const client = postgres(url, { prepare: false, max: process.env.VERCEL ? 3 : 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}

type DB = ReturnType<typeof createDb>;
const globalForDb = globalThis as unknown as { __aiosDb?: DB };

function getDb(): DB {
  if (!globalForDb.__aiosDb) globalForDb.__aiosDb = createDb();
  return globalForDb.__aiosDb;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
export type { DB };
