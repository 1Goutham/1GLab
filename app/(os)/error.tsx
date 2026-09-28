"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OSError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Something slipped</div>
      <h1 className="mt-4 font-display text-3xl font-light text-white">This screen hit a snag.</h1>
      <p className="mt-3 text-muted">
        Nothing you&apos;ve done is lost — progress is saved as you go. Try again, and if the database is unreachable, check that Postgres is running.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button onClick={() => (window.location.href = "/")}>Back to today</Button>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-faint">ref {error.digest}</p>}
    </div>
  );
}
