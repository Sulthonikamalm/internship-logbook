import type { Metadata } from "next";
import { SharedPhotoViewer } from "@/features/reports/components/shared-photo-viewer";
import { getSharedPhotoLabel } from "@/features/reports/server/shared-photo-label";

export const metadata: Metadata = { title: "Foto laporan — InternFlow by Sulthonika", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedEvidencePage({ params }: { params: Promise<{ shareId: string; evidenceId: string }> }) {
  const { shareId, evidenceId } = await params;
  const ownerName = await getSharedPhotoLabel(shareId, evidenceId);
  return <SharedPhotoViewer key={`${shareId}/${evidenceId}`} shareId={shareId} evidenceId={evidenceId} initialOwnerName={ownerName} />;
}
