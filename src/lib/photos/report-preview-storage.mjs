import sharp from "sharp";

export const REPORT_PREVIEW_BUCKET = "report-photo-previews";
export const REPORT_PREVIEW_SIZES = [960, 1920];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {string} ownerId @param {string} evidenceId @param {string} checksum @param {number} size */
export function reportPreviewPath(ownerId, evidenceId, checksum, size) {
  if (!uuid.test(ownerId) || !uuid.test(evidenceId) || !/^[0-9a-f]{64}$/.test(checksum) || !REPORT_PREVIEW_SIZES.includes(size))
    throw new Error("Invalid report preview identity");
  return `${ownerId}/${evidenceId}/v1-${checksum}-${size}.webp`;
}

/** Provision a private, server-only bucket. No public or user Storage policies are added.
 * @param {import('@supabase/supabase-js').SupabaseClient} db */
export async function ensureReportPreviewBucket(db) {
  const existing = await db.storage.getBucket(REPORT_PREVIEW_BUCKET);
  if (existing.data) {
    if (existing.data.public) throw new Error("Report preview bucket must be private");
    return;
  }
  const created = await db.storage.createBucket(REPORT_PREVIEW_BUCKET, {
    public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/webp"],
  });
  if (created.error) {
    const retry = await db.storage.getBucket(REPORT_PREVIEW_BUCKET);
    if (!retry.data || retry.data.public) throw new Error("Private report preview storage unavailable");
  }
}

/** @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} ownerId @param {string} evidenceId @param {string} checksum @param {number} size */
export async function readReportPreview(db, ownerId, evidenceId, checksum, size) {
  const result = await db.storage.from(REPORT_PREVIEW_BUCKET).download(reportPreviewPath(ownerId, evidenceId, checksum, size), {}, { cache: "no-store" });
  if (result.error || !result.data) return null;
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  const info = await sharp(bytes).metadata();
  if (info.format !== "webp" || !info.width || !info.height || info.width > size || info.height > size) return null;
  return { bytes, width: info.width, height: info.height };
}

/** Only pass original bytes whose checksum and uploader were already verified.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} ownerId @param {string} evidenceId @param {string} checksum @param {Uint8Array} original */
export async function storeReportPreviews(db, ownerId, evidenceId, checksum, original) {
  await ensureReportPreviewBucket(db);
  return Promise.all(REPORT_PREVIEW_SIZES.map(async size => {
    const { data: bytes, info } = await sharp(original, { failOn: "error", limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 3 }).toBuffer({ resolveWithObject: true });
    const result = await db.storage.from(REPORT_PREVIEW_BUCKET).upload(reportPreviewPath(ownerId, evidenceId, checksum, size), bytes, {
      contentType: "image/webp", cacheControl: "0", upsert: true,
    });
    if (result.error) throw new Error("Report preview could not be stored");
    return { size, bytes: new Uint8Array(bytes), width: info.width, height: info.height };
  }));
}

/** @param {import('@supabase/supabase-js').SupabaseClient} db @param {string} ownerId @param {string} evidenceId */
export async function removeReportPreviews(db, ownerId, evidenceId) {
  if (!uuid.test(ownerId) || !uuid.test(evidenceId)) throw new Error("Invalid preview owner");
  const prefix = `${ownerId}/${evidenceId}`;
  const found = await db.storage.from(REPORT_PREVIEW_BUCKET).list(prefix, { limit: 100 });
  if (found.error) throw new Error("Report previews could not be listed");
  if (found.data.length) {
    const result = await db.storage.from(REPORT_PREVIEW_BUCKET).remove(found.data.map(file => `${prefix}/${file.name}`));
    if (result.error) throw new Error("Report previews could not be removed");
  }
}
