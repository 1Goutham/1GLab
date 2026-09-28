/**
 * Evidence-based skill scoring. No single "87% complete" number: every skill
 * is measured on six dimensions, each backed by something real.
 *
 *   knowledge       — topic levels reached (1..5)
 *   implementation  — mini tasks + labs completed
 *   projects        — what shipped projects actually demonstrate
 *   problemSolving  — DSA pattern mastery (DSA skills) / implement reviews
 *   explanation     — explain + interview reviews passed
 *   retention       — review pass rate, minus overdue reviews
 *
 * A self-reported baseline fills in until there is enough evidence.
 */

export type Dimension = "knowledge" | "implementation" | "projects" | "problemSolving" | "explanation" | "retention";
export const DIMENSIONS: { id: Dimension; label: string; weight: number }[] = [
  { id: "knowledge", label: "Knowledge", weight: 0.22 },
  { id: "implementation", label: "Implementation", weight: 0.26 },
  { id: "projects", label: "Projects", weight: 0.14 },
  { id: "problemSolving", label: "Problem solving", weight: 0.14 },
  { id: "explanation", label: "Explanation", weight: 0.12 },
  { id: "retention", label: "Retention", weight: 0.12 },
];

export type SkillInput = { id: string; name: string; categoryId: string; parentId: string | null; baseline: number };
export type TopicInput = { id: string; title: string; skillIds: string[]; week: number };
export type TopicProgressInput = { topicId: string; levelReached: number; miniTaskDone: boolean; status: string };
export type LabInput = { id: string; title: string; skillIds: string[]; week: number };
export type LabProgressInput = { labId: string; status: string };
export type ReviewInput = {
  itemType: "topic" | "dsa";
  itemId: string;
  kind: string;
  result: "pass" | "partial" | "fail" | null;
  completed: boolean;
  overdue: boolean;
};

export type SkillScore = {
  id: string;
  name: string;
  categoryId: string;
  parentId: string | null;
  dims: Record<Dimension, number | null>;
  overall: number;
  baseline: number;
  /** 0..1 — how much of `overall` is backed by evidence rather than baseline. */
  evidence: number;
  selfReported: boolean;
};

