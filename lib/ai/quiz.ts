import "server-only";
import { z } from "zod";
import type { LessonContent, QuizQuestion } from "@/content/types";
import { getProvider, extractJson } from "./provider";

/**
 * Quiz questions for day-3 reviews. The lesson's own questions come first;
 * when the learner has already seen them (a retry), the model writes fresh
 * ones grounded in the same lesson so recall isn't just pattern-matching.
 */
const Q = z.object({ q: z.string(), options: z.array(z.string()).length(4), answer: z.number().int().min(0).max(3), explain: z.string() });

export async function quizFor(lesson: LessonContent, title: string, attempt: number): Promise<{ questions: QuizQuestion[]; source: "lesson" | "ai" }> {
  if (attempt === 0 || !getProvider()) return { questions: lesson.quiz, source: "lesson" };
  try {
    const reply = await getProvider()!.complete({
      system:
        "Write 3 new multiple-choice recall questions (4 options each) that test understanding, not wording, of the lesson below. Vary them from the existing questions. Return JSON {questions:[{q, options, answer, explain}]}.",
      messages: [
        {
          role: "user",
          content: `Topic: ${title}\n\nLesson summary:\n${lesson.levels.l1}\n${lesson.levels.l2.text}\n${lesson.levels.l3.text}\n\nExisting questions:\n${lesson.quiz.map((q) => q.q).join("\n")}`,
        },
      ],
      json: true,
      maxTokens: 2000,
    });
    const parsed = z.object({ questions: z.array(Q).min(1).max(5) }).parse(extractJson(reply));
    return { questions: parsed.questions, source: "ai" };
  } catch {
    return { questions: lesson.quiz, source: "lesson" };
  }
}
