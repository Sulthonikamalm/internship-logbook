import { NextRequest, NextResponse } from "next/server";
import { exportLogbookSchema } from "@/features/reports/schemas/export.schema";
import { getExportData } from "@/features/reports/server/get-export-data";
import { generateWorkbook } from "@/features/reports/server/generate-workbook";
import { buildExportFilename } from "@/features/reports/excel/sanitize-filename";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
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
          message: "Tidak ada Activity pada rentang tanggal ini.",
        },
        { status: 404 }
      );
    }

    // Determine application base URL for APP_PRIVATE evidence links
    const origin =
      req.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // Generate ExcelJS workbook buffer
    const buffer = await generateWorkbook(data, {
      includeEvidence: input.includeEvidence,
      baseUrl: origin,
    });

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
        },
      });
    } catch (auditErr) {
      // Non-fatal if audit insertion fails, but log warning
      console.warn("[reports.export-excel] Failed to record audit log:", auditErr);
    }

    // Generate safe export filename
    const filename = buildExportFilename(
      data.user.displayName,
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
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[reports.export-excel] Unhandled error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error.message || "Terjadi kesalahan saat memproses ekspor laporan.",
      },
      { status: 500 }
    );
  }
}
