export function LogbookSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Banner Skeleton */}
      <div className="h-20 rounded-xl bg-muted/60" />

      {/* Filter Bar Skeleton */}
      <div className="h-16 rounded-xl bg-muted/50" />

      {/* Desktop Table Skeleton */}
      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-11 bg-muted/40 border-b border-border" />
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-4 w-6 rounded bg-muted/70" />
              <div className="h-4 w-28 rounded bg-muted/70" />
              <div className="h-4 w-20 rounded bg-muted/70" />
              <div className="h-4 w-48 rounded bg-muted/70" />
              <div className="h-4 flex-1 rounded bg-muted/50" />
              <div className="h-5 w-24 rounded bg-muted/70" />
              <div className="h-7 w-7 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Cards Skeleton */}
      <div className="md:hidden space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-32 rounded bg-muted/70" />
              <div className="h-4 w-16 rounded bg-muted/70" />
            </div>
            <div className="h-5 w-48 rounded bg-muted/80" />
            <div className="h-3 w-full rounded bg-muted/50" />
            <div className="h-3 w-2/3 rounded bg-muted/50" />
            <div className="flex justify-between pt-2 border-t border-border">
              <div className="h-5 w-24 rounded bg-muted/60" />
              <div className="h-4 w-12 rounded bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
