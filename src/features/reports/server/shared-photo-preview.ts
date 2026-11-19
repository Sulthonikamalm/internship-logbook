import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { readReportPreview, storeReportPreviews } from "@/lib/photos/report-preview-storage.mjs";
import { verifyDrivePhoto, type StoredPhoto } from "@/features/evidence/server/verify-drive-photo";
import { downloadDriveBytes } from "@/lib/google-drive/download";
import { MAX_PHOTO_BYTES } from "@/features/evidence/domain/photo-signature";

type Preview = { bytes: Uint8Array<ArrayBuffer>; width: number; height: number };
const previews = new Map<string, { preview: Preview; expiresAt: number }>();
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 20;
const CACHE_MS = 5 * 60 * 1000;
let cacheBytes = 0;

function removePreview(key: string) {
  const cached = previews.get(key);
  if (cached) cacheBytes -= cached.preview.bytes.byteLength;
  previews.delete(key);
}

/** Call only after checking the live report grant; never cache authorization. */
export async function getSharedPhotoPreview(evidenceId: string, ownerId: string, photo: StoredPhoto & { checksum: string }, maxWidth: 960 | 1920): Promise<Preview | null> {
  const now = Date.now();
  for (const [key, value] of previews) if (value.expiresAt <= now) removePreview(key);
  const key = JSON.stringify([ownerId, evidenceId, photo, maxWidth]);
  const cached = previews.get(key);
  if (cached) {
    previews.delete(key);
    previews.set(key, cached);
    return cached.preview;
  }
  const admin = createAdminClient();
  // Stored previews are immutable, verified snapshots. Live DB grant/status checks
  // happen in the route before every call, including memory and Storage hits.
  const stored = await readReportPreview(admin, ownerId, evidenceId, photo.checksum, maxWidth).catch(() => null);
  if (stored) {
    remember(key, stored);
    return stored;
  }
  if (!await verifyDrivePhoto(evidenceId, ownerId, photo)) return null;
  const original = await downloadDriveBytes(photo.drive_file_id, MAX_PHOTO_BYTES);
  if (createHash("sha256").update(original).digest("hex") !== photo.checksum) return null;
  try {
    const saved = await storeReportPreviews(admin, ownerId, evidenceId, photo.checksum, original);
    const preview = saved.find(item => item.size === maxWidth)!;
    remember(key, preview);
    return preview;
  } catch {
    console.error("[report.preview] Persistent preview unavailable; using a temporary preview.");
  }
  const { data, info } = await sharp(original, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate().resize({ width: maxWidth, height: maxWidth, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 3 }).toBuffer({ resolveWithObject: true });
  const preview = { bytes: new Uint8Array(data), width: info.width, height: info.height };
  remember(key, preview);
  return preview;
}

function remember(key: string, preview: Preview) {
  if (preview.bytes.byteLength <= MAX_CACHE_BYTES) {
    while (previews.size && (previews.size >= MAX_CACHE_ENTRIES || cacheBytes + preview.bytes.byteLength > MAX_CACHE_BYTES))
      removePreview(previews.keys().next().value!);
    previews.set(key, { preview, expiresAt: Date.now() + CACHE_MS });
    cacheBytes += preview.bytes.byteLength;
  }
}
