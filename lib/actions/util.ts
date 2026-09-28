import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserOrThrow, UnauthorizedError, type User } from "@/lib/auth";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a server action: authenticates, validates input with Zod, converts
 * failures into friendly messages (never stack traces), and refreshes the UI.
 */
export function action<S extends z.ZodTypeAny, T>(schema: S, fn: (input: z.infer<S>, user: User) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = await getUserOrThrow();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      const data = await fn(parsed.data, user);
      revalidatePath("/", "layout");
      return { ok: true, data };
    } catch (err) {
      if (err instanceof UnauthorizedError) return { ok: false, error: "Your session expired. Sign in again." };
      console.error("[action]", err);
      return { ok: false, error: "Something went wrong saving that. Your work is safe — try again." };
    }
  };
}

export const slug = z.string().min(1).max(120).regex(/^[a-z0-9-]+$/);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
