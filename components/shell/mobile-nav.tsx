"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, Search } from "lucide-react";
import { NAV, isActive } from "./nav";
import { cn } from "@/lib/cn";
import { openPalette } from "./command-palette";

export function MobileTopBar({ day }: { day: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center whitespace-nowrap rounded-md border border-line-strong font-display text-[12px] font-semibold">
            <span>1<span className="text-accent">G</span></span>
          </span>
          <span className="font-mono text-[11px] text-faint">Day {day}/180</span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={openPalette} className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Search">
            <Search className="size-4" />
          </button>
          <button onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Menu">
            <Menu className="size-4" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-xl lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex h-14 items-center justify-end px-4">
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="px-6">
              {[...NAV, { href: "/settings", label: "Settings", icon: X, key: "," }].map((item, i) => (
                <motion.div key={item.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex items-baseline gap-4 border-b border-line py-3.5 font-display text-2xl font-light", isActive(pathname, item.href) ? "text-accent" : "text-fg")}
                  >
                    <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.mobile);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Primary mobile">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]", active ? "text-accent" : "text-faint")}>
            <Icon className="size-[18px]" strokeWidth={1.6} />
            {item.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
