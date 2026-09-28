"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { action, isoDate, slug } from "./util";
import { afterProgress, logEvent } from "@/lib/data/effects";
import { loadState } from "@/lib/data/state";

/* ── Journal ─────────────────────────────────────────────────────────── */

const field = z.string().max(6000).default("");

export const saveJournal = action(
  z.object({
    date: isoDate,
    learned: field,
    built: field,
    broke: field,
    fixed: field,
    confused: field,
    canExplain: field,
    revisit: field,
    energy: z.number().int().min(1).max(5).nullable().default(null),
  }),
  async ({ date, ...fields }, user) => {
    const existing = await db.query.journalEntries.findFirst({
      where: and(eq(s.journalEntries.userId, user.id), eq(s.journalEntries.date, date)),
    });
    await db
      .insert(s.journalEntries)
      .values({ userId: user.id, date, ...fields })
      .onConflictDoUpdate({ target: [s.journalEntries.userId, s.journalEntries.date], set: { ...fields, updatedAt: new Date() } });
    if (!existing) await logEvent(user, "journal_saved", { refType: "journal", refId: date, minutes: 10 });
    return null;
  },
);

/* ── Tasks ───────────────────────────────────────────────────────────── */

const taskInput = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  type: z.enum(["learn", "code", "build", "dsa", "review", "watch", "read", "research", "project"]),
  priority: z.enum(["p1", "p2", "p3"]).default("p2"),
  minutes: z.number().int().min(5).max(600).default(30),
  energy: z.enum(["low", "medium", "high"]).default("medium"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  skillId: z.string().max(60).nullable().default(null),
  deadline: isoDate.nullable().default(null),
  plannedFor: isoDate.nullable().default(null),
  refType: z.enum(["topic", "lab", "dsa", "project", "review"]).nullable().default(null),
  refId: z.string().max(120).nullable().default(null),
  source: z.enum(["manual", "plan", "mentor", "journal"]).default("manual"),
});

export const addTask = action(taskInput, async (input, user) => {
  const [row] = await db.insert(s.tasks).values({ ...input, userId: user.id }).returning({ id: s.tasks.id });
  return { id: row.id };
});

export const setTaskStatus = action(
  z.object({ id: z.number().int().positive(), status: z.enum(["todo", "doing", "done", "dropped"]) }),
  async ({ id, status }, user) => {
    const task = await db.query.tasks.findFirst({ where: and(eq(s.tasks.id, id), eq(s.tasks.userId, user.id)) });
    if (!task) throw new Error("Task not found");
    await db
      .update(s.tasks)
      .set({ status, completedAt: status === "done" ? new Date() : null })
      .where(eq(s.tasks.id, id));
    if (status === "done" && task.status !== "done") await logEvent(user, "task_done", { refType: "task", refId: String(id), minutes: task.minutes });
    return null;
  },
);

export const deleteTask = action(z.object({ id: z.number().int().positive() }), async ({ id }, user) => {
  await db.delete(s.tasks).where(and(eq(s.tasks.id, id), eq(s.tasks.userId, user.id)));
  return null;
});

/* ── Focus sessions ──────────────────────────────────────────────────── */

export const startFocus = action(
  z.object({
    title: z.string().min(1).max(200),
    mission: z.string().max(1000).nullable().default(null),
    refType: z.string().max(20).nullable().default(null),
    refId: z.string().max(120).nullable().default(null),
    plannedMinutes: z.number().int().min(5).max(240),
  }),
  async (input, user) => {
    const [row] = await db.insert(s.focusSessions).values({ ...input, userId: user.id }).returning({ id: s.focusSessions.id });
    return { id: row.id };
  },
);

