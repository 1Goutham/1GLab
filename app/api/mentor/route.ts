import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { getUserOrThrow, UnauthorizedError } from "@/lib/auth";
import { loadState } from "@/lib/data/state";
import { logEvent } from "@/lib/data/effects";
import { getProvider, AIUnavailableError } from "@/lib/ai/provider";
import { learnerBrief } from "@/lib/ai/context";
import { MENTOR_MODES, mentorSystemPrompt } from "@/lib/ai/mentor";
import { offlineMentorReply, offlineQuizFollowUp } from "@/lib/ai/offline";
import { AI_LIMIT, rateLimit } from "@/lib/ai/rate-limit";
import type { LessonContent } from "@/content/types";

export const maxDuration = 60;

const Body = z.object({
  conversationId: z.number().int().positive().nullable(),
  mode: z.enum(MENTOR_MODES),
  message: z.string().trim().min(1).max(8000),
  topicId: z.string().max(120).nullable().optional(),
});

/**
 * Streams the mentor's reply as plain text. The conversation id comes back in
 * the `x-conversation-id` header. Messages are persisted on both sides so the
 * mentor keeps context across sessions.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await getUserOrThrow();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { mode, message, topicId } = parsed.data;

  const limit = rateLimit(`mentor:${user.id}`, AI_LIMIT.limit, AI_LIMIT.windowMs);
  if (!limit.ok) {
    return Response.json(
      { error: `You've been busy — the mentor needs ${Math.ceil(limit.retryAfterMs / 60000)} minutes to catch up. Keep going on today's mission meanwhile.` },
      { status: 429 },
    );
  }

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const owned = await db.query.mentorConversations.findFirst({
      where: and(eq(s.mentorConversations.id, conversationId), eq(s.mentorConversations.userId, user.id)),
    });
    if (!owned) return Response.json({ error: "Conversation not found" }, { status: 404 });
  } else {
    const [row] = await db
      .insert(s.mentorConversations)
      .values({ userId: user.id, mode, title: message.slice(0, 80), topicId: topicId ?? null })
      .returning({ id: s.mentorConversations.id });
    conversationId = row.id;
  }

  await db.insert(s.mentorMessages).values({ conversationId, role: "user", content: message });
  const history = await db
    .select({ role: s.mentorMessages.role, content: s.mentorMessages.content })
    .from(s.mentorMessages)
    .where(eq(s.mentorMessages.conversationId, conversationId))
    .orderBy(asc(s.mentorMessages.createdAt), asc(s.mentorMessages.id));
  const messages = history.slice(-24);

  const st = await loadState(user);
  await logEvent(user, "mentor_message", { refType: "mentor", refId: String(conversationId) });

  let topicContext: string | undefined;
  if (topicId) {
    const lesson = await db.query.lessons.findFirst({ where: eq(s.lessons.topicId, topicId) });
    const topic = st.topics.find((t) => t.id === topicId);
    if (lesson && topic) {
      const c = lesson.content as LessonContent;
      topicContext = `${topic.title} — ${topic.summary}\nLevel 1: ${c.levels.l1}\nLevel 2: ${c.levels.l2.text}\nInterview question: ${c.levels.l5.question}`;
    }
  }

  const provider = getProvider();
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      const send = (t: string) => {
        full += t;
        controller.enqueue(encoder.encode(t));
      };
      const offline = async () => {
        const follow = await offlineQuizFollowUp(messages, st);
        send(follow ?? (await offlineMentorReply(mode, messages, st)));
      };
      try {
        if (!provider) await offline();
        else {
          try {
            for await (const chunk of provider.stream({
              system: mentorSystemPrompt(mode, learnerBrief(st), topicContext),
              messages,
              maxTokens: 4000,
              signal: req.signal,
            })) {
              send(chunk);
            }
          } catch (err) {
            if (full) send("\n\n_The connection dropped mid-answer. Ask again to continue._");
            else if (err instanceof AIUnavailableError) await offline();
            else throw err;
          }
        }
      } catch (err) {
        console.error("[mentor]", err);
        if (!full) send("Your mentor is taking a short break. You can continue today's mission offline.");
      } finally {
        if (full) await db.insert(s.mentorMessages).values({ conversationId: convId, role: "assistant", content: full, provider: provider?.id ?? "offline" });
        await db.update(s.mentorConversations).set({ updatedAt: new Date() }).where(eq(s.mentorConversations.id, convId));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-conversation-id": String(convId),
      "x-mentor-provider": provider?.id ?? "offline",
    },
  });
}
