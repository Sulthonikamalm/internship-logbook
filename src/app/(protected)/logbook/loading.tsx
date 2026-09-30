import { LogbookSkeleton } from "@/features/logbook/components/logbook-skeleton";

export default function LogbookLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 rounded-lg bg-muted/80 animate-pulse" />
        <div className="mt-1 h-4 w-72 rounded bg-muted/50 animate-pulse" />
      </div>
      <LogbookSkeleton />
    </div>
  );
}
