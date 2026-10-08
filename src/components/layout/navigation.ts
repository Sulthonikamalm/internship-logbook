import { House, CalendarCheck2, CalendarDays, KanbanSquare, Images, BookOpen, FileSpreadsheet, Plug, Settings, Users, Clock3 } from "lucide-react";

export const navigationItems = [
  { name: "Home", href: "/dashboard", icon: House, group: "work" },
  { name: "Activity", href: "/activities", icon: CalendarCheck2, group: "work" },
  { name: "Todo", href: "/todos", icon: KanbanSquare, group: "work" },
  { name: "Evidence", href: "/evidence", icon: Images, group: "work" },
  { name: "Logbook", href: "/logbook", icon: BookOpen, group: "tools" },
  { name: "Absen", href: "/attendance", icon: Clock3, group: "tools" },
  { name: "Reports", href: "/reports", icon: FileSpreadsheet, group: "tools" },
  { name: "Kalender", href: "/calendar", icon: CalendarDays, group: "tools" },
  { name: "Integrasi", href: "/integrations", icon: Plug, group: "tools" },
  { name: "Settings", href: "/settings", icon: Settings, group: "tools" },
] as const;

export function getNavigationItems(isSuperAdmin = false) {
  return [...navigationItems, ...(isSuperAdmin ? [{ name: "Pengguna", href: "/admin/users", icon: Users, group: "tools" as const }] : [])];
}

export function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
