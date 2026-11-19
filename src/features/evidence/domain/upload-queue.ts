export const MAX_UPLOAD_BATCH = 100;
export const UPLOAD_CONCURRENCY = 2;

/** Workers take one file at a time so a failed file never rejects the batch. */
export async function processUploadQueue<T>(items: T[], work: (item: T) => Promise<void>) {
  let next = 0;
  const results: PromiseSettledResult<void>[] = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++; const item = items[index];
      try { await work(item); results[index] = { status: "fulfilled", value: undefined }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
