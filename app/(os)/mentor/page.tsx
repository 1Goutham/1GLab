import { and, asc, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { MENTOR_MODES, MODE_META, type MentorMode } from "@/lib/ai/mentor";
import { providerStatus } from "@/lib/ai/provider";
import { MentorChat } from "@/components/mentor/mentor-chat";

export const metadata = { title: "AI Mentor" };

export default async function MentorPage({ searchParams }: { searchParams: Promise<{ c?: string; mode?: string; topic?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const conversations = await db
    .select()
    .from(s.mentorConversations)
    .where(eq(s.mentorConversations.userId, user.id))
    .orderBy(desc(s.mentorConversations.updatedAt))
    .limit(30);
  const convId = sp.c ? Number(sp.c) : null;
  const conv = convId ? conversations.find((c) => c.id === convId) : null;
  const messages = conv
    ? await db
        .select({ role: s.mentorMessages.role, content: s.mentorMessages.content })
        .from(s.mentorMessages)
        .where(and(eq(s.mentorMessages.conversationId, conv.id)))
        .orderBy(asc(s.mentorMessages.createdAt), asc(s.mentorMessages.id))
    : [];
  const mode: MentorMode = (conv?.mode ?? (MENTOR_MODES.includes(sp.mode as MentorMode) ? sp.mode : "explain")) as MentorMode;
  const topicId = conv?.topicId ?? sp.topic ?? null;
  const topic = topicId ? await db.query.topics.findFirst({ where: eq(s.topics.id, topicId), columns: { id: true, title: true } }) : null;

  return (
    <MentorChat
      key={conv?.id ?? `new-${mode}-${topicId}`}
      ai={providerStatus()}
      conversationId={conv?.id ?? null}
      initialMessages={messages}
      initialMode={mode}
      topic={topic ?? null}
      modes={MENTOR_MODES.map((m) => ({ id: m, ...MODE_META[m] }))}
      conversations={conversations.map((c) => ({ id: c.id, title: c.title, mode: c.mode, updatedAt: c.updatedAt.toISOString() }))}
    />
  );
}
