"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Settings, Search } from "lucide-react";
import { NAV, isActive } from "./nav";
import { cn } from "@/lib/cn";
import { Kbd } from "@/components/ui/primitives";
import { openPalette } from "./command-palette";

export function Sidebar({ day, dueReviews, ai }: { day: number; dueReviews: number; ai: { online: boolean; provider: string } }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-line bg-bg/80 backdrop-blur-xl lg:flex">
      <Link href="/" className="group flex items-center gap-3 px-5 pb-6 pt-6">
        <span className="grid size-8 place-items-center rounded-lg border border-line-strong bg-white/[0.03] font-display text-[15px] font-semibold tracking-tight">
          1<span className="text-accent">G</span>
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[14px] text-fg">AI Engineering OS</span>
          <span className="block font-mono text-[10.5px] text-faint">Day {day} / 180</span>
        </span>
      </Link>

      <button
        onClick={openPalette}
        className="tactile mx-3 mb-4 flex h-9 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 text-[13px] text-faint hover:border-line-strong hover:text-muted"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or command</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Primary">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors",
                active ? "text-white" : "text-muted hover:text-fg",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg border border-line-strong bg-white/[0.045]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("relative size-4", active ? "text-accent" : "text-faint group-hover:text-muted")} strokeWidth={1.6} />
              <span className="relative flex-1">{item.label}</span>
              {item.href === "/review" && dueReviews > 0 && (
                <span className="relative rounded-full bg-accent/15 px-1.5 font-mono text-[10px] text-accent">{dueReviews}</span>
              )}
              <span className="relative hidden font-mono text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100 xl:inline">g {item.key}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <Link href="/settings" className={cn("flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] text-muted hover:text-fg", pathname === "/settings" && "text-fg")}>
          <Settings className="size-4 text-faint" strokeWidth={1.6} />
          Settings
        </Link>
        <div className="mt-1 flex items-center gap-2 px-3 font-mono text-[10.5px] text-faint" title={ai.online ? `Mentor online via ${ai.provider}` : "No AI key configured — mentor answers from your curriculum"}>
          <span className={cn("size-1.5 rounded-full", ai.online ? "pulse-dot bg-accent" : "bg-faint")} />
          mentor {ai.online ? `· ${ai.provider}` : "· offline mode"}
        </div>
      </div>
    </aside>
  );
}
