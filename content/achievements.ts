/**
 * Engineering milestones. Deliberately few, deliberately earned. The
 * `rule` is evaluated by `lib/engine/achievements.ts` against real activity.
 */
export type AchievementSeed = {
  id: string;
  title: string;
  description: string;
  rule:
    | { kind: "dsa_solved"; count: number }
    | { kind: "streak"; days: number }
    | { kind: "lab_completed"; slug?: string; count?: number }
    | { kind: "topics_completed"; count: number }
    | { kind: "project_shipped" }
    | { kind: "explain_passed"; count: number }
    | { kind: "journal_fixes"; count: number }
    | { kind: "focus_hours"; hours: number };
};

export const ACHIEVEMENTS: AchievementSeed[] = [
  { id: "first-concept", title: "First concept, done properly", description: "Learned, practised and reflected on a topic end to end.", rule: { kind: "topics_completed", count: 1 } },
  { id: "first-production-api", title: "First Production API", description: "Shipped a FastAPI service backed by Postgres.", rule: { kind: "lab_completed", slug: "fastapi-notes-api" } },
  { id: "built-from-scratch", title: "Built From Scratch", description: "Implemented a neural network with nothing but NumPy.", rule: { kind: "lab_completed", slug: "mlp-from-scratch-numpy" } },
  { id: "first-rag", title: "First RAG System", description: "Documents in, cited answers out.", rule: { kind: "lab_completed", slug: "pdf-rag-assistant" } },
  { id: "first-mcp", title: "First MCP Server", description: "Exposed real tools to a model through the protocol.", rule: { kind: "lab_completed", slug: "tiny-mcp-server" } },
  { id: "first-eval", title: "First AI Evaluation Pipeline", description: "Measured model quality instead of eyeballing it.", rule: { kind: "lab_completed", slug: "eval-pipeline" } },
  { id: "dsa-25", title: "25 problems", description: "Twenty-five DSA problems solved.", rule: { kind: "dsa_solved", count: 25 } },
  { id: "dsa-100", title: "100 DSA Problems", description: "A hundred problems. Patterns are becoming instinct.", rule: { kind: "dsa_solved", count: 100 } },
  { id: "debugged-10", title: "Debugged 10 Bugs", description: "Ten journal entries where something broke and you fixed it.", rule: { kind: "journal_fixes", count: 10 } },
  { id: "streak-7", title: "7 Day Streak", description: "A week of showing up.", rule: { kind: "streak", days: 7 } },
  { id: "streak-30", title: "30 Day Streak", description: "A month of showing up. This is the habit.", rule: { kind: "streak", days: 30 } },
  { id: "shipped", title: "Shipped a Project", description: "Took a project to production.", rule: { kind: "project_shipped" } },
  { id: "explainer", title: "Explained a Difficult Concept", description: "Passed an explain-it-back review.", rule: { kind: "explain_passed", count: 1 } },
  { id: "deep-work-50", title: "50 hours of deep work", description: "Fifty focused hours logged.", rule: { kind: "focus_hours", hours: 50 } },
];
