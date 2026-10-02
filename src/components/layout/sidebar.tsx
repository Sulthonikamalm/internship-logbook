"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Brand } from "./brand";
import { navigationItems, isCurrentPath } from "./navigation";

export { navigationItems } from "./navigation";

export function Sidebar({ displayName }: { displayName?: string }) {
  const pathname = usePathname();
  return <aside className="glass-panel fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r md:flex lg:w-64">
    <div className="px-6 pt-6 pb-5"><Brand /></div>
    <div className="px-5 pb-7"><Button asChild className="w-full gap-2"><Link href="/activities/new?quick=1"><Plus size={18} />Catat activity</Link></Button></div>
    <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-4">
      {(["work", "tools"] as const).map(group => <div key={group} className="mb-7 space-y-1">
        <p className="eyebrow px-3 pb-2">{group === "work" ? "Workspace" : "Kelola"}</p>
        {navigationItems.filter(item => item.group === group).map(item => {
          const active = isCurrentPath(pathname, item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/70 hover:text-foreground")}>
            <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />{item.name}
          </Link>;
        })}
      </div>)}
    </nav>
    <div className="mx-5 border-t border-border py-5">
      {displayName && <p className="mb-2 truncate px-2 text-sm font-medium">{displayName}</p>}
      <LogoutButton />
    </div>
  </aside>;
}
