export default function EvidenceLoading() {
  return <div className="space-y-4" role="status" aria-label="Memuat evidence">
    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-lg bg-muted" />)}
    </div>
  </div>;
}
