import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="surface flex flex-col items-center px-6 py-12 text-center">
    <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon size={22} aria-hidden="true" /></span>
    <h2 className="font-semibold">{title}</h2>{description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>;
}
