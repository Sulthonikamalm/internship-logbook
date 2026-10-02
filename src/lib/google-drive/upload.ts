import "server-only";
import { driveFetch, driveUploadStatusFetch } from "./client";
import { DriveError } from "./errors";

export function isDriveUploadSessionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.googleapis.com"
      && url.pathname === "/upload/drive/v3/files"
      && url.searchParams.get("uploadType") === "resumable"
      && Boolean(url.searchParams.get("upload_id"));
  } catch { return false; }
}

export async function probePhotoUpload(sessionUrl: string, size: number): Promise<
  { kind: "ACTIVE" } | { kind: "EXPIRED" } | { kind: "COMPLETE"; fileId: string }
> {
  if (!isDriveUploadSessionUrl(sessionUrl)) throw new DriveError("UNKNOWN");
  const response = await driveUploadStatusFetch(sessionUrl, size);
  if (response.status === 404) return { kind: "EXPIRED" };
  if (response.status === 308) return { kind: "ACTIVE" };
  if (response.ok) {
    const payload = await response.json() as { id?: string };
    if (payload.id) return { kind: "COMPLETE", fileId: payload.id };
  }
  throw new DriveError("SERVER", response.status);
}

export async function initiatePhotoUpload(input: {
  evidenceId: string; userId: string; folderId: string;
  storedFilename: string; mimeType: string; size: number; origin: string;
}): Promise<string> {
  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,appProperties", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8",
        Origin: input.origin,
        "X-Upload-Content-Type": input.mimeType,
        "X-Upload-Content-Length": String(input.size) },
      body: JSON.stringify({ name: input.storedFilename, mimeType: input.mimeType,
        parents: [input.folderId], appProperties: {
          internflowEvidenceId: input.evidenceId, internflowUserId: input.userId,
        } }),
    });
  const sessionUrl = response.headers.get("Location");
  if (!sessionUrl || !isDriveUploadSessionUrl(sessionUrl)) throw new DriveError("SERVER");
  return sessionUrl;
}