const RESULT_SCORE = { pass: 100, partial: 55, fail: 0 } as const;

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function scoreSkills(input: {
  skills: SkillInput[];
  topics: TopicInput[];
  topicProgress: TopicProgressInput[];
  labs: LabInput[];
  labProgress: LabProgressInput[];
  projectEvidence: Record<string, number>[];
  /** DSA pattern mastery 0-100 keyed by pattern id (== DSA skill id). */
  dsaMastery: Record<string, number>;
  reviews: ReviewInput[];
}): Map<string, SkillScore> {
  const tp = new Map(input.topicProgress.map((p) => [p.topicId, p]));
  const lp = new Map(input.labProgress.map((p) => [p.labId, p]));
  const topicSkills = new Map(input.topics.map((t) => [t.id, t.skillIds]));
  const out = new Map<string, SkillScore>();

  for (const s of input.skills) {
    const ts = input.topics.filter((t) => t.skillIds.includes(s.id));
    const ls = input.labs.filter((l) => l.skillIds.includes(s.id));

    const touchedTopics = ts.filter((t) => (tp.get(t.id)?.levelReached ?? 0) > 0);
    const knowledge = ts.length ? (100 * ts.reduce((a, t) => a + (tp.get(t.id)?.levelReached ?? 0), 0)) / (5 * ts.length) : null;

    const implUnits = ts.length + 2 * ls.length;
    const implDone =
      ts.filter((t) => tp.get(t.id)?.miniTaskDone).length + 2 * ls.filter((l) => lp.get(l.id)?.status === "completed").length;
    const implementation = implUnits ? (100 * implDone) / implUnits : null;

    const projVals = input.projectEvidence.map((e) => e[s.id]).filter((v): v is number => typeof v === "number");
    const projects = projVals.length ? Math.max(...projVals) : null;

    const skillReviews = input.reviews.filter((r) =>
      r.itemType === "topic" ? topicSkills.get(r.itemId)?.includes(s.id) : r.itemId === s.id,
    );
    const done = skillReviews.filter((r) => r.completed && r.result);
    const explanation = avg(
      done.filter((r) => r.kind === "explain" || r.kind === "interview").map((r) => RESULT_SCORE[r.result!]),
    );
    const implementReviews = avg(done.filter((r) => r.kind === "implement").map((r) => RESULT_SCORE[r.result!]));
    const problemSolving = s.id in input.dsaMastery ? input.dsaMastery[s.id] : implementReviews;

    const overdue = skillReviews.filter((r) => !r.completed && r.overdue).length;
    const passRate = avg(done.map((r) => RESULT_SCORE[r.result!]));
    const retention = passRate === null ? (overdue ? Math.max(0, 60 - overdue * 15) : null) : Math.max(0, passRate - overdue * 10);

    const dims: Record<Dimension, number | null> = {
      knowledge: knowledge === null ? null : Math.round(knowledge),
      implementation: implementation === null ? null : Math.round(implementation),
      projects: projects === null ? null : Math.round(projects),
      problemSolving: problemSolving === null ? null : Math.round(problemSolving),
      explanation: explanation === null ? null : Math.round(explanation),
      retention: retention === null ? null : Math.round(retention),
    };

    // Evidence strength: topics touched, labs finished, reviews done, DSA attempts, project evidence.
    const evidenceUnits =
      touchedTopics.length +
      ls.filter((l) => lp.get(l.id)?.status === "completed").length * 2 +
      done.length +
      (s.id in input.dsaMastery && input.dsaMastery[s.id] > 0 ? 2 : 0) +
      (projVals.length ? 1 : 0);
    const evidence = Math.min(1, evidenceUnits / 4);

    let wsum = 0;
    let vsum = 0;
    for (const d of DIMENSIONS) {
      const v = dims[d.id];
      if (v === null) continue;
      // Knowledge and implementation of untouched topics count as real zeros only once work has started.
      wsum += d.weight;
      vsum += d.weight * v;
    }
    const evidenceScore = wsum ? vsum / wsum : 0;
    const overall = Math.round(s.baseline * (1 - evidence) + evidenceScore * evidence);
    out.set(s.id, {
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      parentId: s.parentId,
      dims,
      overall,
      baseline: s.baseline,
      evidence,
      selfReported: evidence < 0.25,
    });
  }
  return out;
}

export function categoryScores(scores: Map<string, SkillScore>) {
  const byCat = new Map<string, number[]>();
  for (const s of scores.values()) {
    const arr = byCat.get(s.categoryId) ?? [];
    arr.push(s.overall);
    byCat.set(s.categoryId, arr);
  }
  const out: Record<string, number> = {};
  for (const [k, v] of byCat) out[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  return out;
}

/** The weakest dimension of the weakest in-focus skill, phrased as an action. */
export function nextWeakness(
  scores: Map<string, SkillScore>,
  focusSkillIds: string[],
): { skill: SkillScore; dimension: Dimension } | null {
  const candidates = focusSkillIds.map((id) => scores.get(id)).filter((s): s is SkillScore => !!s);
  if (!candidates.length) return null;
  let best: { skill: SkillScore; dimension: Dimension; value: number } | null = null;
  for (const s of candidates) {
    for (const d of DIMENSIONS) {
      const v = s.dims[d.id];
      if (v === null) continue;
      if (!best || v < best.value) best = { skill: s, dimension: d.id, value: v };
    }
  }
  return best ? { skill: best.skill, dimension: best.dimension } : null;
}

/** Engineering map rows shown on Home. */
export const ENGINEERING_MAP: { label: string; categories: string[]; domain: string }[] = [
  { label: "AI", categories: ["ai-depth", "ai-systems"], domain: "ai" },
  { label: "DSA", categories: ["dsa"], domain: "dsa" },
  { label: "Backend", categories: ["advanced-dev"], domain: "backend" },
  { label: "Systems", categories: ["system-design"], domain: "systems" },
  { label: "Product", categories: ["product-eng"], domain: "frontend" },
  { label: "Cloud", categories: ["cloud-devops"], domain: "cloud" },
  { label: "Security", categories: ["security"], domain: "security" },
];

export function readinessBand(score: number): "Beginner" | "Working" | "Strong" | "Advanced" {
  if (score >= 80) return "Advanced";
  if (score >= 60) return "Strong";
  if (score >= 35) return "Working";
  return "Beginner";
}
