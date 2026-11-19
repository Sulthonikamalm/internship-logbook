function origin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
    || !(url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    throw new Error("Alamat konfigurasi harus berupa origin HTTPS atau localhost.");
  return url.origin;
}

/** Only public authentication settings may be shipped to a downloaded client. */
export function validatePublicConfig(value) {
  if (!value || value.version !== 1 || typeof value.publishableKey !== "string")
    throw new Error("Konfigurasi publik aplikasi tidak valid.");
  const key = value.publishableKey;
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role; } catch { /* Invalid public key. */ }
    if (role !== "anon") throw new Error("Konfigurasi klien hanya boleh menggunakan publishable/anon key.");
  }
  return { version: 1, appUrl: origin(value.appUrl), supabaseUrl: origin(value.supabaseUrl), publishableKey: key };
}
