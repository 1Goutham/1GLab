/**
 * Content types for the curriculum seed.
 *
 * Everything the learner reads lives here as structured data and is written
 * to Postgres by `scripts/seed.ts`. UI components never import curriculum
 * directly; they read it from the database, so content can later be edited,
 * reordered, tagged or archived without touching components.
 *
 * Text fields accept light Markdown: **bold**, `inline code`, lists, links.
 * Keep paragraphs short. Separate paragraphs with a blank line.
 */
import type { SkillId } from "./skills";

export type Domain = "ai" | "dsa" | "backend" | "frontend" | "systems" | "cloud" | "security" | "product";
export type Difficulty = "easy" | "medium" | "hard";

export type DiagramNode = { label: string; note?: string; accent?: boolean };

/** Diagrams are drawn as SVG/CSS by `components/diagrams`. Pick the shape that shows the real mechanism. */
export type Diagram =
  /** One or more left-to-right pipelines. Use two lanes for before/after (tone bad/good). */
  | {
      type: "flow";
      title?: string;
      lanes: { label?: string; tone?: "bad" | "good" | "neutral"; steps: DiagramNode[] }[];
    }
  /** A loop that repeats, e.g. the agent loop or the training loop. */
  | { type: "cycle"; title?: string; center?: string; steps: DiagramNode[] }
  /** Layers from top to bottom, e.g. a transformer block or a network stack. */
  | { type: "stack"; title?: string; layers: DiagramNode[] }
  /** Two columns side by side, e.g. SQL vs NoSQL. */
  | {
      type: "compare";
      title?: string;
      left: { label: string; points: string[] };
      right: { label: string; points: string[] };
    }
  /** A small heatmap; values are 0..1. Great for attention weights or confusion matrices. */
  | {
      type: "grid";
      title?: string;
      rowLabels: string[];
      colLabels: string[];
      values: number[][];
      caption?: string;
    };

export type CodeExample = {
  title: string;
  lang: "python" | "typescript" | "javascript" | "bash" | "sql" | "json" | "yaml" | "text" | "dockerfile";
  code: string;
  /** Mark a pair of examples as the wrong way and the right way. */
  variant?: "bad" | "good";
  note?: string;
};

export type QuizQuestion = {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explain: string;
};

export type MiniTask = {
  title: string;
  /** observe = inspect something real; code = write a small snippet; build = small working thing; explain = teach it back. */
  kind: "observe" | "code" | "build" | "explain";
  minutes: number;
  steps: string[];
  /** Concrete things the learner confirms before the task counts as done. */
  checklist: string[];
  deliverable: string;
};

export type VideoSeed = {
  title: string;
  channel: string;
  /** Either a real watch URL you are certain of, or a YouTube search URL (kind: "search"). */
  url: string;
  kind: "video" | "search";
  minutes?: number;
  /** "Why watch this?" — when this video helps, in one sentence. */
  reason: string;
};

export type LessonContent = {
  /** WHY: open with a concrete situation or question, never a definition. 2-4 short paragraphs. */
  hook: string;
  /** One or two sentences: what this unlocks for an AI engineer. */
  whyItMatters: string;
  levels: {
    /** Level 1 — Explain like I'm smart but new. 2-4 sentences, no jargon. */
    l1: string;
    /** Level 2 — Mental model: analogy + diagram. */
    l2: { text: string; analogy?: string; diagram?: Diagram };
    /** Level 3 — Technical explanation with runnable code. */
    l3: { text: string; code?: CodeExample[] };
    /** Level 4 — Under the hood: how it is actually implemented. */
    l4: { text: string; code?: CodeExample[]; diagram?: Diagram };
    /** Level 5 — Interview / engineering question with a model answer. */
    l5: { question: string; hint?: string; answer: string };
  };
  commonMistakes: string[];
  tryThis?: string;
  miniTask: MiniTask;
  quiz: QuizQuestion[];
  /** Day-7 review prompt: "Explain X to a junior engineer in 5 sentences." */
  explainPrompt: string;
  /** Day-14 review prompt: a small implementation from memory. */
  implementPrompt: string;
  videos: VideoSeed[];
};

export type TopicSeed = {
  slug: string;
  title: string;
  /** Week number 1..24 (absolute). */
  week: number;
  domain: Domain;
  skills: SkillId[];
  difficulty: Difficulty;
  /** Estimated minutes to learn + do the mini task. */
  minutes: number;
  /** One line shown in lists. */
  summary: string;
  prerequisites?: string[];
  tags: string[];
  lesson: LessonContent;
};

export type LabDuration = "20m" | "45m" | "90m" | "3h" | "1d" | "weekend";

export type LabSeed = {
  slug: string;
  title: string;
  week: number;
  duration: LabDuration;
  minutes: number;
  difficulty: Difficulty;
  domain: Domain;
  skills: SkillId[];
  /** Human-readable prerequisites (may mention topic titles). */
  prerequisites: string[];
  /** Topic slugs this lab applies. */
  topicSlugs: string[];
  objective: string;
  expectedOutput: string;
  steps: { title: string; detail: string }[];
  hints: string[];
  stretch: string;
  learned: string[];
  starter?: CodeExample;
};

export type WeekSeed = {
  week: number;
  title: string;
  focus: string;
  goals: string[];
  /** DSA pattern practised this week (matches DSA pattern ids). */
  dsaPattern: string;
};

export type MonthSeed = {
  month: number;
  slug: string;
  title: string;
  subtitle: string;
  /** Title unlocked at the end of this month. */
  levelTitle: string;
  domain: Domain;
  outcomes: string[];
  /** What the flagship project gains this month. */
  flagshipMilestone: { title: string; detail: string; deliverables: string[] };
  weeks: WeekSeed[];
  topics: TopicSeed[];
  labs: LabSeed[];
};
