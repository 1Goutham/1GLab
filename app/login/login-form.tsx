"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <form action={formAction} className="mt-10 space-y-6">
      <input type="hidden" name="next" value={next} />
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className="field-input" />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className="field-input" />
      </Field>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
      <Button variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Enter the OS"}
      </Button>
    </form>
  );
}
