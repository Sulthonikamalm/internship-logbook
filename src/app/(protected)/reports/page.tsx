import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { ExportForm } from "@/features/reports/components/export-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Reports — InternFlow" };
export default async function ReportsPage() {
  const user = await requireActiveUser();
  return <div className="space-y-7"><PageHeader title="Reports" description="Catatan harian, siap dibagikan." /><ExportForm initialToday={localDateAt(new Date(), user.timezone)} /></div>;
}
