import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getActivity } from "@/features/activity/server/get-activity";
import { ActivityForm } from "@/features/activity/components/activity-form";

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
    <div><Link href={backUrl} className="text-sm text-primary underline">← Kembali</Link>
      <h1 className="mt-2 text-2xl font-bold">Edit aktivitas</h1></div>
    <ActivityForm userId={user.userId} timezone={user.timezone} activity={activity} returnTo={returnTo} />
  </section>;
}
