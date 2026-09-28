"use client";

import { useState, useTransition } from "react";
import { saveTopicNote } from "@/lib/actions/learn";
import { toast } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";

type Note = { id: number; title: string; body: string; createdAt: string };

export function TopicNotes({ topicId, topicTitle, notes }: { topicId: string; topicTitle: string; notes: Note[] }) {
  const [body, setBody] = useState("");
  const [items, setItems] = useState(notes);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const text = body.trim();
      if (!text) return;
      const res = await saveTopicNote({ topicId, title: text.split("\n")[0].slice(0, 80) || topicTitle, body: text });
      if (!res.ok) return toast({ title: res.error, tone: "bad" });
      setItems((xs) => [{ id: Date.now(), title: text.split("\n")[0].slice(0, 80), body: text, createdAt: new Date().toISOString() }, ...xs]);
      setBody("");
    });
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Notes</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Anything worth keeping — a gotcha, a command, a link." className="box-input mt-4" />
      <div className="mt-3">
        <Button size="sm" onClick={save} disabled={pending || !body.trim()}>
          Save note
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="mt-6 space-y-3">
          {items.map((n) => (
            <li key={n.id} className="rounded-lg border border-line px-4 py-3">
              <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-fg">{n.body}</div>
              <div className="mt-1.5 font-mono text-[10.5px] text-faint">{new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
