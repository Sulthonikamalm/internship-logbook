import "server-only";
import { driveFetch } from "./client";
import { DriveError } from "./errors";

export async function deleteDriveFile(fileId: string): Promise<void> {
  try {
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof DriveError && error.code === "NOT_FOUND") return;
    throw error;
  }
}
