import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getUserOrThrow, UnauthorizedError } from "@/lib/auth";

export type SearchHit = { type: string; title: string; subtitle: string; href: string };

/**
 * Global search across the OS. Curriculum and personal data are searched in
 * parallel with ILIKE — at this scale (hundreds of rows) Postgres answers in a
 * couple of milliseconds, so no search index is needed yet.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await getUserOrThrow();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (q.length < 2) return Response.json({ hits: [] });
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;

  const [topics, labs, problems, projects, notes, journal, tasks, videos] = await Promise.all([
    db
      .select({ id: s.topics.id, title: s.topics.title, summary: s.topics.summary, week: s.topics.week })
      .from(s.topics)
      .where(or(ilike(s.topics.title, like), ilike(s.topics.summary, like), sql`${s.topics.tags}::text ilike ${like}`))
      .limit(8),
    db.select({ id: s.labs.id, title: s.labs.title, duration: s.labs.duration }).from(s.labs).where(or(ilike(s.labs.title, like), ilike(s.labs.objective, like))).limit(5),
    db
      .select({ id: s.dsaProblems.id, title: s.dsaProblems.title, pattern: s.dsaProblems.pattern, difficulty: s.dsaProblems.difficulty })
      .from(s.dsaProblems)
      .where(or(ilike(s.dsaProblems.title, like), ilike(s.dsaProblems.pattern, like)))
      .limit(6),
    db
      .select({ id: s.projects.id, name: s.projects.name, tagline: s.projects.tagline })
      .from(s.projects)
      .where(and(eq(s.projects.userId, user.id), or(ilike(s.projects.name, like), ilike(s.projects.description, like))))
      .limit(4),
    db
      .select({ id: s.notes.id, title: s.notes.title, topicId: s.notes.topicId })
      .from(s.notes)
      .where(and(eq(s.notes.userId, user.id), or(ilike(s.notes.title, like), ilike(s.notes.body, like))))
      .limit(4),
    db
      .select({ date: s.journalEntries.date })
      .from(s.journalEntries)
      .where(
        and(
          eq(s.journalEntries.userId, user.id),
          or(
            ilike(s.journalEntries.learned, like),
            ilike(s.journalEntries.built, like),
            ilike(s.journalEntries.broke, like),
            ilike(s.journalEntries.confused, like),
            ilike(s.journalEntries.revisit, like),
          ),
        ),
      )
      .limit(4),
    db
      .select({ id: s.tasks.id, title: s.tasks.title, status: s.tasks.status })
      .from(s.tasks)
      .where(and(eq(s.tasks.userId, user.id), ilike(s.tasks.title, like)))
      .limit(4),
    db
      .select({ title: s.videoResources.title, channel: s.videoResources.channel, topicId: s.videoResources.topicId })
      .from(s.videoResources)
      .where(or(ilike(s.videoResources.title, like), ilike(s.videoResources.channel, like)))
      .limit(4),
  ]);

  const hits: SearchHit[] = [
    ...topics.map((t) => ({ type: "Lesson", title: t.title, subtitle: `Week ${t.week} · ${t.summary}`, href: `/learn/${t.id}` })),
    ...labs.map((l) => ({ type: "Lab", title: l.title, subtitle: l.duration, href: `/labs/${l.id}` })),
    ...problems.map((p) => ({ type: "DSA", title: p.title, subtitle: `${p.pattern.replace(/-/g, " ")} · ${p.difficulty}`, href: `/dsa/${p.id}` })),
    ...projects.map((p) => ({ type: "Project", title: p.name, subtitle: p.tagline, href: `/projects/${p.id}` })),
    ...notes.map((n) => ({ type: "Note", title: n.title, subtitle: "Note", href: n.topicId ? `/learn/${n.topicId}#notes` : "/journal" })),
    ...journal.map((j) => ({ type: "Journal", title: `Journal — ${j.date}`, subtitle: "Engineering journal", href: `/journal?date=${j.date}` })),
    ...tasks.map((t) => ({ type: "Task", title: t.title, subtitle: t.status, href: "/tasks" })),
    ...videos.map((v) => ({ type: "Video", title: v.title, subtitle: v.channel, href: `/learn/${v.topicId}#videos` })),
  ];
  return Response.json({ hits });
}
