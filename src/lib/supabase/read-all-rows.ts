import "server-only";
/** Read all pages; never silently export Supabase's first 1,000 rows. */
export async function readAllRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, message: string): Promise<T[]> {
  const items: T[] = []; const size = 500;
  for (let offset = 0; offset <= 50000; offset += size) {
    const result = await query(offset, offset + size - 1);
    if (result.error) throw new Error(message);
    const page = result.data ?? []; items.push(...page);
    if (items.length > 50000) throw new Error("Data terlalu besar. Pilih rentang yang lebih pendek.");
    if (page.length < size) return items;
  }
  throw new Error(message);
}
export function relatedOne<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}
