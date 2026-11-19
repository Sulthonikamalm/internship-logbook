import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { ensureReportPreviewBucket, readReportPreview, storeReportPreviews, REPORT_PREVIEW_SIZES } from "../src/lib/photos/report-preview-storage.mjs";

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checkOnly = process.argv.includes("--check");
if (!checkOnly) await ensureReportPreviewBucket(db);
const photos = [];
for (let first = 0; ; first += 150) {
  const result = await db.from("photo_evidences").select("evidence_id,drive_file_id,drive_folder_id,stored_filename,mime_type,size_bytes,checksum,evidence:evidences!inner(user_id,status,deleted_at,owner:profiles!inner(is_active))")
    .eq("evidence.status", "AVAILABLE").is("evidence.deleted_at", null).eq("evidence.owner.is_active", true).order("evidence_id").range(first, first + 149);
  if (result.error) throw new Error(`Photo inventory failed (${result.error.code})`);
  photos.push(...result.data);
  if (result.data.length < 150) break;
}
let token;
async function drive(path) {
  if (!token) {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID.trim(), client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim(), grant_type: "refresh_token",
      }) });
    if (!response.ok) throw new Error(`Drive authorization HTTP ${response.status}`);
    token = (await response.json()).access_token;
  }
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${path}`, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Drive file HTTP ${response.status}`);
  return response;
}
let next = 0; let ready = 0; let generated = 0; const failures = [];
async function worker() {
  while (next < photos.length) {
    const photo = photos[next++]; const ownerId = photo.evidence.user_id;
    try {
      const existing = await Promise.all(REPORT_PREVIEW_SIZES.map(size => readReportPreview(db, ownerId, photo.evidence_id, photo.checksum, size)));
      if (existing.every(Boolean)) ready++;
      else if (checkOnly) throw new Error("Preview missing");
      else {
        const id = encodeURIComponent(photo.drive_file_id);
        const metadata = await (await drive(`${id}?fields=id,name,mimeType,size,parents,appProperties,trashed`)).json();
        if (metadata.trashed || metadata.name !== photo.stored_filename || metadata.mimeType !== photo.mime_type || Number(metadata.size) !== photo.size_bytes
          || metadata.appProperties?.internflowUserId !== ownerId || metadata.appProperties?.internflowEvidenceId !== photo.evidence_id || !metadata.parents?.includes(photo.drive_folder_id))
          throw new Error("Drive ownership or metadata changed");
        const bytes = new Uint8Array(await (await drive(`${id}?alt=media`)).arrayBuffer());
        if (bytes.byteLength > 15 * 1024 * 1024 || bytes.byteLength !== photo.size_bytes || createHash("sha256").update(bytes).digest("hex") !== photo.checksum)
          throw new Error("Photo checksum changed");
        await storeReportPreviews(db, ownerId, photo.evidence_id, photo.checksum, bytes); generated++;
      }
      if ((ready + generated) % 10 === 0) console.log(JSON.stringify({ checked: ready + generated, total: photos.length, generated }));
    } catch (error) { failures.push({ evidenceId: photo.evidence_id, reason: error.message }); }
  }
}
await Promise.all([worker(), worker()]);
console.log(JSON.stringify({ total: photos.length, ready, generated, failures }));
if (failures.length) process.exitCode = 1;
