"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action, isoDate } from "./util";
import { checkCredentials, createSession, destroySession } from "@/lib/auth";
import { rateLimit } from "@/lib/ai/rate-limit";
import { headers } from "next/headers";

const profile = z.object({
  currentLevel: z.string().trim().min(1).max(300),
  dailyMinutes: z.number().int().min(30).max(600),
  mainGoal: z.string().trim().min(1).max(500),
  currentProjects: z.string().max(500),
  dsaConfidence: z.number().int().min(1).max(5),
  aiConfidence: z.number().int().min(1).max(5),
  startDate: isoDate,
  timezone: z.string().max(60).optional(),
});

/** First-run onboarding: save the essentials and enter the OS. */
export const completeOnboarding = action(profile, async (input, user) => {
  await db.update(s.users).set({ ...input, onboarded: true }).where(eq(s.users.id, user.id));
  return null;
});

export const updateProfile = action(profile.extend({ showcasePublic: z.boolean() }), async (input, user) => {
  await db.update(s.users).set(input).where(eq(s.users.id, user.id));
  return null;
});

/* ── Auth (plain server actions used by <form action>) ───────────────── */

export async function login(_prev: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000).ok) return { error: "Too many attempts. Take a breath and try again in a few minutes." };
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!checkCredentials(email, password)) return { error: "That didn't match. Check the email and password." };
  await createSession();
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
