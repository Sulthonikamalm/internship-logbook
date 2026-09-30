import Link from "next/link";
import { BookOpen, PlusCircle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  totalUnfilteredCount: number;
  isSingleDateFilter: boolean;
  targetDate?: string;
  returnToUrl: string;
};

export function LogbookEmptyState({
  totalUnfilteredCount,
  isSingleDateFilter,
  targetDate,
  returnToUrl,
}: Props) {
  let title = "Tidak ada Activity yang cocok.";
  let description = "Coba ubah kata kunci pencarian, rentang tanggal, atau filter evidence.";

  if (totalUnfilteredCount === 0) {
    title = "Belum ada Activity untuk logbook.";
    description = "Mulai catat aktivitas harian magang Anda untuk mengisi logbook.";
  } else if (isSingleDateFilter) {
    title = "Belum ada Activity pada tanggal ini.";
    description = targetDate
      ? `Belum ada catatan aktivitas untuk tanggal ${targetDate}.`
      : "Belum ada catatan aktivitas pada tanggal yang dipilih.";
  }

  const createUrl = targetDate
    ? `/activities/new?date=${targetDate}&returnTo=${encodeURIComponent(returnToUrl)}`
    : `/activities/new?returnTo=${encodeURIComponent(returnToUrl)}`;

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-2xs space-y-4 max-w-lg mx-auto my-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {totalUnfilteredCount === 0 ? (
          <BookOpen className="h-6 w-6" />
        ) : (
          <SearchX className="h-6 w-6" />
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {description}
        </p>
      </div>

      <div className="pt-2">
        <Button asChild size="sm" className="gap-2 shadow-xs font-medium">
          <Link href={createUrl}>
            <PlusCircle className="h-4 w-4" />
            <span>Tambah Activity</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
