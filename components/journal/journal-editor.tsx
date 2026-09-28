"use client";

import { useEffect, useRef, useState } from "react";
import { saveJournal } from "@/lib/actions/daily";
import { cn } from "@/lib/cn";

type Fields = { learned: string; built: string; broke: string; fixed: string; confused: string; canExplain: string; revisit: string; energy: number | null };

const PROMPTS: { key: keyof Omit<Fields, "energy">; q: string; ph: string }[] = [
  { key: "learned", q: "What did I learn?", ph: "The concept, in one or two sentences." },
  { key: "built", q: "What did I build?", ph: "Code, labs, experiments — link the repo if there is one." },
  { key: "broke", q: "What broke?", ph: "Errors, wrong assumptions, dead ends." },
  { key: "fixed", q: "How did I fix it?", ph: "The actual fix, and how you found it." },
  { key: "confused", q: "What confused me?", ph: "Be specific — this is what the mentor looks for." },
  { key: "canExplain", q: "What can I explain now?", ph: "Something you couldn't explain yesterday." },
  { key: "revisit", q: "What should I revisit?", ph: "Topics, problems, docs." },
];

/** Autosaves 1.2s after you stop typing. No save button to forget. */
export function JournalEditor({ date, initial }: { date: string; initial: Fields }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      const res = await saveJournal({ date, ...v });
      setStatus(res.ok ? "saved" : "error");
    }, 1200);
    return () => clearTimeout(t);
  }, [v, date]);

  return (
    <div>
      <div className="mb-2 flex h-5 justify-end font-mono text-[10.5px] text-faint">
        {status === "saving" && "saving…"}
        {status === "saved" && <span className="text-accent/80">saved</span>}
        {status === "error" && <span className="text-bad">couldn&apos;t save — retrying on next edit</span>}
      </div>
      <div className="border-b border-line">
        {PROMPTS.map((p, i) => (
          <label key={p.key} className="group grid gap-2 border-t border-line py-5 md:grid-cols-[200px_1fr] md:gap-6">
            <span className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-display text-[17px] font-light text-fg transition-colors group-focus-within:text-white">{p.q}</span>
            </span>
            <textarea
              value={v[p.key]}
              onChange={(e) => setV({ ...v, [p.key]: e.target.value })}
              placeholder={p.ph}
              rows={Math.max(2, Math.min(8, v[p.key].split("\n").length + 1))}
              className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-fg outline-none placeholder:text-faint"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Energy today</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setV({ ...v, energy: v.energy === n ? null : n })}
              className={cn("tactile size-8 rounded-md border font-mono text-[12px]", v.energy && n <= v.energy ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-faint")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
