import type { Metadata } from "next";
import { SharedPhotoViewer } from "@/features/reports/components/shared-photo-viewer";

export const metadata: Metadata = { title: "Foto laporan — InternFlow", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedEvidencePage({ params }: { params: Promise<{ shareId: string; evidenceId: string }> }) {
  const { shareId, evidenceId } = await params;
  return <SharedPhotoViewer shareId={shareId} evidenceId={evidenceId} />;
}
