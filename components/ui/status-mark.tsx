import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Topic / lab state at a glance: empty ring, half ring, lime check. */
export function StatusMark({ status, className }: { status: string; className?: string }) {
  if (status === "completed")
    return (
      <span className={cn("grid size-[18px] place-items-center rounded-full bg-accent", className)} title="Completed">
        <Check className="size-3 text-accent-ink" strokeWidth={3} />
      </span>
    );
  if (status === "learning" || status === "practised" || status === "in_progress")
    return (
      <span className={cn("relative size-[18px] rounded-full border border-accent/60", className)} title={status === "practised" ? "Mini task done" : "In progress"}>
        <span className={cn("absolute inset-[3px] rounded-full bg-accent/70", status !== "practised" && "[clip-path:inset(0_50%_0_0)]")} />
      </span>
    );
  return <span className={cn("size-[18px] rounded-full border border-line-strong", className)} title="Not started" />;
}
