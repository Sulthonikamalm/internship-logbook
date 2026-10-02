/** Excel limits row height to 409 points. Continue long notes on another row. */
export function splitReportNote(text: string | null): string[] {
  if (!text) return ["—"];
  const lines = text.split("\n").flatMap(line => line.length ? Array.from({ length: Math.ceil(line.length / 48) }, (_, index) => line.slice(index * 48, (index + 1) * 48)) : [""]);
  const chunks: string[] = [];
  for (let index = 0; index < lines.length; index += 16) chunks.push(lines.slice(index, index + 16).join("\n"));
  return chunks;
}
