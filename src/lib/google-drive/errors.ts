export type DriveErrorCode =
  | "AUTH" | "FORBIDDEN" | "QUOTA" | "RATE_LIMIT" | "NOT_FOUND"
  | "TIMEOUT" | "NETWORK" | "SERVER" | "UNKNOWN";

export class DriveError extends Error {
  constructor(public readonly code: DriveErrorCode, public readonly status?: number) {
    super(`Google Drive ${code}`);
  }
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

export function driveMessage(code: DriveErrorCode): string {
  if (code === "AUTH") return "Koneksi Google Drive perlu diperbarui oleh pengelola.";
  if (code === "FORBIDDEN" || code === "QUOTA") return "Google Drive menolak penyimpanan. Coba lagi nanti.";
  if (code === "RATE_LIMIT") return "Google Drive sedang membatasi permintaan. Coba lagi sebentar.";
  if (code === "NOT_FOUND") return "File di Google Drive tidak ditemukan.";
  return "Google Drive belum dapat diakses. Coba lagi.";
}
