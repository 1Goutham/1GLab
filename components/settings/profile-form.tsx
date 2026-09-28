"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/lib/actions/settings";
import { toast } from "@/components/shell/toaster";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type V = {
  currentLevel: string;
  dailyMinutes: number;
  mainGoal: string;
  currentProjects: string;
  dsaConfidence: number;
  aiConfidence: number;
  startDate: string;
  timezone: string;
  showcasePublic: boolean;
};

export function ProfileForm({ initial }: { initial: V }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await updateProfile(v);
      toast(res.ok ? { title: "Saved", body: "Tomorrow's mission will use this.", tone: "neutral" } : { title: res.error, tone: "bad" });
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-7"
    >
      <Field label="Current level">
        <input className="field-input" value={v.currentLevel} onChange={(e) => setV({ ...v, currentLevel: e.target.value })} />
      </Field>
      <Field label="Main goal">
        <textarea rows={2} className="field-input" value={v.mainGoal} onChange={(e) => setV({ ...v, mainGoal: e.target.value })} />
      </Field>
      <Field label="Current projects">
        <input className="field-input" value={v.currentProjects} onChange={(e) => setV({ ...v, currentProjects: e.target.value })} />
      </Field>
      <div className="grid gap-7 sm:grid-cols-2">
        <Field label="Daily minutes" hint={`${Math.floor(v.dailyMinutes / 60)}h ${v.dailyMinutes % 60}m`}>
          <input type="range" min={45} max={360} step={15} value={v.dailyMinutes} onChange={(e) => setV({ ...v, dailyMinutes: Number(e.target.value) })} className="mt-3 w-full accent-[#9dff50]" />
        </Field>
        <Field label="Program start date">
          <input type="date" className="field-input" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
        </Field>
        <Field label="DSA confidence (1-5)">
          <input type="number" min={1} max={5} className="field-input" value={v.dsaConfidence} onChange={(e) => setV({ ...v, dsaConfidence: Number(e.target.value) })} />
        </Field>
        <Field label="AI confidence (1-5)">
          <input type="number" min={1} max={5} className="field-input" value={v.aiConfidence} onChange={(e) => setV({ ...v, aiConfidence: Number(e.target.value) })} />
        </Field>
        <Field label="Timezone">
          <input className="field-input" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-[14px] text-muted">
        <input type="checkbox" checked={v.showcasePublic} onChange={(e) => setV({ ...v, showcasePublic: e.target.checked })} className="accent-[#9dff50]" />
        Make the showcase public (projects, labs, skills — never the journal)
      </label>
      <Button variant="primary" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
