import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
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
    <Link href={backUrl} className="inline-flex min-h-11 items-center text-sm text-primary">← Kembali</Link>
    <PageHeader title={activity.title} description={`${activity.activity_date}${activity.start_time ? ` · ${activity.start_time.slice(0,5)}` : ""}${activity.end_time ? `–${activity.end_time.slice(0,5)}` : ""}`} action={<Badge variant="secondary">{{ DRAFT: "Draft", READY: "Siap", ARCHIVED: "Arsip" }[activity.status]}</Badge>} />
    <div className="surface p-5">
      <h2 className="font-semibold">Deskripsi</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm">{activity.description || "Belum ada deskripsi."}</p>
    </div>
    {activity.todo_id && <Button asChild variant="outline"><Link href={`/todos?todo=${activity.todo_id}`}>Buka Todo terkait →</Link></Button>}
    <div className="surface p-5">
      <h2 className="font-semibold">Evidence</h2>
      {attached.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Belum ada lampiran.</p>
        : <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {attached.map((item) => <EvidenceCard key={item.id} item={item}
            actions={<DetachEvidenceButton activityId={id} evidenceId={item.id} />} />)}
        </div>}
      <details className="mt-4 border-t"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary">Tambahkan evidence</summary><EvidencePicker activityId={id} options={library.items}
        attachedIds={attached.map((item) => item.id)} total={library.count} /></details>
    </div>
    <div className="flex items-center gap-4">
      <Button asChild><Link href={editUrl}>Edit Activity</Link></Button>
      <DeleteActivityButton id={id} />
    </div>
  </article>;
}
