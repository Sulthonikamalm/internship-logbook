import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getActivity } from "@/features/activity/server/get-activity";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { PageHeader } from "@/components/ui/page-header";

import { safeRedirect } from "@/lib/auth/safe-redirect";

export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const rawSearch = searchParams ? await searchParams : {};
  const returnTo = rawSearch.returnTo ? safeRedirect(rawSearch.returnTo) : undefined;
  const [user, activity] = await Promise.all([requireActiveUser(), getActivity(id)]);
  if (!activity) notFound();

  const backUrl = returnTo || `/activities/${id}`;

  return <section className="mx-auto max-w-2xl space-y-6">
    <Link href={backUrl} className="inline-flex min-h-11 items-center text-sm text-primary">← Kembali</Link>
    <PageHeader title="Edit Activity" />
    <div className="surface p-5 sm:p-6"><ActivityForm userId={user.userId} timezone={user.timezone} activity={activity} returnTo={returnTo} /></div>
  </section>;
}
