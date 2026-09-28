/**
 * Seeds the curriculum and Goutham's starting state.
 *
 *   npm run db:seed          upsert content; create the user + projects if missing
 *   npm run db:seed -- --reset   also wipe all learner progress (asks no questions)
 *
 * Content rows are upserted, so re-running after editing `content/` updates
 * lessons in place without touching progress.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, getTableColumns, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "../lib/db/schema";
import { SKILLS, SKILL_CATEGORIES } from "../content/skills";
import { CURRICULUM, LEARNING_PATH } from "../content/curriculum";
import { DSA_PATTERNS, DSA_PROBLEMS, leetcodeUrl } from "../content/dsa";
import { PROJECTS } from "../content/projects";
import { ACHIEVEMENTS } from "../content/achievements";
import { todayISO } from "../lib/engine/dates";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { prepare: false, max: 1 });
const db = drizzle(client, { schema: s });

function excludedSet<T extends PgTable>(table: T, skip: string[]) {
  const cols = getTableColumns(table);
  const set: Record<string, SQL> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (skip.includes(key)) continue;
    set[key] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

async function upsert<T extends PgTable>(table: T, rows: T["$inferInsert"][], target: any, skip: string[] = []) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(table)
      .values(rows.slice(i, i + 200) as any)
      .onConflictDoUpdate({ target, set: excludedSet(table, skip) as any });
  }
}

function validate() {
  const errors: string[] = [];
  const skillIds = new Set<string>(SKILLS.map((x) => x.id));
  const leafIds = new Set<string>(SKILLS.filter((x) => "parent" in x).map((x) => x.id));
  const patternIds = new Set<string>(DSA_PATTERNS.map((p) => p.id));
  const topicIds = new Set<string>();
  const labIds = new Set<string>();
  for (const m of CURRICULUM) {
    for (const w of m.weeks) if (!patternIds.has(w.dsaPattern)) errors.push(`week ${w.week}: unknown DSA pattern ${w.dsaPattern}`);
    for (const t of m.topics) {
      if (topicIds.has(t.slug)) errors.push(`duplicate topic ${t.slug}`);
      topicIds.add(t.slug);
      for (const sk of t.skills) if (!leafIds.has(sk)) errors.push(`topic ${t.slug}: ${sk} is not a leaf skill`);
      if (!m.weeks.some((w) => w.week === t.week)) errors.push(`topic ${t.slug}: week ${t.week} not in month ${m.month}`);
    }
  }
  for (const m of CURRICULUM) {
    for (const l of m.labs) {
      if (labIds.has(l.slug)) errors.push(`duplicate lab ${l.slug}`);
      labIds.add(l.slug);
      for (const sk of l.skills) if (!skillIds.has(sk)) errors.push(`lab ${l.slug}: unknown skill ${sk}`);
      for (const t of l.topicSlugs) if (!topicIds.has(t)) errors.push(`lab ${l.slug}: unknown topic ${t}`);
    }
  }
  for (const p of PROJECTS) for (const k of Object.keys(p.skillEvidence)) if (!skillIds.has(k)) errors.push(`project ${p.slug}: unknown skill ${k}`);
  if (errors.length) {
    console.error("Content validation failed:\n  " + errors.join("\n  "));
    process.exit(1);
  }
}

async function main() {
  validate();
  const reset = process.argv.includes("--reset");

  if (reset) {
    console.log("• wiping learner data");
    await db.execute(sql`TRUNCATE users, projects RESTART IDENTITY CASCADE`);
  }

  console.log("• skills");
  await upsert(
    s.skillCategories,
    SKILL_CATEGORIES.map((c, i) => ({ ...c, order: i })),
    s.skillCategories.id,
  );
  await upsert(
    s.skills,
    SKILLS.map((k, i) => ({
      id: k.id,
      name: k.name,
      categoryId: k.category,
      parentId: "parent" in k ? k.parent : null,
      isGroup: "group" in k ? Boolean(k.group) : false,
      baseline: "baseline" in k ? k.baseline : 0,
      order: i,
    })),
    s.skills.id,
  );

  console.log("• curriculum");
  await upsert(s.learningPaths, [LEARNING_PATH], s.learningPaths.id);
  for (const m of CURRICULUM) {
    await upsert(
      s.modules,
      [
        {
          id: m.slug,
          pathId: LEARNING_PATH.id,
          month: m.month,
          title: m.title,
          subtitle: m.subtitle,
          levelTitle: m.levelTitle,
          domain: m.domain,
          outcomes: m.outcomes,
          flagship: m.flagshipMilestone,
        },
      ],
      s.modules.id,
    );
    await upsert(
      s.weeks,
      m.weeks.map((w) => ({ week: w.week, moduleId: m.slug, title: w.title, focus: w.focus, goals: w.goals, dsaPattern: w.dsaPattern })),
      s.weeks.week,
    );
    const order = new Map<number, number>();
    await upsert(
      s.topics,
      m.topics.map((t) => {
        const o = order.get(t.week) ?? 0;
        order.set(t.week, o + 1);
        return {
          id: t.slug,
          moduleId: m.slug,
          week: t.week,
          order: o,
          title: t.title,
          domain: t.domain,
          skillIds: [...t.skills],
          difficulty: t.difficulty,
          minutes: t.minutes,
          summary: t.summary,
          prerequisites: t.prerequisites ?? [],
          tags: t.tags,
          updatedAt: new Date(),
        };
      }),
      s.topics.id,
    );
    await upsert(
      s.lessons,
      m.topics.map((t) => ({ topicId: t.slug, content: t.lesson })),
      s.lessons.topicId,
      ["id"],
    );
    for (const t of m.topics) {
      if (!t.lesson.videos.length) continue;
      await upsert(
        s.videoResources,
        t.lesson.videos.map((v) => ({
          topicId: t.slug,
          title: v.title,
          channel: v.channel,
          url: v.url,
          kind: v.kind,
          minutes: v.minutes ?? null,
          reason: v.reason,
          source: "curated" as const,
        })),
        [s.videoResources.topicId, s.videoResources.url],
        ["id"],
      );
    }
    await upsert(
      s.labs,
      m.labs.map((l) => ({
        id: l.slug,
        moduleId: m.slug,
        week: l.week,
        title: l.title,
        duration: l.duration,
        minutes: l.minutes,
        difficulty: l.difficulty,
        domain: l.domain,
        skillIds: [...l.skills],
        topicIds: l.topicSlugs,
        prerequisites: l.prerequisites,
        objective: l.objective,
        expectedOutput: l.expectedOutput,
        steps: l.steps,
        hints: l.hints,
        stretch: l.stretch,
        learned: l.learned,
        starter: l.starter ?? null,
        isFlagship: l.slug.startsWith("flagship"),
      })),
      s.labs.id,
    );
  }

  console.log("• DSA problems");
  await upsert(
    s.dsaProblems,
    DSA_PROBLEMS.map((p, i) => ({ id: p.slug, title: p.title, pattern: p.pattern, difficulty: p.difficulty, minutes: p.minutes, freq: p.freq, hint: p.hint, url: leetcodeUrl(p.slug), order: i })),
    s.dsaProblems.id,
  );

  console.log("• achievements");
  await upsert(s.achievements, ACHIEVEMENTS.map((a) => ({ ...a, rule: a.rule })), s.achievements.id);

  console.log("• user");
  const owner = {
    id: "goutham",
    name: "Goutham",
    email: (process.env.OWNER_EMAIL || "gouthamgopinath.tsi@gmail.com").toLowerCase(),
    startDate: process.env.PROGRAM_START_DATE || todayISO(),
    currentProjects: "IdeaGuard AI, ZtudyLock, Ideako, FabricNest; exploring WebNav AI",
  };
  await db.insert(s.users).values(owner).onConflictDoNothing();

  console.log("• projects");
  await db
    .insert(s.projects)
    .values(
      PROJECTS.map((p) => ({
        id: p.slug,
        userId: owner.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        status: p.status,
        isFlagship: Boolean(p.flagship),
        year: p.year ?? null,
        technologies: p.technologies,
        github: p.github ?? null,
        live: p.live ?? null,
        architecture: p.architecture,
        features: p.features,
        skillEvidence: p.skillEvidence as Record<string, number>,
        learningOutcomes: p.learningOutcomes,
        decisions: p.decisions,
        bugs: p.bugs,
        improvements: p.improvements,
        milestones: p.milestones,
      })),
    )
    .onConflictDoNothing();

  const counts = await db.execute<{ t: number; l: number; d: number }>(
    sql`select (select count(*) from topics)::int as t, (select count(*) from labs)::int as l, (select count(*) from dsa_problems)::int as d`,
  );
  console.log(`✓ seeded ${counts[0].t} topics, ${counts[0].l} labs, ${counts[0].d} DSA problems`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
