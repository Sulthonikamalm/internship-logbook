import "server-only";

import type { z } from "zod";
import type { ActivityActionResult } from "../domain/types";

export function validationFailure(error: z.ZodError): ActivityActionResult {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return { ok: false, code: "VALIDATION_ERROR", message: "Periksa kembali isian aktivitas.", fields };
}

export function domainFailure(message: string, field = "activityDate"): ActivityActionResult {
  return { ok: false, code: "VALIDATION_ERROR", message: "Periksa kembali isian aktivitas.", fields: { [field]: message } };
}

export function internalFailure(operation: string, code?: string): ActivityActionResult {
  console.error(`[activity.${operation}] database code=${code ?? "unknown"}`);
  return { ok: false, code: "INTERNAL_ERROR", message: "Aktivitas gagal disimpan. Coba lagi." };
}

export const missingActivity: ActivityActionResult = {
  ok: false, code: "NOT_FOUND_OR_FORBIDDEN", message: "Aktivitas tidak tersedia.",
};
export const activityConflict: ActivityActionResult = {
  ok: false, code: "CONFLICT", message: "Data telah diperbarui di perangkat lain. Muat ulang sebelum menyimpan lagi.",
};
