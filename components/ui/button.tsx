import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-[#b4ff7c] font-medium",
  secondary: "border border-line-strong bg-white/[0.02] text-fg hover:border-white/25 hover:bg-white/[0.05]",
  ghost: "text-muted hover:text-fg hover:bg-white/[0.04]",
  danger: "border border-bad/30 text-bad hover:bg-bad/10",
};

type Common = { variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode };

const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };

export function Button({ variant = "secondary", size = "md", className, children, ...rest }: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "tactile inline-flex items-center justify-center rounded-lg whitespace-nowrap disabled:pointer-events-none disabled:opacity-40",
        styles[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", size = "md", className, children, ...rest }: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^https?:/.test(href);
  const cls = cn("tactile group inline-flex items-center justify-center rounded-lg whitespace-nowrap", styles[variant], sizes[size], className);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
