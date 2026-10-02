import { NextRequest, NextResponse } from "next/server";
import { exportLogbookSchema } from "@/features/reports/schemas/export.schema";
import { getExportData } from "@/features/reports/server/get-export-data";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import { buildExportFilename } from "@/features/reports/excel/sanitize-filename";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getServerEnv } from "@/lib/env/server";
import { missingReportEvidence } from "@/features/reports/domain/evidence-gate";
import { categoryLabels } from "@/features/work/domain/category";
import { activateReportPhotoShare, createReportPhotoShare, removeInactiveReportPhotoShare } from "@/features/reports/server/report-photo-shares";
import { isLocalReportHost } from "@/features/reports/domain/photo-link";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sesi berakhir. Masuk kembali." }, { status: 401 });
    if (!user.isActive) return NextResponse.json({ error: "FORBIDDEN", message: "Akun ini dinonaktifkan." }, { status: 403 });
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Payload JSON tidak valid." },
        { status: 400 }
      );
    }

    const parseResult = exportLogbookSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Input tidak valid.",
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    if (input.evidenceLinkMode === "REPORT_SHARED") {
      const configured = new URL(getServerEnv().APP_BASE_URL);
      if (configured.protocol !== "https:" && !isLocalReportHost(configured.hostname)
        || isLocalReportHost(configured.hostname) && !isLocalReportHost(req.nextUrl.hostname)) {
        return NextResponse.json({ error: "SHARE_BASE_URL", message: "Alamat situs untuk tautan dosen belum siap. Hubungi pengelola." }, { status: 503 });
      }
    }

    // Security Gate: Reject DRIVE_SHARED if requested until full permission system is built
    if (input.evidenceLinkMode === "DRIVE_SHARED") {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_MODE",
          message:
            "Mode tautan DRIVE_SHARED saat ini belum didukung demi keamanan. Silakan gunakan APP_PRIVATE.",
        },
        { status: 400 }
      );
    }

    // Fetch user-scoped activity and evidence data
    const data = await getExportData(input);

    // Empty range check: Section 7 "IF zero Activity: show 'Tidak ada Activity pada rentang tanggal ini.'"
    if (data.activities.length === 0) {
      return NextResponse.json(
        {
          error: "EMPTY_RANGE",
          message: "Belum ada kegiatan untuk kategori dan periode ini.",
        },
        { status: 404 }
      );
    }

    const missing = missingReportEvidence(data.activities, input.category);
    if (missing.length) return NextResponse.json({ error: "EVIDENCE_REQUIRED", message: `${missing.length} kegiatan belum memiliki bukti yang tersedia.`, missing: missing.slice(0, 5).map(row => ({ title: row.title, href: row.href ?? `/activities/${row.id}` })) }, { status: 422 });

    // Determine application base URL for APP_PRIVATE evidence links
    const origin = getServerEnv().APP_BASE_URL;

    // A grant starts inactive, so a failed workbook never exposes its photos.
    const photoShare = input.evidenceLinkMode === "REPORT_SHARED" ? await createReportPhotoShare(data, input) : null;
    let buffer: Buffer;
    try {
      buffer = await generateWorkbook(data, {
        includeEvidence: input.includeEvidence,
        baseUrl: origin,
        photoShare,
      });
      if (photoShare) await activateReportPhotoShare(data.user.userId, photoShare.id);
    } catch (error) {
      if (photoShare) await removeInactiveReportPhotoShare(data.user.userId, photoShare.id);
      throw error;
    }

    // Record audit log event
    try {
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        actor_user_id: data.user.userId,
        entity_type: "report",
        entity_id: null,
        action: "report.excel_exported",
        metadata: {
          from: input.from,
          to: input.to,
          row_count: data.activities.length,
          evidence_mode: input.evidenceLinkMode,
          include_evidence: input.includeEvidence,
          category: input.category,
          share_id: photoShare?.id ?? null,
        },
      });
    } catch (auditErr) {
      // Non-fatal if audit insertion fails, but log warning
      console.warn("[reports.export-excel] Failed to record audit log:", auditErr);
    }

    // Generate safe export filename
    const filename = buildExportFilename(
      `${categoryLabels[input.category]}_${data.user.displayName}`,
      input.from,
      input.to
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        "X-InternFlow-Photo-Links": photoShare ? "shared" : "private",
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[reports.export-excel] Unhandled error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Laporan belum dapat dibuat. Silakan coba lagi.",
      },
      { status: 500 }
    );
  }
}
