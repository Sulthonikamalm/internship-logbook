import * as React from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader, MobileBottomNav } from "./mobile-nav";
import { ScrollReset } from "./scroll-reset";

interface AppShellProps {
  children: React.ReactNode;
  displayName?: string;
  isSuperAdmin?: boolean;
}

export function AppShell({ children, displayName, isSuperAdmin }: AppShellProps) {
  return (
    <div className="app-canvas flex h-dvh flex-col overflow-hidden text-foreground">
      <ScrollReset />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">Ke konten utama</a>
      {/* Desktop Left Sidebar */}
      <Sidebar displayName={displayName} isSuperAdmin={isSuperAdmin} />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-10 md:pl-60 lg:pl-64">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 md:py-0 lg:px-10">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
