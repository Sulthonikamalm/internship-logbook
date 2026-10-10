export type DriveErrorCode =
  | "CONFIG" | "AUTH" | "FORBIDDEN" | "QUOTA" | "RATE_LIMIT" | "NOT_FOUND"
  | "TIMEOUT" | "NETWORK" | "SERVER" | "UNKNOWN";

const oauthReasons = ["invalid_grant", "invalid_client", "unauthorized_client", "invalid_request",
  "unsupported_grant_type", "access_denied", "temporarily_unavailable", "server_error"] as const;
export type DriveErrorReason = typeof oauthReasons[number] | "missing_configuration" | "invalid_response" | "invalid_access_token";

export class DriveError extends Error {
  constructor(public readonly code: DriveErrorCode, public readonly status?: number,
    public readonly reason?: DriveErrorReason) {
    super(`Google Drive ${code}`);
  }
}

export function mapDriveOAuthError(status: number, rawReason?: unknown): DriveError {
  const reason = oauthReasons.find(value => value === rawReason);
  const code: DriveErrorCode = status === 429 ? "RATE_LIMIT"
    : status >= 500 || reason === "temporarily_unavailable" || reason === "server_error" ? "SERVER"
      : reason === "invalid_client" || reason === "unauthorized_client" || reason === "invalid_request"
        || reason === "unsupported_grant_type" ? "CONFIG"
        : reason === "invalid_grant" || reason === "access_denied" || status === 401 ? "AUTH" : "UNKNOWN";
  return new DriveError(code, status, reason);
}

export function logDriveError(operation: string, error: unknown): void {
  // Provider descriptions, request bodies, URLs and tokens must never enter logs.
  const safe = error instanceof DriveError ? error : new DriveError("UNKNOWN");
  console.error(`[drive.${operation}] code=${safe.code} status=${safe.status ?? "none"} reason=${safe.reason ?? "none"}`);
}

export function mapDriveStatus(status: number): DriveErrorCode {
  if (status === 401) return "AUTH";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "SERVER";
  return "UNKNOWN";
}

export function mapDriveResponse(status: number, reason?: string): DriveErrorCode {
  if (status === 403 && (reason === "storageQuotaExceeded" || reason === "quotaExceeded")) return "QUOTA";
  if (status === 403 && (reason === "userRateLimitExceeded" || reason === "rateLimitExceeded"))
    return "RATE_LIMIT";
  return mapDriveStatus(status);
}

export function mapDriveNetworkError(error: unknown): DriveError {
  if (error instanceof DriveError) return error;
  if (error && typeof error === "object" && "name" in error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
    return new DriveError("TIMEOUT");
  return new DriveError("NETWORK");
}

export function driveMessage(code: DriveErrorCode, reason?: DriveErrorReason): string {
  if (code === "CONFIG") return "Konfigurasi Google Drive perlu diperiksa oleh pengelola.";
  if (code === "AUTH" && reason === "invalid_grant")
    return "Izin akun penyimpanan Google Drive sudah kedaluwarsa atau dicabut. Pengelola perlu menghubungkan ulang.";
  if (code === "AUTH") return "Koneksi akun penyimpanan Google Drive terputus. Pengelola perlu menghubungkan ulang.";
  if (code === "FORBIDDEN" || code === "QUOTA") return "Google Drive menolak penyimpanan. Coba lagi nanti.";
  if (code === "RATE_LIMIT") return "Google Drive sedang membatasi permintaan. Coba lagi sebentar.";
  if (code === "NOT_FOUND") return "File di Google Drive tidak ditemukan.";
  return "Google Drive belum dapat diakses. Coba lagi.";
}
