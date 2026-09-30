import * as React from "react";
import { Sidebar } from "./sidebar";
import { MobileHeader, MobileBottomNav } from "./mobile-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Mobile Top Header */}
      <MobileHeader />

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 pt-14 md:pt-0 pb-20 md:pb-8 transition-all">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
