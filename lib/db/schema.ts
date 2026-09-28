import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  real,
  serial,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { CodeExample, LessonContent } from "@/content/types";

/* ────────────────────────────────────────────────────────────────────────
 * Enums
 * ──────────────────────────────────────────────────────────────────────── */

export const domainEnum = pgEnum("domain", ["ai", "dsa", "backend", "frontend", "systems", "cloud", "security", "product"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
export const topicStatusEnum = pgEnum("topic_status", ["not_started", "learning", "practised", "completed"]);
export const labStatusEnum = pgEnum("lab_status", ["not_started", "in_progress", "completed"]);
export const taskTypeEnum = pgEnum("task_type", ["learn", "code", "build", "dsa", "review", "watch", "read", "research", "project"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "doing", "done", "dropped"]);
export const energyEnum = pgEnum("energy", ["low", "medium", "high"]);
export const priorityEnum = pgEnum("priority", ["p1", "p2", "p3"]);
export const reviewKindEnum = pgEnum("review_kind", ["quiz", "explain", "implement", "interview", "resolve"]);
export const mistakeEnum = pgEnum("mistake_type", [
  "pattern",
  "logic",
  "syntax",
  "edge_case",
  "complexity",
  "misread",
  "forgot",
]);
export const mentorModeEnum = pgEnum("mentor_mode", ["explain", "socratic", "interview", "debug", "review", "challenge", "career"]);

/* ────────────────────────────────────────────────────────────────────────
 * User
 * ──────────────────────────────────────────────────────────────────────── */

export type UserPrefs = {
  preferredLanguage?: "python" | "typescript";
  showBaseline?: boolean;
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  headline: text("headline").notNull().default("Advanced AI Engineer"),
  startDate: date("start_date").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  dailyMinutes: integer("daily_minutes").notNull().default(150),
  currentLevel: text("current_level").notNull().default("Full-stack developer moving into AI engineering"),
  mainGoal: text("main_goal").notNull().default("Become an advanced AI engineer who can design, build, evaluate and ship AI systems."),
  currentProjects: text("current_projects").notNull().default(""),
  dsaConfidence: integer("dsa_confidence").notNull().default(2),
  aiConfidence: integer("ai_confidence").notNull().default(3),
  onboarded: boolean("onboarded").notNull().default(false),
  showcasePublic: boolean("showcase_public").notNull().default(false),
  prefs: jsonb("prefs").$type<UserPrefs>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Skills
 * ──────────────────────────────────────────────────────────────────────── */

export const skillCategories = pgTable("skill_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: domainEnum("domain").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
});

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: text("category_id").notNull().references(() => skillCategories.id),
  parentId: text("parent_id"),
  isGroup: boolean("is_group").notNull().default(false),
  baseline: integer("baseline").notNull().default(0),
  order: integer("order").notNull(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Curriculum
 * ──────────────────────────────────────────────────────────────────────── */

export const learningPaths = pgTable("learning_paths", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  months: integer("months").notNull(),
});

export type FlagshipMilestone = { title: string; detail: string; deliverables: string[] };

export const modules = pgTable("modules", {
  id: text("id").primaryKey(),
  pathId: text("path_id").notNull().references(() => learningPaths.id),
  month: integer("month").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  levelTitle: text("level_title").notNull(),
  domain: domainEnum("domain").notNull(),
  outcomes: jsonb("outcomes").$type<string[]>().notNull(),
  flagship: jsonb("flagship").$type<FlagshipMilestone>().notNull(),
  status: contentStatusEnum("status").notNull().default("published"),
});

export const weeks = pgTable("weeks", {
  week: integer("week").primaryKey(),
  moduleId: text("module_id").notNull().references(() => modules.id),
  title: text("title").notNull(),
  focus: text("focus").notNull(),
  goals: jsonb("goals").$type<string[]>().notNull(),
  dsaPattern: text("dsa_pattern").notNull(),
});

export const topics = pgTable(
  "topics",
  {
    id: text("id").primaryKey(), // slug
    moduleId: text("module_id").notNull().references(() => modules.id),
    week: integer("week").notNull(),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    domain: domainEnum("domain").notNull(),
    skillIds: jsonb("skill_ids").$type<string[]>().notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    minutes: integer("minutes").notNull(),
    summary: text("summary").notNull(),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: contentStatusEnum("status").notNull().default("published"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("topics_week_idx").on(t.week, t.order)],
);

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .unique()
    .references(() => topics.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<LessonContent>().notNull(),
  version: integer("version").notNull().default(1),
});

export type LabStep = { title: string; detail: string };

export const labs = pgTable("labs", {
  id: text("id").primaryKey(), // slug
  moduleId: text("module_id").notNull().references(() => modules.id),
  week: integer("week").notNull(),
  title: text("title").notNull(),
  duration: text("duration").notNull(),
  minutes: integer("minutes").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  domain: domainEnum("domain").notNull(),
  skillIds: jsonb("skill_ids").$type<string[]>().notNull(),
  topicIds: jsonb("topic_ids").$type<string[]>().notNull(),
  prerequisites: jsonb("prerequisites").$type<string[]>().notNull(),
  objective: text("objective").notNull(),
  expectedOutput: text("expected_output").notNull(),
  steps: jsonb("steps").$type<LabStep[]>().notNull(),
  hints: jsonb("hints").$type<string[]>().notNull(),
  stretch: text("stretch").notNull(),
  learned: jsonb("learned").$type<string[]>().notNull(),
  starter: jsonb("starter").$type<CodeExample | null>(),
  isFlagship: boolean("is_flagship").notNull().default(false),
  status: contentStatusEnum("status").notNull().default("published"),
});

export const videoResources = pgTable(
  "video_resources",
  {
    id: serial("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    channel: text("channel").notNull(),
    url: text("url").notNull(),
    kind: text("kind").$type<"video" | "search">().notNull(),
    minutes: integer("minutes"),
    reason: text("reason").notNull(),
    source: text("source").$type<"curated" | "youtube_api">().notNull().default("curated"),
  },
  (t) => [uniqueIndex("video_topic_url_idx").on(t.topicId, t.url)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Learner progress
 * ──────────────────────────────────────────────────────────────────────── */

export const topicProgress = pgTable(
  "topic_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    status: topicStatusEnum("status").notNull().default("not_started"),
    levelReached: integer("level_reached").notNull().default(0),
    miniTaskChecks: jsonb("mini_task_checks").$type<number[]>().notNull().default([]),
    miniTaskDone: boolean("mini_task_done").notNull().default(false),
    confidence: integer("confidence"),
    reflection: text("reflection"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

export const labProgress = pgTable(
  "lab_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    labId: text("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "cascade" }),
    status: labStatusEnum("status").notNull().default("not_started"),
    stepsDone: jsonb("steps_done").$type<number[]>().notNull().default([]),
    hintsUsed: integer("hints_used").notNull().default(0),
    repoUrl: text("repo_url"),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.labId] })],
);

/* ────────────────────────────────────────────────────────────────────────
 * DSA
 * ──────────────────────────────────────────────────────────────────────── */

export const dsaProblems = pgTable(
  "dsa_problems",
  {
    id: text("id").primaryKey(), // leetcode slug
    title: text("title").notNull(),
    pattern: text("pattern").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    minutes: integer("minutes").notNull(),
    freq: integer("freq").notNull(),
    hint: text("hint").notNull(),
    url: text("url").notNull(),
    order: integer("order").notNull(),
  },
  (t) => [index("dsa_pattern_idx").on(t.pattern)],
);

export const dsaAttempts = pgTable(
  "dsa_attempts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => dsaProblems.id, { onDelete: "cascade" }),
    solved: boolean("solved").notNull(),
    minutes: integer("minutes").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
    solutionViewed: boolean("solution_viewed").notNull().default(false),
    confidence: integer("confidence").notNull(),
    mistake: mistakeEnum("mistake"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dsa_attempt_user_idx").on(t.userId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Reviews (spaced repetition for topics and DSA problems)
 * ──────────────────────────────────────────────────────────────────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"topic" | "dsa">().notNull(),
    itemId: text("item_id").notNull(),
    stage: integer("stage").notNull(),
    kind: reviewKindEnum("kind").notNull(),
    dueAt: date("due_at").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    result: text("result").$type<"pass" | "partial" | "fail">(),
    response: text("response"),
  },
  (t) => [index("reviews_due_idx").on(t.userId, t.dueAt)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Tasks, focus, journal, notes
 * ──────────────────────────────────────────────────────────────────────── */

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: taskTypeEnum("type").notNull(),
    priority: priorityEnum("priority").notNull().default("p2"),
    minutes: integer("minutes").notNull().default(30),
    skillId: text("skill_id"),
    difficulty: difficultyEnum("difficulty").notNull().default("medium"),
    energy: energyEnum("energy").notNull().default("medium"),
    deadline: date("deadline"),
    plannedFor: date("planned_for"),
    status: taskStatusEnum("status").notNull().default("todo"),
    refType: text("ref_type").$type<"topic" | "lab" | "dsa" | "project" | "review">(),
    refId: text("ref_id"),
    source: text("source").$type<"manual" | "plan" | "mentor" | "journal">().notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("tasks_user_idx").on(t.userId, t.status)],
);

export const focusSessions = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  mission: text("mission"),
  refType: text("ref_type"),
  refId: text("ref_id"),
  plannedMinutes: integer("planned_minutes").notNull(),
  actualMinutes: integer("actual_minutes"),
  learned: text("learned"),
  wentWrong: text("went_wrong"),
  confidence: integer("confidence"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    learned: text("learned").notNull().default(""),
    built: text("built").notNull().default(""),
    broke: text("broke").notNull().default(""),
    fixed: text("fixed").notNull().default(""),
    confused: text("confused").notNull().default(""),
    canExplain: text("can_explain").notNull().default(""),
    revisit: text("revisit").notNull().default(""),
    energy: integer("energy"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journal_user_date_idx").on(t.userId, t.date)],
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Projects
 * ──────────────────────────────────────────────────────────────────────── */

export type ProjectImprovement = { title: string; why: string; skill: string; done?: boolean };
export type ProjectMilestone = { title: string; month?: number; done?: boolean };

export const projects = pgTable("projects", {
  id: text("id").primaryKey(), // slug
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  status: text("status").$type<"shipped" | "building" | "concept" | "planned">().notNull(),
  isFlagship: boolean("is_flagship").notNull().default(false),
  year: integer("year"),
  technologies: jsonb("technologies").$type<string[]>().notNull(),
  github: text("github"),
  live: text("live"),
  architecture: text("architecture").notNull().default(""),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  skillEvidence: jsonb("skill_evidence").$type<Record<string, number>>().notNull().default({}),
  learningOutcomes: jsonb("learning_outcomes").$type<string[]>().notNull().default([]),
  decisions: jsonb("decisions").$type<string[]>().notNull().default([]),
  bugs: jsonb("bugs").$type<string[]>().notNull().default([]),
  improvements: jsonb("improvements").$type<ProjectImprovement[]>().notNull().default([]),
  milestones: jsonb("milestones").$type<ProjectMilestone[]>().notNull().default([]),
  screenshots: jsonb("screenshots").$type<string[]>().notNull().default([]),
  showcase: boolean("showcase").notNull().default(true),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Videos feedback, achievements, snapshots, analytics
 * ──────────────────────────────────────────────────────────────────────── */

export const videoFeedback = pgTable(
  "video_feedback",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videoResources.id, { onDelete: "cascade" }),
    watched: boolean("watched").notNull().default(false),
    rating: text("rating").$type<"useful" | "not_useful">(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rule: jsonb("rule").notNull(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

export const progressSnapshots = pgTable(
  "progress_snapshots",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** categoryId → overall score 0-100 */
    categories: jsonb("categories").$type<Record<string, number>>().notNull(),
    /** skillId → overall score 0-100 (leaves only) */
    skills: jsonb("skills").$type<Record<string, number>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export type ActivityType =
  | "topic_started"
  | "topic_level"
  | "mini_task_done"
  | "topic_completed"
  | "lab_started"
  | "lab_step"
  | "lab_completed"
  | "dsa_attempt"
  | "review_done"
  | "focus_done"
  | "journal_saved"
  | "video_watched"
  | "task_done"
  | "mentor_message"
  | "level_up";

export const activityEvents = pgTable(
  "activity_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<ActivityType>().notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    minutes: real("minutes"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_user_day_idx").on(t.userId, t.day)],
);

export type WeekPlanDay = {
  date: string;
  items: { title: string; type: string; minutes: number; energy: "low" | "medium" | "high"; refType?: string; refId?: string }[];
};

export const weekPlans = pgTable(
  "week_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    rationale: text("rationale").notNull(),
    days: jsonb("days").$type<WeekPlanDay[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("week_plan_user_week_idx").on(t.userId, t.weekStart)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Mentor
 * ──────────────────────────────────────────────────────────────────────── */

export const mentorConversations = pgTable("mentor_conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: mentorModeEnum("mode").notNull(),
  title: text("title").notNull(),
  topicId: text("topic_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mentorMessages = pgTable(
  "mentor_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => mentorConversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    provider: text("provider"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mentor_msg_conv_idx").on(t.conversationId, t.createdAt)],
);

