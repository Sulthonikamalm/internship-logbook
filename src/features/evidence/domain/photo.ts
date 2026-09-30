import { createHash } from "node:crypto";
import sharp from "sharp";
import { MAX_PHOTO_BYTES, photoMimeFromSignature, type PhotoMime } from "./photo-signature";

export { MAX_PHOTO_BYTES, photoMimeFromSignature };
export type { PhotoMime };

export function extensionForMime(mime: PhotoMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function safeOriginalFilename(value: string): string {
  return value.replace(/[\\/\x00-\x1f\x7f]/g, "_").trim().slice(0, 255) || "foto";
}

export async function inspectPhoto(bytes: Uint8Array, declaredMime?: string) {
  if (bytes.length < 16 || bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("Ukuran foto harus 1 byte hingga 15 MB.");
  }
  const mime = photoMimeFromSignature(bytes);
  if (!mime || (declaredMime && declaredMime !== mime)) {
    throw new Error("Format foto tidak sesuai. Gunakan JPEG, PNG, atau WebP.");
  }
  try {
    const image = sharp(Buffer.from(bytes), { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    const expectedFormat = mime === "image/jpeg" ? "jpeg" : mime.split("/")[1];
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
      throw new Error("Invalid image dimensions");
    }
    await image.resize(1, 1).toBuffer();
    return {
      mime, width: metadata.width, height: metadata.height,
      checksum: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch {
    throw new Error("File foto rusak atau tidak dapat dibaca.");
  }
}
