"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Ellipsis, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Brand } from "./brand";
import { navigationItems, isCurrentPath } from "./navigation";

export function MobileHeader() {
  return <header className="glass-panel fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b px-4 md:hidden">
    <Brand /><Link href="/settings" aria-label="Settings" className="pressable flex size-11 items-center justify-center rounded-full text-muted-foreground"><Settings size={21} /></Link>
  </header>;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const toolsActive = navigationItems.some(item => item.group === "tools" && isCurrentPath(pathname, item.href));
  return <>
    <nav aria-label="Navigasi mobile" className="glass-panel fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="grid grid-cols-5">
        {navigationItems.filter(item => item.group === "work").map(item => {
          const active = isCurrentPath(pathname, item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("pressable flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}><item.icon size={21} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />{item.name}</Link>;
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen} className={cn("pressable flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium", toolsActive ? "text-primary" : "text-muted-foreground")}><Ellipsis size={21} aria-hidden="true" />More</button>
      </div>
    </nav>
    <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Tools">
      <div className="grid grid-cols-2 gap-3">
        {navigationItems.filter(item => item.group === "tools").map(item => <Link href={item.href} key={item.href} onClick={() => setMoreOpen(false)} className="pressable surface flex min-h-24 flex-col justify-center gap-3 p-4 text-sm font-medium"><item.icon className="text-primary" size={23} aria-hidden="true" />{item.name}</Link>)}
      </div>
      <div className="mt-5 border-t border-border pt-3"><LogoutButton /></div>
    </Modal>
  </>;
}
