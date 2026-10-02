/** Readable, date-sorted name with 64 bits of the evidence UUID for collision resistance. */
export function photoName(date: string, evidenceId: string, extension: string): string {
  return `${date.replaceAll("-", "")}-foto-${evidenceId.replaceAll("-", "").slice(0, 16)}.${extension}`;
}
