import Link from "next/link";
import { cn } from "@/lib/utils";
import { WORK_CATEGORIES, categoryLabels, type WorkCategory } from "../domain/category";

export function CategoryTabs({ value, href, params = {}, all = false }: { value: WorkCategory | "ALL"; href: string; params?: Record<string, string>; all?: boolean }) {
  const choices = all ? ["ALL" as const, ...WORK_CATEGORIES] : WORK_CATEGORIES;
  return <nav aria-label="Kategori kegiatan" className="glass-panel flex flex-wrap gap-1 rounded-2xl p-1.5">
    {choices.map(category => {
      const query = new URLSearchParams({ ...params, category });
      return <Link key={category} href={`${href}?${query}`} aria-current={value === category ? "page" : undefined}
        className={cn("flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-3 text-center text-sm font-medium transition-colors", value === category ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/70")}>{category === "ALL" ? "Semua" : categoryLabels[category]}</Link>;
    })}
  </nav>;
}
