"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "button" | "menu-item";
  showLabel?: boolean;
}

export function ThemeToggle({
  className,
  variant = "icon",
  showLabel = false,
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  const isDark = mounted ? resolvedTheme === "dark" : false;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    toggleTheme(e);
  };

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "pressable flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors hover:bg-muted text-muted-foreground hover:text-foreground",
          className
        )}
        aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode malam"}
      >
        <span className="flex items-center gap-3">
          <span className="relative flex size-5 items-center justify-center">
            {isDark ? (
              <Sun size={19} strokeWidth={1.8} className="text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
            ) : (
              <Moon size={19} strokeWidth={1.8} className="text-primary transition-transform duration-300 rotate-0 scale-100" />
            )}
          </span>
          <span>{isDark ? "Mode malam (Aktif)" : "Mode malam (Nonaktif)"}</span>
        </span>
        <span className="text-xs text-muted-foreground font-normal">
          {isDark ? "Gelap" : "Terang"}
        </span>
      </button>
    );
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "pressable inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted hover:border-primary/40",
          className
        )}
        aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode malam"}
      >
        <span className="relative flex size-4 items-center justify-center overflow-hidden">
          <Sun
            size={16}
            className={cn(
              "absolute transition-all duration-300 text-amber-500",
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            )}
          />
          <Moon
            size={16}
            className={cn(
              "absolute transition-all duration-300 text-primary",
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            )}
          />
        </span>
        {showLabel && <span>{isDark ? "Mode Terang" : "Mode Malam"}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "pressable relative flex size-10 items-center justify-center rounded-xl border border-border/80 bg-card/80 text-foreground backdrop-blur-md shadow-xs transition-all hover:bg-card hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className
      )}
      title={isDark ? "Beralih ke mode terang (gelombang)" : "Beralih ke mode malam (gelombang)"}
      aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode malam"}
    >
      <span className="relative flex size-5 items-center justify-center">
        <Sun
          size={18}
          strokeWidth={2}
          className={cn(
            "absolute text-amber-400 transition-all duration-300 ease-out",
            isDark
              ? "rotate-0 scale-100 opacity-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              : "-rotate-90 scale-0 opacity-0"
          )}
        />
        <Moon
          size={18}
          strokeWidth={2}
          className={cn(
            "absolute text-primary transition-all duration-300 ease-out",
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
      <span className="sr-only">
        {isDark ? "Ganti ke mode terang" : "Ganti ke mode malam"}
      </span>
    </button>
  );
}
