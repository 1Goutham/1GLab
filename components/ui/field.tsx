import { cn } from "@/lib/cn";

/**
 * Underline fields from the portfolio's contact form: a hairline that
 * brightens on focus. Style inputs inside with `field-input`.
 */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("group block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint transition-colors group-focus-within:text-muted">
        {label}
        {hint && <span className="normal-case tracking-normal text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
