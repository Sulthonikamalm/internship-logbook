import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { assertPrivateDriveRoot } from "@/lib/google-drive/metadata";
import { DriveError, driveMessage, logDriveError } from "@/lib/google-drive/errors";

export async function getDriveHealth(): Promise<{ ready: boolean; message: string }> {
  await requireActiveUser();
  try {
    await assertPrivateDriveRoot();
    return { ready: true, message: "Koneksi aktif. Penyimpanan foto dapat diakses." };
  } catch (error) {
    logDriveError("health", error);
    return { ready: false, message: error instanceof DriveError
      ? driveMessage(error.code, error.reason) : "Penyimpanan foto belum dapat diperiksa. Coba lagi." };
  }
}
