import { cn } from "@/lib/utils";
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return <div role="status" aria-label="Memuat halaman" className="space-y-6"><span className="sr-only">Memuat…</span><div className="space-y-3"><div className="skeleton h-8 w-40 rounded-lg" /><div className="skeleton h-4 w-56 rounded-lg" /></div><div className="surface space-y-5 p-5">{Array.from({ length: rows }, (_, index) => <div key={index} className="flex gap-4"><div className="skeleton size-11 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><div className={cn("skeleton h-4 rounded-md", index % 2 ? "w-2/3" : "w-4/5")} /><div className="skeleton h-3 w-1/2 rounded-md" /></div></div>)}</div></div>;
}
