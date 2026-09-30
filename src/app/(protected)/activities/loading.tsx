export default function ActivitiesLoading() {
  return <div role="status" aria-label="Memuat aktivitas" className="space-y-4 animate-pulse">
    <div className="h-8 w-48 rounded bg-muted" />
    <div className="h-24 rounded bg-muted" />
    {[1, 2, 3].map((item) => <div key={item} className="h-20 rounded bg-muted" />)}
  </div>;
}
