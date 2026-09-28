import Link from "next/link";
import { Check, Timer } from "lucide-react";
import type { MissionItem } from "@/lib/engine/mission";
import { Bracket, DOMAIN_COLOR, Difficulty } from "@/components/ui/primitives";
import { formatMinutes } from "@/lib/engine/dates";
import { focusHref } from "@/lib/focus";
import { cn } from "@/lib/cn";

export function MissionList({ items }: { items: MissionItem[] }) {
  return (
    <ol className="border-b border-line">
      {items.map((m, i) => (
        <li key={m.kind + m.title} className="row-line rise group border-t border-line" style={{ ["--i" as string]: i }}>
          <div className="grid grid-cols-[44px_1fr] gap-x-4 py-6 md:grid-cols-[64px_1fr_auto] md:gap-x-6 md:py-7">
            <div className="row-index pt-0.5 font-mono text-[13px] text-faint">
              {m.done ? <Check className="size-4 text-accent" /> : String(i + 1).padStart(2, "0")}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[10.5px] tracking-[0.16em]" style={{ color: DOMAIN_COLOR[m.domain] ?? "var(--fg-muted)" }}>
                  {m.label}
                </span>
                {m.difficulty && <Difficulty level={m.difficulty} />}
                {m.minutes > 0 && <span className="font-mono text-[11px] text-faint">{formatMinutes(m.minutes)}</span>}
              </div>
              <h3 className={cn("mt-2 font-display text-[22px] font-light leading-snug tracking-tight md:text-[26px]", m.done ? "text-muted line-through decoration-white/20" : "text-white")}>
                <Link href={m.href} className="hover:text-accent">
                  {m.title}
                </Link>
              </h3>
              <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
                <span className="text-faint">Mission — </span>
                {m.mission}
              </p>
              {m.why && !m.done && (
                <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-faint">
                  <span className="text-muted">Why this —</span> {m.why}
                </p>
              )}
              <div className="mt-4 flex items-center gap-5 md:hidden">
                <Bracket href={m.href}>{m.done ? "Open" : m.cta}</Bracket>
                {m.focus && !m.done && (
                  <Link href={focusHref(m.focus, m.minutes, m.mission)} className="flex items-center gap-1.5 font-mono text-[12px] text-faint hover:text-fg">
                    <Timer className="size-3.5" /> focus
                  </Link>
                )}
              </div>
            </div>

            <div className="hidden flex-col items-end justify-between gap-3 md:flex">
              <Bracket href={m.href} className="text-[13.5px]">
                {m.done ? "Open" : m.cta}
              </Bracket>
              {m.focus && !m.done && (
                <Link
                  href={focusHref(m.focus, m.minutes, m.mission)}
                  className="flex items-center gap-1.5 font-mono text-[11.5px] text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
                  title="Start a distraction-free focus session"
                >
                  <Timer className="size-3.5" /> focus mode
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
