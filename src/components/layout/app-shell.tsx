import * as React from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader, MobileBottomNav } from "./mobile-nav";

interface AppShellProps {
  children: React.ReactNode;
  displayName?: string;
}

export function AppShell({ children, displayName }: AppShellProps) {
  return (
    <div className="app-canvas min-h-dvh text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">Ke konten utama</a>
      {/* Desktop Left Sidebar */}
      <Sidebar displayName={displayName} />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="min-w-0 pt-16 pb-[calc(6rem+env(safe-area-inset-bottom))] md:py-10 md:pl-60 lg:pl-64">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 md:py-0 lg:px-10">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
