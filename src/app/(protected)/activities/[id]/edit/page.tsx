import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { getActivity } from "@/features/activity/server/get-activity";
import { ActivityForm } from "@/features/activity/components/activity-form";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, activity] = await Promise.all([requireActiveUser(), getActivity(id)]);
  if (!activity) notFound();
  return <section className="mx-auto max-w-2xl space-y-6">
    <div><Link href={`/activities/${id}`} className="text-sm text-primary underline">← Detail aktivitas</Link>
      <h1 className="mt-2 text-2xl font-bold">Edit aktivitas</h1></div>
    <ActivityForm userId={user.userId} timezone={user.timezone} activity={activity} />
  </section>;
}
