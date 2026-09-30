import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { localDateAt } from "@/features/activity/domain/date";
import { ExportForm } from "@/features/reports/components/export-form";
import { FileSpreadsheet, ShieldCheck, FileCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Laporan & Ekspor — InternFlow",
  description: "Ekspor logbook magang dan detail evidence ke Microsoft Excel (.xlsx)",
};

export default async function ReportsPage() {
  const user = await requireActiveUser();
  const today = localDateAt(new Date(), user.timezone);

  return (
    <div className="container max-w-4xl mx-auto py-6 sm:py-8 px-4 space-y-8">
      {/* Header section */}
      <div className="flex flex-col gap-1.5 border-b border-border/60 pb-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Laporan Magang
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Pusat unduhan dan pembuatan rekapitulasi data magang untuk keperluan evaluasi kampus dan supervisor.
        </p>
      </div>

      {/* Main Export Form */}
      <ExportForm initialToday={today} />

      {/* Security & Specification highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-lg border border-border bg-card/60 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-semibold text-foreground">Perlindungan Formula Injection</p>
            <p className="text-muted-foreground">
              Seluruh teks input judul, keterangan, dan evidence disanitasi otomatis untuk mencegah eksekusi formula berbahaya saat file Excel dibuka.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card/60 flex items-start gap-3">
          <FileCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-semibold text-foreground">Struktur 2 Sheet Terstandar</p>
            <p className="text-muted-foreground">
              Sheet 1 menyajikan urutan kronologis kegiatan dengan ringkasan evidence, sementara Sheet 2 merinci URL dan status setiap evidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
