export class JsonBodyError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
/** Bound streamed bodies too; Content-Length alone does not cover chunked requests. */
export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new JsonBodyError("Permintaan terlalu besar.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new JsonBodyError("JSON diperlukan.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new JsonBodyError("Permintaan terlalu besar.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new JsonBodyError("JSON tidak valid.", 400); }
}
