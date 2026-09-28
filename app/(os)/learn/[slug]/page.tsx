import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ChevronLeft, Sparkles, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { LessonContent } from "@/content/types";
import { loadState } from "@/lib/data/state";
import { topicStatus } from "@/lib/data/derive";
import { videosForTopic } from "@/lib/ai/youtube";
import { Markdown } from "@/components/ui/markdown";
import { CodeBlock } from "@/components/ui/code-block";
import { Diagram } from "@/components/diagrams/diagram";
import { Chip, Difficulty, DomainDot, DOMAIN_LABEL, Label } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { LessonFlow } from "@/components/learn/lesson-flow";
import { MiniTaskPanel } from "@/components/learn/mini-task";
import { VideoList } from "@/components/learn/video-list";
import { CompleteTopic } from "@/components/learn/complete-topic";
import { InterviewQuestion } from "@/components/learn/interview-question";
import { TopicNotes } from "@/components/learn/topic-notes";
import { formatMinutes } from "@/lib/engine/dates";
import { focusHref } from "@/lib/focus";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await db.query.topics.findFirst({ where: eq(s.topics.id, slug), columns: { title: true } });
  return { title: t?.title ?? "Lesson" };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const st = await loadState(user);
  const topic = st.topics.find((t) => t.id === slug);
  if (!topic) notFound();
  const [lessonRow, videos, notes] = await Promise.all([
    db.query.lessons.findFirst({ where: eq(s.lessons.topicId, slug) }),
    videosForTopic(slug, user.id),
    db.select().from(s.notes).where(and(eq(s.notes.userId, user.id), eq(s.notes.topicId, slug))).orderBy(desc(s.notes.createdAt)),
  ]);
  if (!lessonRow) notFound();
  const c = lessonRow.content as LessonContent;
  const progress = topicStatus(st, slug);
  const mod = st.modules.find((m) => m.id === topic.moduleId);
  const skills = topic.skillIds.map((id) => st.skills.find((k) => k.id === id)?.name ?? id);
  const idx = st.topics.findIndex((t) => t.id === slug);
  const next = st.topics[idx + 1];
  const lab = st.labs.find((l) => l.topicIds.includes(slug));

  const codes = (list?: LessonContent["levels"]["l3"]["code"]) =>
    list?.length ? (
      <div className="mt-6 space-y-4">
        {list.map((ex, i) => (
          <CodeBlock key={i} code={ex.code} lang={ex.lang} title={ex.title} variant={ex.variant} note={ex.note} />
        ))}
      </div>
    ) : null;

  return (
    <div>
      <Link href="/learn" className="group mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted">
        <ChevronLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Month {mod?.month} · Week {topic.week}
      </Link>

      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
            <DomainDot domain={topic.domain} />
            {DOMAIN_LABEL[topic.domain]}
          </span>
          <Difficulty level={topic.difficulty} />
          <span className="font-mono text-[11px] text-faint">{formatMinutes(topic.minutes)}</span>
          {progress?.status === "completed" && <Chip tone="accent">Completed</Chip>}
        </div>
        <h1 className="mt-4 font-display text-4xl font-light leading-[1.08] tracking-tight text-white md:text-[52px]">{topic.title}</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">{topic.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {skills.map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href={focusHref({ title: topic.title, refType: "topic", refId: slug }, topic.minutes, `Work through all five levels, then: ${c.miniTask.title}`)} variant="secondary" size="sm">
            <Timer className="size-3.5" /> Focus mode
          </ButtonLink>
          <ButtonLink href={`/mentor?topic=${slug}&mode=explain`} variant="ghost" size="sm">
            <Sparkles className="size-3.5" /> Ask the mentor
          </ButtonLink>
        </div>
      </header>

      <LessonFlow
        topicId={slug}
        initialLevel={progress?.levelReached ?? 0}
        why={
          <>
            <Markdown className="text-[17px] leading-[1.75] text-[#dcdce0]">{c.hook}</Markdown>
            <p className="mt-6 border-l-2 border-accent/70 pl-4 text-[15px] leading-relaxed text-fg">
              <span className="mr-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">Why this matters</span>
              {c.whyItMatters}
            </p>
          </>
        }
        levels={[
          <Markdown key="l1" className="font-display text-[22px] font-light leading-[1.5] text-white">
            {c.levels.l1}
          </Markdown>,
          <div key="l2">
            {c.levels.l2.analogy && <p className="mb-5 font-display text-[19px] font-light italic leading-relaxed text-fg">&ldquo;{c.levels.l2.analogy}&rdquo;</p>}
            <Markdown>{c.levels.l2.text}</Markdown>
            {c.levels.l2.diagram && <Diagram spec={c.levels.l2.diagram} className="mt-7" />}
          </div>,
          <div key="l3">
            <Markdown>{c.levels.l3.text}</Markdown>
            {codes(c.levels.l3.code)}
          </div>,
          <div key="l4">
            <Markdown>{c.levels.l4.text}</Markdown>
            {c.levels.l4.diagram && <Diagram spec={c.levels.l4.diagram} className="mt-7" />}
            {codes(c.levels.l4.code)}
            {(c.commonMistakes.length > 0 || c.tryThis) && (
              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {c.commonMistakes.length > 0 && (
                  <div>
                    <Label className="mb-3 text-bad/80">Common mistakes</Label>
                    <ul className="space-y-3">
                      {c.commonMistakes.map((m, i) => (
                        <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted">
                          <span className="mt-0.5 font-mono text-[11px] text-bad/70">{String(i + 1).padStart(2, "0")}</span>
                          <Markdown className="text-[14px] leading-relaxed text-muted">{m}</Markdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.tryThis && (
                  <div className="rounded-xl border border-line bg-white/[0.015] p-5">
                    <Label className="mb-3 text-accent">Try this — 2 minutes</Label>
                    <Markdown className="text-[14px]">{c.tryThis}</Markdown>
                  </div>
                )}
              </div>
            )}
          </div>,
          <InterviewQuestion
            key="l5"
            topicId={slug}
            question={<Markdown className="font-display text-[21px] font-light leading-[1.5] text-white">{c.levels.l5.question}</Markdown>}
            hint={c.levels.l5.hint ?? null}
            answer={<Markdown>{c.levels.l5.answer}</Markdown>}
          />,
        ]}
        after={
          <>
            <section id="mini-task" className="mt-20 scroll-mt-24">
              <MiniTaskPanel topicId={slug} task={c.miniTask} initialChecks={progress?.miniTaskChecks ?? []} />
            </section>

            {videos.length > 0 && (
              <section id="videos" className="mt-16 scroll-mt-24">
                <Label>Watch — only if it helps</Label>
                <VideoList videos={videos.map((v) => ({ id: v.id, title: v.title, channel: v.channel, url: v.url, kind: v.kind, minutes: v.minutes, reason: v.reason, watched: v.watched, rating: v.rating, embedId: v.embedId }))} />
              </section>
            )}

            <section id="complete" className="mt-16 scroll-mt-24">
              <CompleteTopic
                topicId={slug}
                miniTaskDone={Boolean(progress?.miniTaskDone)}
                completed={progress?.status === "completed"}
                initialConfidence={progress?.confidence ?? null}
                initialReflection={progress?.reflection ?? ""}
                next={next ? { href: `/learn/${next.id}`, title: next.title } : null}
                lab={lab ? { href: `/labs/${lab.id}`, title: lab.title } : null}
              />
            </section>

            <section id="notes" className="mt-16 scroll-mt-24">
              <TopicNotes topicId={slug} topicTitle={topic.title} notes={notes.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString() }))} />
            </section>
          </>
        }
      />
    </div>
  );
}
