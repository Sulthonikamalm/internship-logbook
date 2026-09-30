import "server-only";
import { driveFetch } from "./client";
import { DriveError } from "./errors";

export async function downloadDriveFile(fileId: string): Promise<Response> {
  return driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
}

export async function downloadDriveBytes(fileId: string, maxBytes: number): Promise<Uint8Array> {
  const response = await downloadDriveFile(fileId);
  if (!response.body) throw new DriveError("SERVER");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new DriveError("SERVER");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
