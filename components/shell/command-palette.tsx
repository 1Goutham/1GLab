"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Binary,
  BookOpen,
  FolderKanban,
  NotebookPen,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Search,
  CornerDownLeft,
  CalendarRange,
} from "lucide-react";
import { NAV } from "./nav";
import { Kbd } from "@/components/ui/primitives";
import type { SearchHit } from "@/app/api/search/route";

const OPEN = "aios:palette";
export function openPalette() {
  window.dispatchEvent(new Event(OPEN));
}

type Ctx = { continueHref: string | null; missionHref: string | null; missionFocus: string | null; projects: { id: string; name: string }[] };

/**
 * ⌘K. Every important action is two keystrokes away. Also owns the global
 * "g <key>" navigation shortcuts and "?" for the shortcut sheet.
 */
export function CommandPalette({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [help, setHelp] = useState(false);
  const pendingG = useRef<number>(0);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        setHelp((h) => !h);
        return;
      }
      if (e.key === "Escape") setHelp(false);
      if (e.key === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 900) {
        const item = NAV.find((n) => n.key === e.key);
        pendingG.current = 0;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
      }
    };
    window.addEventListener(OPEN, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setHits((await res.json()).hits);
      } catch {
        /* aborted */
      }
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const actions = [
    { label: "Go to today's mission", icon: Target, href: "/", hint: "g h" },
    ctx.missionFocus && { label: "Start focus session", icon: Timer, href: ctx.missionFocus },
    ctx.continueHref && { label: "Continue learning", icon: BookOpen, href: ctx.continueHref },
    { label: "Start DSA", icon: Binary, href: ctx.missionHref ?? "/dsa" },
    { label: "Start review", icon: RotateCcw, href: "/review" },
    { label: "Ask AI mentor", icon: Sparkles, href: "/mentor" },
    { label: "Add task", icon: Plus, href: "/tasks?new=1" },
    { label: "Plan my week", icon: CalendarRange, href: "/tasks?plan=1" },
    { label: "Log learning", icon: NotebookPen, href: "/journal" },
    { label: "Add note", icon: NotebookPen, href: "/journal?note=1" },
  ].filter(Boolean) as { label: string; icon: typeof Target; href: string; hint?: string }[];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-line-strong bg-[#0c0c0f] shadow-2xl shadow-black/70"
            >
              <Command label="Command palette" shouldFilter={true} loop>
                <div className="flex items-center gap-3 border-b border-line px-4">
                  <Search className="size-4 text-faint" />
                  <Command.Input
                    autoFocus
                    value={q}
                    onValueChange={setQ}
                    placeholder="Search lessons, problems, notes — or type a command"
                    className="h-13 flex-1 bg-transparent py-4 text-[15px] text-fg outline-none placeholder:text-faint"
                    onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                  />
                  <Kbd>esc</Kbd>
                </div>
                <Command.List className="max-h-[58vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-faint">
                  <Command.Empty className="px-4 py-8 text-center text-sm text-muted">Nothing found. Try a concept, like “attention”.</Command.Empty>
                  {hits.length > 0 && (
                    <Command.Group heading="Results">
                      {hits.map((h, i) => (
                        <Item key={`${h.href}-${i}`} value={`${h.title} ${h.type} ${q}`} onSelect={() => go(h.href)}>
                          <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase text-faint">{h.type}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-fg">{h.title}</span>
                            <span className="block truncate text-xs text-faint">{h.subtitle}</span>
                          </span>
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                  <Command.Group heading="Actions">
                    {actions.map((a) => (
                      <Item key={a.label} value={a.label} onSelect={() => go(a.href)}>
                        <a.icon className="size-4 text-faint" strokeWidth={1.6} />
                        <span className="flex-1 text-fg">{a.label}</span>
                        {a.hint && <span className="font-mono text-[10.5px] text-faint">{a.hint}</span>}
                      </Item>
                    ))}
                  </Command.Group>
                  {ctx.projects.length > 0 && (
                    <Command.Group heading="Open project">
                      {ctx.projects.map((p) => (
                        <Item key={p.id} value={`project ${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
                          <FolderKanban className="size-4 text-faint" strokeWidth={1.6} />
                          <span className="flex-1 text-fg">{p.name}</span>
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                  <Command.Group heading="Navigate">
                    {NAV.map((n) => (
                      <Item key={n.href} value={`go ${n.label}`} onSelect={() => go(n.href)}>
                        <n.icon className="size-4 text-faint" strokeWidth={1.6} />
                        <span className="flex-1 text-fg">{n.label}</span>
                        <span className="font-mono text-[10.5px] text-faint">g {n.key}</span>
                      </Item>
                    ))}
                  </Command.Group>
                </Command.List>
                <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[10.5px] text-faint">
                  <span className="flex items-center gap-1.5">
                    <CornerDownLeft className="size-3" /> select
                  </span>
                  <span>? for shortcuts</span>
                </div>
              </Command>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {help && (
          <motion.div
            className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelp(false)}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md rounded-2xl border border-line-strong bg-[#0c0c0f] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Keyboard</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                <span className="text-muted">Command palette</span>
                <span className="text-right">
                  <Kbd>⌘</Kbd> <Kbd>K</Kbd>
                </span>
                {NAV.map((n) => (
                  <Row key={n.href} label={n.label} k={n.key} />
                ))}
                <span className="text-muted">This sheet</span>
                <span className="text-right">
                  <Kbd>?</Kbd>
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ label, k }: { label: string; k: string }) {
  return (
    <>
      <span className="text-muted">{label}</span>
      <span className="text-right">
        <Kbd>g</Kbd> <Kbd>{k}</Kbd>
      </span>
    </>
  );
}

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm data-[selected=true]:bg-white/[0.06]"
    >
      {children}
      <ArrowRight className="size-3.5 text-faint opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
