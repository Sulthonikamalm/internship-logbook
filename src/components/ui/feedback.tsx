import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

export function Feedback({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" | "info" | "warning" }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return <div className="state-feedback" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div className="min-w-0 break-words">{children}</div>
  </div>;
}
