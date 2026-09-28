"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";

/**
 * Level 5. Answer first, then compare. Revealing the model answer before
 * writing anything is allowed — but it asks you to try first.
 */
export function InterviewQuestion({ topicId, question, hint, answer }: { topicId: string; question: React.ReactNode; hint: string | null; answer: React.ReactNode }) {
  const [draft, setDraft] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      {question}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        placeholder="Answer like you're in the interview. 4–6 sentences. Then compare."
        className="box-input mt-6"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant={draft.trim().length > 40 ? "primary" : "secondary"} size="sm" onClick={() => setRevealed(true)}>
          {draft.trim().length > 40 ? "Compare with a strong answer" : "Reveal the answer"}
        </Button>
        {hint && !showHint && (
          <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
            Hint
          </Button>
        )}
        <Link href={`/mentor?topic=${topicId}&mode=interview`} className="font-mono text-[12px] text-faint hover:text-muted">
          or get interviewed by the mentor →
        </Link>
      </div>
      <AnimatePresence>
        {showHint && hint && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 text-[14px] text-muted">
            <span className="font-mono text-[11px] uppercase tracking-wider text-warn">Hint · </span>
            {hint}
          </motion.p>
        )}
        {revealed && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mt-6 rounded-xl border border-line bg-white/[0.015] p-5">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">A strong answer</div>
            {answer}
            {draft.trim().length < 40 && <p className="mt-4 text-[13px] text-faint">Next time, write yours first — recall is what builds memory, not recognition.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
