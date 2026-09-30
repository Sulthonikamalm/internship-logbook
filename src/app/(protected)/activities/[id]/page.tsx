import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity } from "@/features/activity/server/get-activity";
import { DeleteActivityButton } from "@/features/activity/components/delete-activity-button";
import { evidenceForActivity, listEvidence } from "@/features/evidence/server/list-evidence";
import { EvidenceCard } from "@/features/evidence/components/evidence-card";
import { EvidencePicker, DetachEvidenceButton } from "@/features/evidence/components/evidence-picker";

import { safeRedirect } from "@/lib/auth/safe-redirect";

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const rawSearch = searchParams ? await searchParams : {};
  const returnTo = rawSearch.returnTo ? safeRedirect(rawSearch.returnTo) : undefined;
  const activity = await getActivity(id);
  if (!activity) notFound();
  const [attached, library] = await Promise.all([
    evidenceForActivity(id), listEvidence({ page: 1 }),
  ]);
  const backUrl = returnTo || "/activities";
  const editUrl = returnTo
    ? `/activities/${id}/edit?returnTo=${encodeURIComponent(returnTo)}`
    : `/activities/${id}/edit`;

  return <article className="mx-auto max-w-3xl space-y-6">
    <Link href={backUrl} className="text-sm text-primary underline">← Kembali</Link>
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
      {attached.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Belum ada lampiran.</p>
        : <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {attached.map((item) => <EvidenceCard key={item.id} item={item}
            actions={<DetachEvidenceButton activityId={id} evidenceId={item.id} />} />)}
        </div>}
      <div className="mt-5"><EvidencePicker activityId={id} options={library.items}
        attachedIds={attached.map((item) => item.id)} total={library.count} /></div>
    </div>
    <p className="text-xs text-muted-foreground">Sumber: {activity.source} · Versi {activity.version}</p>
    <div className="flex items-center gap-4">
      <Link href={editUrl} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Edit</Link>
      <DeleteActivityButton id={id} />
    </div>
  </article>;
}
