"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw } from "lucide-react";
import { logAttempt } from "@/lib/actions/dsa";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { MISTAKE_LABELS, type MistakeType } from "@/lib/engine/dsa";
import { cn } from "@/lib/cn";

/**
 * Timer + honest attempt log. Everything captured here — time vs estimate,
 * hints, whether the solution was viewed, the mistake type — feeds the
 * weakness map and the re-solve schedule.
 */
export function AttemptLogger({ problemId, estimate, hint }: { problemId: string; estimate: number; hint: string }) {
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [hints, setHints] = useState(0);
  const [viewed, setViewed] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [mistake, setMistake] = useState<MistakeType | null>(null);
  const [notes, setNotes] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [pending, start] = useTransition();
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (running) t.current = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      if (t.current) clearInterval(t.current);
    };
  }, [running]);

  const minutes = Math.max(1, Math.round(secs / 60));
  const over = secs / 60 > estimate;

  const submit = () =>
    start(async () => {
      if (solved === null) return;
      const res = await logAttempt({ problemId, solved, minutes, hintsUsed: hints, solutionViewed: viewed, confidence, mistake: solved && !viewed && !mistake ? null : mistake, notes });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      setRunning(false);
      toast({
        eyebrow: "Attempt logged",
        title: solved && !viewed ? "Clean solve." : "Logged — this is how weak spots get fixed.",
        body: res.data.nextReview ? `It comes back for a cold re-solve on ${res.data.nextReview}.` : "No re-solve needed.",
        tone: solved && !viewed ? "accent" : "neutral",
      });
      toastFeedback(res.data.feedback);
      router.refresh();
      setSolved(null);
      setSecs(0);
      setHints(0);
      setViewed(false);
      setMistake(null);
      setNotes("");
    });

  return (
    <div className="rounded-2xl border border-line-strong bg-white/[0.015] p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Timer · estimate {estimate} min</div>
          <div className={cn("mt-1 font-mono text-5xl font-light tabular-nums", over ? "text-warn" : "text-white")}>
            {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={running ? "secondary" : "primary"} onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pause" : secs ? "Resume" : "Start"}
          </Button>
          <Button variant="ghost" onClick={() => { setRunning(false); setSecs(0); }} aria-label="Reset timer">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        {showHint ? (
          <p className="text-[14px] text-muted">
            <span className="font-mono text-[11px] uppercase tracking-wider text-warn">Hint · </span>
            {hint}
          </p>
        ) : (
          <button onClick={() => { setShowHint(true); setHints((h) => h + 1); }} className="font-mono text-[12px] text-faint hover:text-muted">
            Stuck? Reveal the key idea (counts as a hint) →
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Log the attempt</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Seg on={solved === true} onClick={() => setSolved(true)}>
            Solved
          </Seg>
          <Seg on={solved === false} onClick={() => setSolved(false)} bad>
            Didn&apos;t solve
          </Seg>
          <span className="mx-2 w-px bg-line" />
          <Seg on={viewed} onClick={() => setViewed((v) => !v)} bad>
            Viewed solution
          </Seg>
          <Seg on={hints > 0} onClick={() => setHints((h) => (h > 0 ? 0 : 1))}>
            Used hints{hints > 1 ? ` (${hints})` : ""}
          </Seg>
        </div>

        {(solved === false || viewed || confidence <= 3) && (
          <div className="mt-6">
            <div className="mb-2 text-[13px] text-muted">What went wrong?</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MISTAKE_LABELS) as MistakeType[]).map((m) => (
                <Seg key={m} small on={mistake === m} onClick={() => setMistake(mistake === m ? null : m)} bad>
                  {MISTAKE_LABELS[m]}
                </Seg>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="mb-2 text-[13px] text-muted">Confidence you could solve it cold next week</div>
          <div className="flex max-w-sm gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setConfidence(n)}
                className={cn("tactile h-9 flex-1 rounded-md border font-mono text-sm", n <= confidence ? "border-[var(--d-dsa)]/50 bg-[var(--d-dsa)]/10 text-[var(--d-dsa)]" : "border-line-strong text-faint")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="The insight, or the bug (optional)" className="box-input mt-6" />
        <div className="mt-5 flex items-center gap-4">
          <Button variant="primary" onClick={submit} disabled={solved === null || pending}>
            Log attempt · {minutes} min
          </Button>
          {secs === 0 && <span className="text-[12.5px] text-faint">Tip: start the timer — time vs estimate is part of the signal.</span>}
        </div>
      </div>
    </div>
  );
}

function Seg({ on, onClick, children, bad, small }: { on: boolean; onClick: () => void; children: React.ReactNode; bad?: boolean; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "tactile rounded-full border",
        small ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
        on ? (bad ? "border-bad/50 bg-bad/10 text-bad" : "border-accent/50 bg-accent/10 text-accent") : "border-line-strong text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
