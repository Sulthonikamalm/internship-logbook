import { MAX_PHOTO_BYTES, photoMimeFromSignature, type PhotoMime } from "./photo-signature";

export async function prepareBrowserPhoto(file: File): Promise<{
  mimeType: PhotoMime; checksum: string; size: number;
}> {
  if (file.size < 16 || file.size > MAX_PHOTO_BYTES) throw new Error("Foto maksimal 15 MB.");
  const bytes = await file.arrayBuffer();
  const mimeType = photoMimeFromSignature(new Uint8Array(bytes));
  if (!mimeType) throw new Error("Gunakan foto JPEG, PNG, atau WebP. HEIC belum didukung.");
  if (file.type && file.type !== mimeType) throw new Error("Format foto tidak sesuai dengan isi file.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { mimeType, checksum, size: file.size };
}

export async function compressBrowserPhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") throw new Error("Peramban ini tidak mendukung kompresi foto.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Kompresi foto tidak tersedia.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob || blob.size > MAX_PHOTO_BYTES || blob.size >= file.size)
    throw new Error("Kompresi belum cukup. Pilih foto berukuran lebih kecil.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}
