import type { ReactNode } from "react";

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: ReactNode; eyebrow?: string }) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div className="min-w-0">{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h1 className="break-words text-[1.75rem] font-semibold leading-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}</div>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </header>;
}
