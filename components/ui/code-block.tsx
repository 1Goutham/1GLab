import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";

/**
 * A tiny, dependency-free highlighter: comments, strings, numbers, keywords
 * and call sites. Enough to make code scannable without shipping a grammar
 * engine to the client — it runs on the server.
 */
const KEYWORDS: Record<string, string[]> = {
  python: "def class return if elif else for while in not and or import from as with try except finally raise yield async await lambda None True False pass break continue global self is".split(" "),
  typescript:
    "const let var function return if else for while of in new class extends import from export default async await try catch finally throw type interface as typeof null undefined true false this switch case break continue".split(" "),
  sql: "SELECT FROM WHERE JOIN LEFT RIGHT INNER ON GROUP BY ORDER LIMIT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX PRIMARY KEY REFERENCES AND OR NOT NULL AS WITH BEGIN COMMIT ROLLBACK EXPLAIN ANALYZE UNIQUE DEFAULT HAVING DISTINCT USING".split(" "),
  bash: "if then fi for do done echo export cd sudo curl docker npm pip python git".split(" "),
};
KEYWORDS.javascript = KEYWORDS.typescript;

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlight(code: string, lang: string): string {
  const kw = KEYWORDS[lang] ?? [];
  const comment = lang === "python" || lang === "bash" || lang === "yaml" || lang === "dockerfile" ? "#[^\\n]*" : lang === "sql" ? "--[^\\n]*" : "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
  const re = new RegExp(
    `(${comment})|("""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Za-z_][A-Za-z0-9_]*\\b)(?=\\s*\\()|(\\b[A-Za-z_][A-Za-z0-9_]*\\b)`,
    "g",
  );
  let out = "";
  let last = 0;
  for (const m of code.matchAll(re)) {
    out += escape(code.slice(last, m.index));
    last = m.index! + m[0].length;
    const t = escape(m[0]);
    if (m[1]) out += `<span class="tok-c">${t}</span>`;
    else if (m[2]) out += `<span class="tok-s">${t}</span>`;
    else if (m[3]) out += `<span class="tok-n">${t}</span>`;
    else if (m[4]) out += kw.includes(m[4]) ? `<span class="tok-k">${t}</span>` : `<span class="tok-f">${t}</span>`;
    else if (m[5]) out += kw.includes(m[5]) || (lang === "sql" && kw.includes(m[5].toUpperCase())) ? `<span class="tok-k">${t}</span>` : t;
  }
  return out + escape(code.slice(last));
}

export function CodeBlock({
  code,
  lang,
  title,
  variant,
  note,
  compact,
}: {
  code: string;
  lang: string;
  title?: string;
  variant?: "bad" | "good";
  note?: string;
  compact?: boolean;
}) {
  return (
    <figure
      className={cn(
        "group/code relative overflow-hidden rounded-xl border bg-[#08080a]",
        variant === "bad" ? "border-bad/25" : variant === "good" ? "border-accent/25" : "border-line",
      )}
    >
      {(title || !compact) && (
        <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {variant && (
              <span className={cn("font-mono text-[10px] font-semibold tracking-widest", variant === "bad" ? "text-bad" : "text-accent")}>
                {variant === "bad" ? "BAD" : "GOOD"}
              </span>
            )}
            <span className="truncate font-mono text-[12px] text-muted">{title ?? lang}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{lang}</span>
            <CopyButton text={code} />
          </div>
        </figcaption>
      )}
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] text-[#e4e4e8]">
        <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
      </pre>
      {compact && !title && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/code:opacity-100">
          <CopyButton text={code} />
        </div>
      )}
      {note && <p className="border-t border-line px-4 py-2.5 text-[13px] leading-relaxed text-muted">{note}</p>}
    </figure>
  );
}
