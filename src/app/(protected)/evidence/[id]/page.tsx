import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { EvidencePhotoPreview } from "@/features/evidence/components/evidence-photo-preview";
import { CaptureTimeForm } from "@/features/evidence/components/capture-time-form";
export default async function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser(); const { id } = await params; if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient(); const result = await supabase.from("evidence_library").select("id,type,title,note,status,captured_at,created_at,url,repository_name,sha").eq("id", id).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
  if (result.error) throw new Error("Evidence gagal dimuat."); if (!result.data) notFound(); const item = result.data;
  const capturedValue = item.captured_at ? new Intl.DateTimeFormat("sv-SE", { timeZone: user.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.captured_at)).replace(" ", "T") : "";
  return <article className="mx-auto max-w-3xl space-y-6"><Link href="/evidence" className="inline-flex min-h-11 items-center text-sm text-primary">← Evidence Library</Link><PageHeader title={item.title || (item.type === "PHOTO" ? "Foto evidence" : "Bukti kerja")} description={new Date(item.created_at).toLocaleDateString("id-ID")} />
    {item.status !== "AVAILABLE" ? <Feedback tone="warning">Sumber evidence tidak tersedia. Metadata tetap tersimpan.</Feedback> : item.type === "PHOTO" ? <div className="surface relative h-[55dvh] min-h-56 overflow-hidden"><EvidencePhotoPreview id={id} title={item.title ?? undefined} /></div> : item.url && /^https?:\/\//i.test(item.url) ? <Button asChild><a href={item.url} target="_blank" rel="noopener noreferrer">{item.type === "GITHUB_COMMIT" ? "Buka commit GitHub" : "Buka tautan"} →</a></Button> : <Feedback tone="warning">Tautan belum tersedia.</Feedback>}
    {item.type === "PHOTO" && <CaptureTimeForm id={id} initialValue={capturedValue} timezone={user.timezone} />}
    {item.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.note}</p>}<p className="text-xs text-muted-foreground">Foto memerlukan login InternFlow. Sumber eksternal mungkin memerlukan izin terpisah.</p>
  </article>;
}
