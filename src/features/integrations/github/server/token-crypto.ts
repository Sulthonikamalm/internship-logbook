import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";

function key() {
  const raw = getServerEnv().GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) throw new Error("GITHUB_ENCRYPTION_NOT_CONFIGURED");
  return Buffer.from(raw, "hex");
}
export function encryptGitHubToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptGitHubToken(value: string): string {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("GITHUB_REAUTH_REQUIRED");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
