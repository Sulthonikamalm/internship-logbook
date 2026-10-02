export type ReportPhotoShare = { id: string; token: string; expiresAt: string };

export const isLocalReportHost = (hostname: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());

export function reportPhotoHref(baseUrl: string, evidenceId: string, share?: ReportPhotoShare): string {
  const origin = baseUrl.replace(/\/+$/, "");
  return share
    ? `${origin}/shared/evidence/${share.id}/${evidenceId}#${share.token}`
    : `${origin}/evidence/${evidenceId}`;
}
