"use client";

import * as React from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

export function ThemePreferenceCard() {
  const { theme, setTheme, resolvedTheme, mounted } = useTheme();

  const options: Array<{
    id: Theme;
    label: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [
    {
      id: "light",
      label: "Terang",
      description: "Tampilan bersih & kontras cerah di siang hari.",
      icon: Sun,
    },
    {
      id: "dark",
      label: "Gelap (Malam)",
      description: "Nyaman di mata saat malam, hemat daya baterai.",
      icon: Moon,
    },
    {
      id: "system",
      label: "Sistem",
      description: "Mengikuti otomatis mode perangkat / OS.",
      icon: Laptop,
    },
  ];

  return (
    <section className="surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Tampilan & Mode Malam</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Peralihan tema menggunakan efek gelombang lembut (wave ripple).
          </p>
        </div>
        {mounted && (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-primary">
            Aktif: {resolvedTheme === "dark" ? "Gelap" : "Terang"}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = mounted && theme === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={(e) => setTheme(option.id, e)}
              className={cn(
                "pressable flex min-h-24 flex-col justify-between rounded-2xl border p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl",
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon size={18} />
                </div>
                {isSelected && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-snug">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
