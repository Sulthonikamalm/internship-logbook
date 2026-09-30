import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity } from "@/features/activity/server/get-activity";
import { DeleteActivityButton } from "@/features/activity/components/delete-activity-button";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();
  return <article className="mx-auto max-w-3xl space-y-6">
    <Link href="/activities" className="text-sm text-primary underline">← Aktivitas</Link>
    <header><div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{activity.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{activity.activity_date}
          {activity.start_time && ` · ${activity.start_time.slice(0, 5)}`}
          {activity.end_time && `–${activity.end_time.slice(0, 5)}`}</p></div>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{activity.status}</span>
    </div></header>
    <div className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Deskripsi</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm">{activity.description || "Belum ada deskripsi."}</p>
    </div>
    <div className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Evidence</h2>
      <p className="mt-2 text-sm text-muted-foreground">Lampiran evidence tersedia di Phase 3.</p>
    </div>
    <p className="text-xs text-muted-foreground">Sumber: {activity.source} · Versi {activity.version}</p>
    <div className="flex items-center gap-4">
      <Link href={`/activities/${id}/edit`} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Edit</Link>
      <DeleteActivityButton id={id} />
    </div>
  </article>;
}
