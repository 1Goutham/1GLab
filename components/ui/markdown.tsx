import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";
import { CodeBlock } from "./code-block";

/**
 * Safe Markdown. Raw HTML is never rendered (react-markdown escapes it by
 * default and we add no rehype-raw), link protocols are restricted, and
 * external links open in a new tab without an opener.
 */
const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-os", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (SAFE_URL.test(url) ? url : "")}
        components={{
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          pre: ({ children }) => <>{children}</>,
          code: ({ className: cls, children }) => {
            const lang = /language-(\w+)/.exec(cls ?? "")?.[1];
            const text = String(children ?? "");
            if (lang || text.includes("\n")) return <CodeBlock code={text.replace(/\n$/, "")} lang={lang ?? "text"} compact />;
            return <code>{children}</code>;
          },
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
