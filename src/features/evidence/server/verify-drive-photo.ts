import "server-only";
import { getDriveMetadata } from "@/lib/google-drive/metadata";

export type StoredPhoto = { drive_file_id: string; drive_folder_id: string; mime_type: string; size_bytes: number; stored_filename: string };

export async function verifyDrivePhoto(id: string, userId: string, photo: StoredPhoto): Promise<boolean> {
  const remote = await getDriveMetadata(photo.drive_file_id);
  return remote.appProperties?.internflowEvidenceId === id
    && remote.appProperties?.internflowUserId === userId
    && remote.parents?.includes(photo.drive_folder_id) === true
    && remote.name === photo.stored_filename
    && remote.mimeType === photo.mime_type
    && Number(remote.size) === photo.size_bytes;
}
