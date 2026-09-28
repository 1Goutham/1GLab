import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

/**
 * Single-owner authentication.
 *
 * The OS belongs to one person, so there is one account: OWNER_EMAIL +
 * OWNER_PASSWORD from the environment. A successful sign-in sets a signed,
 * httpOnly session cookie (HS256 JWT, 30 days). Every server action, route
 * handler and data loader calls `requireUser()` — the proxy's redirect is only
 * an optimistic convenience, never the security boundary.
 *
 * Local development without OWNER_PASSWORD runs signed-in automatically.
 * In production OWNER_PASSWORD and AUTH_SECRET are required.
 */
export const SESSION_COOKIE = "aios_session";
export const OWNER_ID = "goutham";
const MAX_AGE = 60 * 60 * 24 * 30;

export function authMode(): "password" | "dev-open" | "misconfigured" {
  if (process.env.OWNER_PASSWORD && process.env.AUTH_SECRET) return "password";
  if (process.env.NODE_ENV !== "production") return "dev-open";
  return "misconfigured";
}

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be at least 32 characters");
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only");
  }
  return new TextEncoder().encode(s);
}

export function checkCredentials(email: string, password: string) {
  const expectedEmail = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  const expected = process.env.OWNER_PASSWORD ?? "";
  if (!expected) return false;
  const h = (v: string) => createHash("sha256").update(v).digest();
  const emailOk = !expectedEmail || email.trim().toLowerCase() === expectedEmail;
  return timingSafeEqual(h(password), h(expected)) && emailOk;
}

export async function createSession() {
  const token = await new SignJWT({ sub: OWNER_ID })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const mode = authMode();
  if (mode === "dev-open") return OWNER_ID;
  if (mode === "misconfigured") return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type User = typeof users.$inferSelect;

/** One lookup per request: layout and page share the same user object (and so the same cached state). */
const findUser = cache(async (id: string) => db.query.users.findFirst({ where: eq(users.id, id) }));

/** For pages: redirects to /login when signed out, to /welcome before onboarding. */
export async function requireUser(opts: { allowUnonboarded?: boolean } = {}): Promise<User> {
  const id = await sessionUserId();
  if (!id) redirect("/login");
  const user = await findUser(id);
  if (!user) redirect("/login?error=seed");
  if (!user.onboarded && !opts.allowUnonboarded) redirect("/welcome");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function getUserOrThrow(): Promise<User> {
  const id = await sessionUserId();
  if (!id) throw new UnauthorizedError();
  const user = await findUser(id);
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
