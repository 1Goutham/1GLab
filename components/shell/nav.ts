import {
  Home,
  Map,
  BookOpen,
  FlaskConical,
  Binary,
  FolderKanban,
  RotateCcw,
  NotebookPen,
  Activity,
  Sparkles,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; key: string; mobile?: boolean };

/** Primary navigation. `key` is the second key of the "g <key>" shortcut. */
export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, key: "h", mobile: true },
  { href: "/tasks", label: "Tasks & Plan", icon: ListChecks, key: "t", mobile: true },
  { href: "/roadmap", label: "Roadmap", icon: Map, key: "r" },
  { href: "/learn", label: "Learn", icon: BookOpen, key: "l" },
  { href: "/labs", label: "Labs", icon: FlaskConical, key: "b" },
  { href: "/dsa", label: "DSA", icon: Binary, key: "d", mobile: true },
  { href: "/projects", label: "Projects", icon: FolderKanban, key: "p" },
  { href: "/review", label: "Review", icon: RotateCcw, key: "v" },
  { href: "/journal", label: "Journal", icon: NotebookPen, key: "j", mobile: true },
  { href: "/progress", label: "Progress", icon: Activity, key: "g" },
  { href: "/mentor", label: "AI Mentor", icon: Sparkles, key: "m", mobile: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
