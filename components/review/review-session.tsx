"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import type { QuizQuestion } from "@/content/types";
import { submitReview, snoozeReview } from "@/lib/actions/review";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";

export type ReviewCard =
  | { id: number; kind: "quiz"; title: string; href: string; stage: number; questions: QuizQuestion[] }
  | { id: number; kind: "explain" | "implement" | "interview"; title: string; href: string; stage: number; prompt: string; answer: string }
  | { id: number; kind: "resolve"; title: string; href: string; stage: number; prompt: string };

const KIND_LABEL = { quiz: "Quick quiz", explain: "Explain it back", implement: "Implement from memory", interview: "Interview question", resolve: "DSA re-solve" };

/** One card at a time. Finishing a card animates it away and brings the next. */
export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const [i, setI] = useState(0);
  const [pending, start] = useTransition();
  const card = cards[i];

  const finish = (result: "pass" | "partial" | "fail", response = "") =>
    start(async () => {
      const res = await submitReview({ reviewId: card.id, result, response });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      toastFeedback(res.data);
      if (result === "fail") toast({ title: "Back in 2 days", body: "Forgetting is data. It'll return gently.", tone: "neutral" });
      setI((x) => x + 1);
    });

  const snooze = () =>
    start(async () => {
      await snoozeReview({ reviewId: card.id, days: 2 });
      setI((x) => x + 1);
    });

  if (!card)
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-accent/30 bg-accent/[0.04] p-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Review complete</div>
        <h2 className="mt-3 font-display text-3xl font-light text-white">That&apos;s retention, earned.</h2>
        <Link href="/" className="mt-5 inline-block text-sm text-muted hover:text-fg">
          Back to today →
        </Link>
      </motion.div>
    );

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {cards.map((c, j) => (
          <span key={c.id} className={cn("h-1 flex-1 rounded-full transition-colors duration-500", j < i ? "bg-accent" : j === i ? "bg-white/40" : "bg-white/[0.08]")} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-line-strong bg-white/[0.015] p-6 md:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{KIND_LABEL[card.kind]}</span>
            <button onClick={snooze} disabled={pending} className="font-mono text-[11px] text-faint hover:text-muted">
              bad day? snooze 2 days
            </button>
          </div>
          <Link href={card.href} className="mt-2 block font-display text-[26px] font-light text-white hover:text-accent">
            {card.title}
          </Link>
          {card.kind === "quiz" && <Quiz questions={card.questions} onDone={finish} pending={pending} />}
          {(card.kind === "explain" || card.kind === "implement" || card.kind === "interview") && (
            <FreeRecall id={card.id} kind={card.kind} prompt={card.prompt} answer={card.answer} onDone={finish} pending={pending} />
          )}
          {card.kind === "resolve" && (
            <div className="mt-5">
              <p className="text-[15px] text-muted">{card.prompt}</p>
              <div className="mt-6 flex gap-3">
                <Link href={card.href} className="tactile rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink">
                  Open problem
                </Link>
                <Button onClick={() => setI((x) => x + 1)}>Skip for now</Button>
              </div>
              <p className="mt-3 text-[12.5px] text-faint">Logging the attempt on the problem page closes this review automatically.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Quiz({ questions, onDone, pending }: { questions: QuizQuestion[]; onDone: (r: "pass" | "partial" | "fail", resp: string) => void; pending: boolean }) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const checked = answers.every((a) => a !== null);
  const correct = answers.filter((a, i) => a === questions[i].answer).length;
  const result = correct === questions.length ? "pass" : correct >= Math.ceil(questions.length / 2) ? "partial" : "fail";
  return (
    <div className="mt-6 space-y-8">
      {questions.map((q, qi) => {
        const a = answers[qi];
        return (
          <div key={qi}>
            <div className="text-[15.5px] text-fg">
              <span className="mr-2 font-mono text-[11px] text-faint">{qi + 1}.</span>
              {q.q}
            </div>
            <div className="mt-3 grid gap-2">
              {q.options.map((o, oi) => {
                const chosen = a === oi;
                const isRight = a !== null && oi === q.answer;
                return (
                  <button
                    key={oi}
                    disabled={a !== null}
                    onClick={() => setAnswers((xs) => xs.map((x, j) => (j === qi ? oi : x)))}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-[14px] transition-colors",
                      a === null && "border-line hover:border-line-strong hover:bg-white/[0.02]",
                      isRight && "border-accent/50 bg-accent/[0.07] text-fg",
                      chosen && !isRight && "border-bad/50 bg-bad/[0.07]",
                      a !== null && !isRight && !chosen && "border-line opacity-50",
                    )}
                  >
                    <span className="mt-0.5 font-mono text-[11px] text-faint">{String.fromCharCode(65 + oi)}</span>
                    <span className="flex-1">{o}</span>
                    {isRight && <Check className="mt-0.5 size-4 text-accent" />}
                    {chosen && !isRight && <X className="mt-0.5 size-4 text-bad" />}
                  </button>
                );
              })}
            </div>
            {a !== null && <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{q.explain}</p>}
          </div>
        );
      })}
      {checked && (
        <div className="flex items-center justify-between border-t border-line pt-5">
          <span className="text-[14px] text-muted">
            {correct}/{questions.length} correct
          </span>
          <Button variant="primary" disabled={pending} onClick={() => onDone(result, `${correct}/${questions.length}`)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

type Grade = { result: "pass" | "partial" | "fail"; feedback: string; missing: string[] };

function FreeRecall({
  id,
  kind,
  prompt,
  answer,
  onDone,
  pending,
}: {
  id: number;
  kind: string;
  prompt: string;
  answer: string;
  onDone: (r: "pass" | "partial" | "fail", resp: string) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);

  const askMentor = async () => {
    setGrading(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "grade-review", reviewId: id, answer: draft }) });
      const data = await res.json();
      if (data.grade) setGrade(data.grade);
      else toast({ title: "Mentor offline", body: "Compare with the reference and grade yourself honestly.", tone: "neutral" });
    } finally {
      setGrading(false);
      setRevealed(true);
    }
  };

  return (
    <div className="mt-5">
      <Markdown className="text-[15.5px]">{prompt}</Markdown>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={kind === "implement" ? 10 : 5}
        placeholder={kind === "implement" ? "Write the code from memory. No peeking at the lesson." : "Write it as if explaining to a junior engineer."}
        className={cn("box-input mt-5", kind === "implement" && "font-mono text-[13px]")}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => setRevealed(true)} disabled={revealed}>
          Compare with reference
        </Button>
        <Button variant="ghost" onClick={askMentor} disabled={grading || draft.trim().length < 20}>
          {grading ? "Mentor is reading…" : "Get mentor feedback"}
        </Button>
      </div>
      <AnimatePresence>
        {grade && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-xl border border-line-strong p-4">
            <div className={cn("font-mono text-[11px] uppercase tracking-[0.14em]", grade.result === "pass" ? "text-accent" : grade.result === "partial" ? "text-warn" : "text-bad")}>Mentor: {grade.result}</div>
            <p className="mt-2 text-[14px] leading-relaxed text-fg">{grade.feedback}</p>
            {grade.missing.length > 0 && <p className="mt-2 text-[13px] text-muted">Missing: {grade.missing.join(" · ")}</p>}
          </motion.div>
        )}
        {revealed && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Reference</div>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-line bg-white/[0.015] p-4">
              <Markdown className="text-[14px]">{answer}</Markdown>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-2 text-[13px] text-muted">How did you do?</span>
              <Button size="sm" variant="primary" disabled={pending} onClick={() => onDone("pass", draft)}>
                Nailed it
              </Button>
              <Button size="sm" disabled={pending} onClick={() => onDone("partial", draft)}>
                Mostly
              </Button>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => onDone("fail", draft)}>
                Missed it
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
