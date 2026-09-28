import "server-only";
import { z } from "zod";
import { getProvider, extractJson } from "./provider";

/**
 * Grades an explain / implement / interview answer against the lesson's model
 * answer. The learner always self-grades too; the mentor's grade is advice,
 * shown next to the model answer — never a silent override.
 */
const Grade = z.object({
  result: z.enum(["pass", "partial", "fail"]),
  feedback: z.string().max(1500),
  missing: z.array(z.string().max(200)).max(5),
});
export type Grade = z.infer<typeof Grade>;

export async function gradeAnswer(input: { kind: string; topic: string; prompt: string; modelAnswer: string; answer: string }): Promise<Grade | null> {
  const provider = getProvider();
  if (!provider || input.answer.trim().length < 10) return null;
  try {
    const reply = await provider.complete({
      system:
        'You grade an engineer\'s recall answer like a fair senior interviewer. "pass" = correct and complete enough that they clearly understand it; "partial" = right idea with a real gap; "fail" = wrong or missing the core idea. Feedback: 2-3 direct sentences in second person — what was good, the most important gap. "missing": short phrases for concepts they left out. Return JSON {result, feedback, missing}.',
      messages: [
        {
          role: "user",
          content: `Topic: ${input.topic}\nReview type: ${input.kind}\nQuestion: ${input.prompt}\n\nReference answer:\n${input.modelAnswer}\n\nTheir answer:\n${input.answer}`,
        },
      ],
      json: true,
      maxTokens: 1500,
    });
    return Grade.parse(extractJson(reply));
  } catch {
    return null;
  }
}
