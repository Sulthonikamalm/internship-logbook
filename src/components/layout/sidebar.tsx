"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck2,
  KanbanSquare,
  Image as ImageIcon,
  BookOpen,
  FileSpreadsheet,
  Link2,
  Settings,
  PlusCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/components/logout-button";

export const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Activity", href: "/activities", icon: CalendarCheck2 },
  { name: "Todo Kanban", href: "/todos", icon: KanbanSquare },
  { name: "Evidence", href: "/evidence", icon: ImageIcon },
  { name: "Logbook", href: "/logbook", icon: BookOpen },
  { name: "Reports", href: "/reports", icon: FileSpreadsheet },
  { name: "Integrasi", href: "/integrations", icon: Link2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r border-border bg-card">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
            IF
          </div>
          <div>
            <span className="font-bold text-lg text-foreground tracking-tight">
              Intern<span className="text-primary">Flow</span>
            </span>
            <span className="block text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
              Logbook & Evidence
            </span>
          </div>
        </Link>
      </div>

      {/* Quick Action Button */}
      <div className="p-4">
        <Button asChild className="w-full justify-start gap-2 shadow-sm font-medium">
          <Link href="/activities/new?quick=1">
            <PlusCircle className="h-4 w-4" />
            <span>+ Quick Activity</span>
          </Link>
        </Button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer / System Status */}
      <div className="border-t border-border p-4 bg-muted/30">
        <LogoutButton />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>Internship Period: 2026</span>
        </div>
      </div>
    </aside>
  );
}
