/**
 * Application Error Codes.
 * Used across the app for consistent error handling and UI copy.
 */
export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  NOT_FOUND_OR_FORBIDDEN: "NOT_FOUND_OR_FORBIDDEN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Structured application error.
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  requestId?: string;
}

/**
 * Generates a unique request ID for error tracking.
 * Uses crypto.randomUUID when available, falls back to timestamp-based ID.
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Indonesian-language user-facing error messages.
 * Generic by design — never leak internal details.
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  FORBIDDEN: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  ACCOUNT_DISABLED:
    "Akun Anda telah dinonaktifkan. Hubungi administrator untuk bantuan.",
  VALIDATION_ERROR: "Data yang dikirim tidak valid. Periksa kembali input Anda.",
  CONFLICT: "Terjadi konflik data. Coba lagi atau muat ulang halaman.",
  NOT_FOUND_OR_FORBIDDEN: "Data tidak ditemukan.",
  INTERNAL_ERROR: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
};

/**
 * Creates a structured AppError with user-facing Indonesian copy.
 * Logs safe context to server, never exposes stack traces.
 */
export function createAppError(
  code: ErrorCode,
  serverContext?: string
): AppError {
  const requestId = generateRequestId();

  // Server-side logging with safe context only
  if (typeof window === "undefined" && serverContext) {
    console.error(
      `[AppError] code=${code} requestId=${requestId} context=${serverContext}`
    );
  }

  return {
    code,
    message: ERROR_MESSAGES[code],
    requestId,
  };
}

/**
 * Maps unknown errors to a safe AppError.
 * Never exposes raw error messages to the user.
 */
export function mapToAppError(error: unknown): AppError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code in ErrorCode
  ) {
    return error as AppError;
  }

  const requestId = generateRequestId();

  // Log original error server-side only
  if (typeof window === "undefined") {
    console.error(`[UnhandledError] requestId=${requestId}`, error);
  }

  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: ERROR_MESSAGES.INTERNAL_ERROR,
    requestId,
  };
}
