"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { updateProject } from "@/lib/actions/daily";
import { toast, toastFeedback } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type P = {
  id: string;
  status: "shipped" | "building" | "concept" | "planned";
  skillEvidence: Record<string, number>;
  bugs: string[];
  decisions: string[];
  learningOutcomes: string[];
  milestones: { title: string; month?: number; done?: boolean }[];
  improvements: { title: string; why: string; skill: string; done?: boolean }[];
  showcase: boolean;
};

/**
 * Everything on a project is editable in place and saved immediately:
 * which skills it proves, what broke, what was decided, what's next.
 */
export function ProjectEditor({ project, skills }: { project: P; skills: { id: string; name: string }[] }) {
  const [p, setP] = useState(project);
  const [, start] = useTransition();
  const name = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  const save = (patch: Partial<P>) => {
    setP((cur) => ({ ...cur, ...patch }));
    start(async () => {
      const res = await updateProject({ id: p.id, ...patch });
      if (!res.ok) toast({ title: res.error, tone: "bad" });
      else toastFeedback(res.data);
    });
  };

  const [addSkill, setAddSkill] = useState("");
  const evidence = Object.entries(p.skillEvidence).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-14 space-y-14">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Label>Skills this project demonstrates</Label>
          <div className="flex gap-1">
            {(["planned", "concept", "building", "shipped"] as const).map((s) => (
              <button key={s} onClick={() => save({ status: s })} className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px] capitalize", p.status === s ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-faint hover:text-muted")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {evidence.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_1fr_40px_20px] items-center gap-4">
              <span className="truncate text-[13.5px] text-fg">{name(k)}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                defaultValue={v}
                onMouseUp={(e) => save({ skillEvidence: { ...p.skillEvidence, [k]: Number((e.target as HTMLInputElement).value) } })}
                onTouchEnd={(e) => save({ skillEvidence: { ...p.skillEvidence, [k]: Number((e.target as HTMLInputElement).value) } })}
                onKeyUp={(e) => save({ skillEvidence: { ...p.skillEvidence, [k]: Number((e.target as HTMLInputElement).value) } })}
                className="w-full accent-[#9dff50]"
                aria-label={`${name(k)} evidence`}
              />
              <span className={cn("text-right font-mono text-[12px]", v >= 60 ? "text-accent" : v < 30 ? "text-bad" : "text-muted")}>{v}</span>
              <button
                onClick={() => {
                  const rest = { ...p.skillEvidence };
                  delete rest[k];
                  save({ skillEvidence: rest });
                }}
                aria-label="Remove"
              >
                <X className="size-3.5 text-faint hover:text-bad" />
              </button>
            </div>
          ))}
          {evidence.length === 0 && <p className="text-[13.5px] text-faint">Nothing claimed yet. Add a skill once the project genuinely uses it.</p>}
          <div className="flex items-center gap-2 pt-2">
            <select value={addSkill} onChange={(e) => setAddSkill(e.target.value)} className="field-input max-w-60 text-[13px]">
              <option value="">Add a skill…</option>
              {skills.filter((s) => !(s.id in p.skillEvidence)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!addSkill} onClick={() => { save({ skillEvidence: { ...p.skillEvidence, [addSkill]: 30 } }); setAddSkill(""); }}>
              Add
            </Button>
          </div>
        </div>
      </section>

      {p.improvements.length > 0 && (
        <section>
          <Label className="mb-4">Recommended improvements</Label>
          <ul className="border-b border-line">
            {p.improvements.map((imp, i) => (
              <li key={imp.title} className="grid grid-cols-[28px_1fr] gap-4 border-t border-line py-4">
                <button
                  onClick={() => save({ improvements: p.improvements.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                  className={cn("mt-0.5 grid size-[18px] place-items-center rounded-[5px] border", imp.done ? "border-accent bg-accent" : "border-line-strong")}
                  aria-label="Toggle done"
                >
                  {imp.done && <Check className="size-3 text-accent-ink" strokeWidth={3} />}
                </button>
                <div>
                  <div className={cn("text-[15px]", imp.done ? "text-muted line-through" : "text-fg")}>{imp.title}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{imp.why}</div>
                  <div className="mt-1 font-mono text-[10.5px] uppercase tracking-wider text-faint">builds · {name(imp.skill)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.milestones.length > 0 && (
        <section>
          <Label className="mb-4">Next milestones</Label>
          <ul className="space-y-1">
            {p.milestones.map((m, i) => (
              <li key={m.title}>
                <button onClick={() => save({ milestones: p.milestones.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} className="flex items-center gap-3 py-1.5 text-left">
                  <span className={cn("grid size-[18px] place-items-center rounded-full border", m.done ? "border-accent bg-accent" : "border-line-strong")}>{m.done && <Check className="size-3 text-accent-ink" strokeWidth={3} />}</span>
                  <span className={cn("text-[14.5px]", m.done ? "text-muted" : "text-fg")}>{m.title}</span>
                  {m.month && <span className="font-mono text-[10.5px] text-faint">M{m.month}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-12 md:grid-cols-3">
        <ListEditor label="Bugs & what broke" items={p.bugs} onChange={(bugs) => save({ bugs })} placeholder="A bug worth remembering" />
        <ListEditor label="Technical decisions" items={p.decisions} onChange={(decisions) => save({ decisions })} placeholder="Chose X over Y because…" />
        <ListEditor label="Learning outcomes" items={p.learningOutcomes} onChange={(learningOutcomes) => save({ learningOutcomes })} placeholder="What this taught you" />
      </div>

      <label className="flex items-center gap-3 text-[13.5px] text-muted">
        <input type="checkbox" checked={p.showcase} onChange={(e) => save({ showcase: e.target.checked })} className="accent-[#9dff50]" />
        Show on my public showcase
      </label>
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (xs: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  return (
    <section>
      <Label className="mb-3">{label}</Label>
      <ul className="space-y-2">
        {items.map((x, i) => (
          <li key={i} className="group flex gap-2 text-[13.5px] leading-relaxed text-fg">
            <span className="mt-[9px] h-px w-2 shrink-0 bg-white/30" />
            <span className="flex-1">{x}</span>
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100" aria-label="Remove">
              <X className="size-3 text-faint hover:text-bad" />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([...items, draft.trim()]);
          setDraft("");
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="field-input text-[13px]" />
        <button className="text-faint hover:text-accent" aria-label="Add">
          <Plus className="size-4" />
        </button>
      </form>
    </section>
  );
}
