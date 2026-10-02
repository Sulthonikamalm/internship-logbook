import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt, isRealDate } from "@/features/activity/domain/date";
import { ExportForm } from "@/features/reports/components/export-form";
import { ActivePhotoShares } from "@/features/reports/components/active-photo-shares";
import { listReportPhotoShares } from "@/features/reports/server/report-photo-shares";
import { PageHeader } from "@/components/ui/page-header";
import { parseWorkCategory } from "@/features/work/domain/category";
import { getServerEnv } from "@/lib/env/server";
import { isLocalReportHost } from "@/features/reports/domain/photo-link";

export const metadata: Metadata = { title: "Reports — InternFlow" };
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ category?: string; from?: string; to?: string }> }) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const shares = await listReportPhotoShares();
  const localPhotoLinks = isLocalReportHost(new URL(getServerEnv().APP_BASE_URL).hostname);
  return <div className="space-y-7"><PageHeader title="Laporan" description="Pilih kegiatan, periode, lalu ekspor." /><ExportForm initialToday={localDateAt(new Date(), user.timezone)} initialCategory={parseWorkCategory(params.category)} initialFrom={params.from && isRealDate(params.from) ? params.from : undefined} initialTo={params.to && isRealDate(params.to) ? params.to : undefined} localPhotoLinks={localPhotoLinks} /><ActivePhotoShares shares={shares} timezone={user.timezone} /></div>;
}
