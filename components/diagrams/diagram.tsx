import { Fragment } from "react";
import type { Diagram as DiagramSpec, DiagramNode } from "@/content/types";
import { cn } from "@/lib/cn";

/**
 * Renders curriculum diagrams as crisp HTML/SVG — no images. Each shape shows
 * a real mechanism: flows (with before/after lanes), cycles, layer stacks,
 * side-by-side comparisons and heatmaps.
 */
export function Diagram({ spec, className }: { spec: DiagramSpec; className?: string }) {
  return (
    <figure className={cn("rounded-xl border border-line bg-[#08080a] p-5 md:p-6", className)}>
      {spec.title && <figcaption className="mb-5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{spec.title}</figcaption>}
      {spec.type === "flow" && <Flow spec={spec} />}
      {spec.type === "cycle" && <Cycle spec={spec} />}
      {spec.type === "stack" && <Stack spec={spec} />}
      {spec.type === "compare" && <Compare spec={spec} />}
      {spec.type === "grid" && <Grid spec={spec} />}
    </figure>
  );
}

function Node({ node, tone, i }: { node: DiagramNode; tone?: "bad" | "good" | "neutral"; i: number }) {
  return (
    <div
      className={cn(
        "rise relative min-w-[92px] rounded-lg border px-3 py-2 text-center",
        node.accent ? "border-accent/40 bg-accent/[0.07]" : "border-line-strong bg-white/[0.025]",
        tone === "bad" && !node.accent && "border-bad/25",
      )}
      style={{ ["--i" as string]: i }}
    >
      <div className={cn("text-[13px] font-medium", node.accent ? "text-accent" : "text-fg")}>{node.label}</div>
      {node.note && <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-muted">{node.note}</div>}
    </div>
  );
}

function Arrow({ tone }: { tone?: string }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" className="shrink-0 max-md:rotate-90" aria-hidden>
      <path d="M0 6h24" stroke={tone === "bad" ? "rgba(255,107,107,.5)" : "rgba(255,255,255,.28)"} strokeWidth="1.2" />
      <path d="M20 1.5 26 6l-6 4.5" fill="none" stroke={tone === "bad" ? "rgba(255,107,107,.7)" : "rgba(255,255,255,.45)"} strokeWidth="1.2" />
    </svg>
  );
}

function Flow({ spec }: { spec: Extract<DiagramSpec, { type: "flow" }> }) {
  return (
    <div className="space-y-5">
      {spec.lanes.map((lane, li) => (
        <div key={li}>
          {lane.label && (
            <div
              className={cn(
                "mb-2.5 font-mono text-[11px] uppercase tracking-wider",
                lane.tone === "bad" ? "text-bad/80" : lane.tone === "good" ? "text-accent/90" : "text-muted",
              )}
            >
              {lane.label}
            </div>
          )}
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center">
            {lane.steps.map((n, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <div className="flex justify-center">
                    <Arrow tone={lane.tone} />
                  </div>
                )}
                <Node node={n} tone={lane.tone} i={li * 6 + i} />
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Cycle({ spec }: { spec: Extract<DiagramSpec, { type: "cycle" }> }) {
  const n = spec.steps.length;
  const R = 118;
  const C = 160;
  return (
    <div className="flex justify-center">
      <div className="relative h-[320px] w-[320px] max-w-full">
        <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="3 5" />
          {spec.steps.map((_, i) => {
            const a = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
            const x = C + R * Math.cos(a);
            const y = C + R * Math.sin(a);
            const deg = (a * 180) / Math.PI + 90;
            return <path key={i} d="M-4 -3 L2 0 L-4 3" transform={`translate(${x} ${y}) rotate(${deg})`} fill="none" stroke="rgba(157,255,80,.7)" strokeWidth="1.3" />;
          })}
        </svg>
        {spec.center && (
          <div className="absolute left-1/2 top-1/2 max-w-[120px] -translate-x-1/2 -translate-y-1/2 text-center font-display text-sm text-muted">{spec.center}</div>
        )}
        {spec.steps.map((s, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${((C + R * Math.cos(a)) / 320) * 100}%`, top: `${((C + R * Math.sin(a)) / 320) * 100}%` }}>
              <div className="w-[108px] bg-[#08080a]">
                <Node node={s} i={i} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stack({ spec }: { spec: Extract<DiagramSpec, { type: "stack" }> }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-stretch">
      {spec.layers.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <div className="mx-auto h-3 w-px bg-white/20" />}
          <div
            className={cn(
              "rise flex items-baseline justify-between gap-4 rounded-lg border px-4 py-2.5",
              l.accent ? "border-accent/40 bg-accent/[0.07]" : "border-line-strong bg-white/[0.025]",
            )}
            style={{ ["--i" as string]: i }}
          >
            <span className={cn("text-[13.5px] font-medium", l.accent ? "text-accent" : "text-fg")}>{l.label}</span>
            {l.note && <span className="text-right font-mono text-[11px] text-muted">{l.note}</span>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function Compare({ spec }: { spec: Extract<DiagramSpec, { type: "compare" }> }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
      {[spec.left, spec.right].map((side, i) => (
        <div key={i} className="bg-[#08080a] p-4">
          <div className={cn("mb-3 font-display text-[15px]", i === 0 ? "text-fg" : "text-accent")}>{side.label}</div>
          <ul className="space-y-2">
            {side.points.map((p, j) => (
              <li key={j} className="flex gap-2.5 text-[13.5px] leading-snug text-muted">
                <span className="mt-[9px] h-px w-2.5 shrink-0 bg-white/30" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Grid({ spec }: { spec: Extract<DiagramSpec, { type: "grid" }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-separate border-spacing-1 font-mono text-[11px]">
        <thead>
          <tr>
            <th />
            {spec.colLabels.map((c) => (
              <th key={c} className="px-1 pb-1 font-normal text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rowLabels.map((r, i) => (
            <tr key={r + i}>
              <th className="pr-2 text-right font-normal text-muted">{r}</th>
              {spec.colLabels.map((_, j) => {
                const v = spec.values[i]?.[j] ?? 0;
                return (
                  <td
                    key={j}
                    title={v.toFixed(2)}
                    className="h-9 w-11 rounded text-center tabular-nums"
                    style={{ background: `rgba(157,255,80,${0.04 + v * 0.75})`, color: v > 0.45 ? "#0b1600" : "#9b9ba4" }}
                  >
                    {v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {spec.caption && <p className="mt-3 text-center text-[12.5px] text-muted">{spec.caption}</p>}
    </div>
  );
}
