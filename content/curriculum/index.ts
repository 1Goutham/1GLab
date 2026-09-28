import type { MonthSeed } from "../types";
import { month1 } from "./month-1";
import { month2 } from "./month-2";
import { month3 } from "./month-3";
import { month4 } from "./month-4";
import { month5 } from "./month-5";
import { month6 } from "./month-6";

export const CURRICULUM: MonthSeed[] = [month1, month2, month3, month4, month5, month6];

export const LEARNING_PATH = {
  id: "advanced-ai-engineer",
  title: "Advanced AI Engineer",
  goal: "Design, build, evaluate and ship AI systems — with the engineering depth to reason about every layer.",
  months: 6,
};
