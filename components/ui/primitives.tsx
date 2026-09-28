import Link from "next/link";
import { cn } from "@/lib/cn";

/* Small, composable primitives. Server-safe (no hooks). */

export const DOMAIN_COLOR: Record<string, string> = {
  ai: "var(--d-ai)",
  dsa: "var(--d-dsa)",
  backend: "var(--d-backend)",
  systems: "var(--d-systems)",
  frontend: "var(--d-frontend)",
  product: "var(--d-product)",
  cloud: "var(--d-cloud)",
  security: "var(--d-security)",
};

export const DOMAIN_LABEL: Record<string, string> = {
  ai: "AI",
  dsa: "DSA",
  backend: "Engineering",
  systems: "Systems",
  frontend: "Product",
  product: "Product",
  cloud: "Infra",
  security: "Security",
};

/** "[ Start mission ]" — the portfolio's bracket language, used for primary text actions. */
export function Bracket({
  href,
  children,
  className,
  external,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="bracket-l" aria-hidden>
        [
      </span>
      <span className="bracket-t">{children}</span>
      <span className="bracket-r" aria-hidden>
        ]
      </span>
    </>
  );
  const cls = cn("bracket text-[13px] text-fg", className);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export function Label({ children, className, index }: { children: React.ReactNode; className?: string; index?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint", className)}>
      {index && <span className="text-muted">{index}</span>}
      {index && <span className="h-px w-3 bg-line-strong" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

export function DomainDot({ domain, className }: { domain: string; className?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", className)} style={{ background: DOMAIN_COLOR[domain] ?? "var(--fg-muted)" }} />;
}

export function Chip({ children, className, tone }: { children: React.ReactNode; className?: string; tone?: "accent" | "warn" | "bad" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
        tone === "accent" && "border-accent/30 bg-accent/10 text-accent",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "bad" && "border-bad/30 bg-bad/10 text-bad",
        (!tone || tone === "muted") && "border-line-strong text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A thin, honest meter. `segments` renders the block style used on the engineering map. */
export function Meter({
  value,
  color = "var(--accent)",
  segments,
  className,
  height = 3,
}: {
  value: number;
  color?: string;
  segments?: number;
  className?: string;
  height?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  if (segments) {
    const filled = Math.round((v / 100) * segments);
    return (
      <div className={cn("flex gap-[3px]", className)} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn("h-3 flex-1 rounded-[2px] rise", i < filled ? "" : "bg-white/[0.06]")}
            style={{ background: i < filled ? color : undefined, opacity: i < filled ? 0.35 + (0.65 * (i + 1)) / filled : undefined, ["--i" as string]: i }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-white/[0.06]", className)} style={{ height }} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="meter-fill h-full rounded-full" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-white/[0.03] px-1 font-mono text-[10px] text-muted", className)}>
      {children}
    </kbd>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <Label className="mb-3">{eyebrow}</Label>}
        <h1 className="font-display text-3xl font-light tracking-tight text-white md:text-[40px] md:leading-[1.1]">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </header>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-display text-lg text-fg">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-light tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Difficulty({ level }: { level: "easy" | "medium" | "hard" }) {
  const n = level === "easy" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted" title={`Difficulty: ${level}`}>
      <span className="flex gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-[1px]", i <= n ? "bg-fg/80" : "bg-white/10")} />
        ))}
      </span>
      <span className="capitalize">{level}</span>
    </span>
  );
}

export function Section({ children, className, label, index, action }: { children: React.ReactNode; className?: string; label?: string; index?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("mt-14", className)}>
      {(label || action) && (
        <div className="mb-5 flex items-center justify-between gap-4">
          {label ? <Label index={index}>{label}</Label> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