export const finishFocus = action(
  z.object({
    id: z.number().int().positive(),
    actualMinutes: z.number().int().min(0).max(600),
    learned: z.string().max(4000).default(""),
    wentWrong: z.string().max(4000).default(""),
    confidence: z.number().int().min(1).max(5).nullable().default(null),
  }),
  async ({ id, ...rest }, user) => {
    const before = await loadState({ ...user });
    const session = await db.query.focusSessions.findFirst({ where: and(eq(s.focusSessions.id, id), eq(s.focusSessions.userId, user.id)) });
    if (!session) throw new Error("Session not found");
    await db
      .update(s.focusSessions)
      .set({ ...rest, learned: rest.learned || null, wentWrong: rest.wentWrong || null, endedAt: new Date() })
      .where(eq(s.focusSessions.id, id));
    if (session.refType === "topic" && session.refId && rest.confidence) {
      await db
        .update(s.topicProgress)
        .set({ confidence: rest.confidence })
        .where(and(eq(s.topicProgress.userId, user.id), eq(s.topicProgress.topicId, session.refId)));
    }
    if (rest.actualMinutes > 0) {
      await logEvent(user, "focus_done", { refType: session.refType ?? undefined, refId: session.refId ?? undefined, minutes: rest.actualMinutes });
    }
    // A reflection with something that broke is exactly what the journal is for.
    if (rest.learned || rest.wentWrong) {
      const today = (await import("@/lib/engine/dates")).todayISO(user.timezone);
      const entry = await db.query.journalEntries.findFirst({ where: and(eq(s.journalEntries.userId, user.id), eq(s.journalEntries.date, today)) });
      const append = (a: string, b: string) => (b ? (a ? `${a}\n${b}` : b) : a);
      const tag = `[${session.title}] `;
      await db
        .insert(s.journalEntries)
        .values({ userId: user.id, date: today, learned: rest.learned ? tag + rest.learned : "", broke: rest.wentWrong ? tag + rest.wentWrong : "" })
        .onConflictDoUpdate({
          target: [s.journalEntries.userId, s.journalEntries.date],
          set: {
            learned: append(entry?.learned ?? "", rest.learned ? tag + rest.learned : ""),
            broke: append(entry?.broke ?? "", rest.wentWrong ? tag + rest.wentWrong : ""),
            updatedAt: new Date(),
          },
        });
    }
    return afterProgress(user, before);
  },
);

/* ── Videos ──────────────────────────────────────────────────────────── */

export const videoFeedback = action(
  z.object({ videoId: z.number().int().positive(), watched: z.boolean().optional(), rating: z.enum(["useful", "not_useful"]).nullable().optional() }),
  async ({ videoId, watched, rating }, user) => {
    const existing = await db.query.videoFeedback.findFirst({
      where: and(eq(s.videoFeedback.userId, user.id), eq(s.videoFeedback.videoId, videoId)),
    });
    const next = {
      watched: watched ?? existing?.watched ?? false,
      rating: rating === undefined ? existing?.rating ?? null : rating,
    };
    await db
      .insert(s.videoFeedback)
      .values({ userId: user.id, videoId, ...next })
      .onConflictDoUpdate({ target: [s.videoFeedback.userId, s.videoFeedback.videoId], set: { ...next, updatedAt: new Date() } });
    if (watched && !existing?.watched) await logEvent(user, "video_watched", { refType: "video", refId: String(videoId) });
    return next;
  },
);

/* ── Projects ────────────────────────────────────────────────────────── */

export const updateProject = action(
  z.object({
    id: slug,
    status: z.enum(["shipped", "building", "concept", "planned"]).optional(),
    skillEvidence: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
    bugs: z.array(z.string().max(500)).max(50).optional(),
    decisions: z.array(z.string().max(1000)).max(50).optional(),
    learningOutcomes: z.array(z.string().max(500)).max(50).optional(),
    milestones: z.array(z.object({ title: z.string().max(200), month: z.number().int().optional(), done: z.boolean().optional() })).max(30).optional(),
    improvements: z
      .array(z.object({ title: z.string().max(200), why: z.string().max(500), skill: z.string().max(60), done: z.boolean().optional() }))
      .max(30)
      .optional(),
    showcase: z.boolean().optional(),
  }),
  async ({ id, ...patch }, user) => {
    const before = await loadState({ ...user });
    const project = await db.query.projects.findFirst({ where: and(eq(s.projects.id, id), eq(s.projects.userId, user.id)) });
    if (!project) throw new Error("Project not found");
    const shippedAt = patch.status === "shipped" && project.status !== "shipped" ? new Date() : project.shippedAt;
    await db.update(s.projects).set({ ...patch, shippedAt, updatedAt: new Date() }).where(eq(s.projects.id, id));
    return afterProgress(user, before);
  },
);
