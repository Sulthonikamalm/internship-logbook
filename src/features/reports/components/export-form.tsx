"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DatePreset = "this_month" | "last_month" | "last_3_months" | "all";

export function ExportForm({ initialToday }: { initialToday: string }) {
  // Compute default dates (current month)
  const [from, setFrom] = useState(() => {
    const [y, m] = initialToday.split("-");
    return `${y}-${m}-01`;
  });
  const [to, setTo] = useState(initialToday);
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [evidenceLinkMode, setEvidenceLinkMode] = useState<"APP_PRIVATE" | "DRIVE_SHARED">("APP_PRIVATE");

  const [status, setStatus] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Preset quick handlers
  const applyPreset = (preset: DatePreset) => {
    const todayDate = new Date(`${initialToday}T00:00:00Z`);
    const year = todayDate.getUTCFullYear();
    const month = todayDate.getUTCMonth(); // 0-indexed

    if (preset === "this_month") {
      const padM = String(month + 1).padStart(2, "0");
      setFrom(`${year}-${padM}-01`);
      setTo(initialToday);
    } else if (preset === "last_month") {
      const prevDate = new Date(Date.UTC(year, month - 1, 1));
      const prevYear = prevDate.getUTCFullYear();
      const prevMonth = prevDate.getUTCMonth();
      const padPrevM = String(prevMonth + 1).padStart(2, "0");
      const lastDayPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      setFrom(`${prevYear}-${padPrevM}-01`);
      setTo(`${prevYear}-${padPrevM}-${String(lastDayPrevMonth).padStart(2, "0")}`);
    } else if (preset === "last_3_months") {
      const threeMonthsAgo = new Date(todayDate);
      threeMonthsAgo.setUTCDate(threeMonthsAgo.getUTCDate() - 90);
      setFrom(threeMonthsAgo.toISOString().slice(0, 10));
      setTo(initialToday);
    } else if (preset === "all") {
      // 6 months ago to today
      const sixMonthsAgo = new Date(todayDate);
      sixMonthsAgo.setUTCDate(sixMonthsAgo.getUTCDate() - 180);
      setFrom(sixMonthsAgo.toISOString().slice(0, 10));
      setTo(initialToday);
    }
    setErrorMessage(null);
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "generating") return;

    if (!from || !to) {
      setErrorMessage("Silakan isi tanggal mulai dan tanggal selesai.");
      return;
    }

    if (from > to) {
      setErrorMessage("Tanggal mulai tidak boleh lebih besar dari tanggal selesai.");
      return;
    }

    setStatus("generating");
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const response = await fetch("/api/reports/export-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          includeEvidence,
          evidenceLinkMode,
        }),
      });

      if (!response.ok) {
        let errorData: { error?: string; message?: string } = {};
        try {
          errorData = await response.json();
        } catch {
          // Response was not JSON
        }

        const msg =
          errorData.message ||
          (response.status === 404
            ? "Tidak ada Activity pada rentang tanggal ini."
            : "Gagal membuat laporan Excel.");
        setErrorMessage(msg);
        setStatus("error");
        return;
      }

      // Read Content-Disposition header to get actual filename if possible
      const disposition = response.headers.get("Content-Disposition");
      let filename = `InternFlow_Logbook_${from}_${to}.xlsx`;
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
          filename = decodeURIComponent(utf8Match[1]);
        } else {
          const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
          if (simpleMatch && simpleMatch[1]) {
            filename = simpleMatch[1];
          }
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setStatus("success");
      setSuccessInfo(`Laporan "${filename}" berhasil diunduh.`);
    } catch (err: unknown) {
      console.error("[ExportForm] Export error:", err);
      setErrorMessage("Terjadi gangguan jaringan saat mengunduh laporan. Silakan coba lagi.");
      setStatus("error");
    } finally {
      if (status !== "error") {
        setTimeout(() => setStatus("idle"), 4000);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/80 shadow-sm bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <FileSpreadsheet className="h-5 w-5" />
            <span>Ekspor Spreadsheet Excel (.xlsx)</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            Generate Laporan Aktivitas
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Ekspor logbook magang lengkap dengan sheet rekap aktivitas dan rincian evidence ke format
            standar Microsoft Excel.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleExport} className="space-y-6">
            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pilihan Rentang Cepat
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("this_month")}
                  disabled={status === "generating"}
                  className="text-xs h-8"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Bulan Ini
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("last_month")}
                  disabled={status === "generating"}
                  className="text-xs h-8"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Bulan Lalu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("last_3_months")}
                  disabled={status === "generating"}
                  className="text-xs h-8"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  3 Bulan Terakhir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("all")}
                  disabled={status === "generating"}
                  className="text-xs h-8"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Seluruh Periode
                </Button>
              </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="from-date"
                  className="text-sm font-medium text-foreground flex items-center gap-1.5"
                >
                  <span>Dari Tanggal</span>
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  id="from-date"
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setErrorMessage(null);
                  }}
                  disabled={status === "generating"}
                  required
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="to-date"
                  className="text-sm font-medium text-foreground flex items-center gap-1.5"
                >
                  <span>Sampai Tanggal</span>
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  id="to-date"
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setErrorMessage(null);
                  }}
                  disabled={status === "generating"}
                  required
                  className="bg-background text-sm"
                />
              </div>
            </div>

            {/* Evidence Configuration */}
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
              <div className="flex items-start gap-3">
                <input
                  id="include-evidence"
                  type="checkbox"
                  checked={includeEvidence}
                  onChange={(e) => setIncludeEvidence(e.target.checked)}
                  disabled={status === "generating"}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="include-evidence"
                    className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-1.5"
                  >
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Sertakan Sheet Evidence Detail</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Menambahkan sheet kedua berisi rincian seluruh evidence (foto kegiatan & tautan)
                    terkait aktivitas yang diekspor.
                  </p>
                </div>
              </div>

              {includeEvidence && (
                <div className="pt-3 border-t border-border/60 space-y-3">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Mode Tautan Evidence</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className={`p-3 rounded-md border text-xs cursor-pointer transition-colors ${
                        evidenceLinkMode === "APP_PRIVATE"
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                      onClick={() => setEvidenceLinkMode("APP_PRIVATE")}
                    >
                      <div className="font-semibold flex items-center gap-1 text-primary">
                        <Lock className="h-3 w-3" />
                        APP_PRIVATE (Direkomendasikan)
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Tautan evidence diarahkan ke halaman aman InternFlow. Membutuhkan hak akses
                        login untuk melihat isi file.
                      </p>
                    </div>

                    <div
                      className="p-3 rounded-md border border-dashed border-border bg-muted/40 text-xs opacity-60 cursor-not-allowed"
                      title="DRIVE_SHARED saat ini dinonaktifkan demi privasi pengguna."
                    >
                      <div className="font-semibold flex items-center gap-1 text-muted-foreground">
                        <span>DRIVE_SHARED (Dinonaktifkan)</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Akses publik langsung Google Drive tidak diaktifkan demi melindungi kerahasiaan
                        dokumen magang Anda.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background/80 p-2.5 rounded border border-border/50">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>Catatan Keamanan:</strong> Evidence bersifat private dan membutuhkan akses
                      login akun InternFlow yang berwenang untuk membuka rincian tautan.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs uppercase tracking-wide">Pemberitahuan</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Success Banner */}
            {successInfo && (
              <div className="p-3.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <p>{successInfo}</p>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={status === "generating"}
                className="w-full sm:w-auto min-w-[200px] h-10 gap-2 font-medium"
              >
                {status === "generating" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan Laporan...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Unduh Laporan (.xlsx)</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
