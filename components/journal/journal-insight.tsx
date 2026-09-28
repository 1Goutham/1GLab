"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

export function JournalInsight({ hasEntries }: { hasEntries: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task: "journal-insight" }) });
      const data = await res.json();
      setText(data.text ?? data.error ?? "Your mentor is taking a short break.");
    } catch {
      setText("Your mentor is taking a short break. The journal is saved either way.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="rounded-xl border border-line-strong p-5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Mentor read</div>
      {text ? (
        <Markdown className="mt-3 text-[14px]">{text}</Markdown>
      ) : (
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">Let the mentor read your last two weeks and name the one pattern worth acting on.</p>
      )}
      <button onClick={run} disabled={loading || !hasEntries} className="mt-4 flex items-center gap-2 font-mono text-[12px] text-accent disabled:text-faint">
        <Sparkles className="size-3.5" />
        {loading ? "reading…" : text ? "read again" : "analyse my journal"}
      </button>
    </div>
  );
}
