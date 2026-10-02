"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
export function EvidencePhotoPreview({ id, title = "Foto evidence" }: { id: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  return <a href={`/api/media/evidence/${id}`} target="_blank" rel="noopener noreferrer" aria-label={`Buka foto ${title}`} className="absolute inset-0 flex items-center justify-center">
    {failed ? <div className="px-4 text-center"><ImageOff size={28} className="mx-auto mb-2 text-muted-foreground" /><p className="text-xs text-muted-foreground">Pratinjau tidak tersedia</p><span className="mt-2 inline-block text-xs text-primary">Coba buka foto →</span></div> : <Image src={`/api/media/evidence/${id}?thumb=1`} alt={title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" unoptimized onError={() => setFailed(true)} />}
  </a>;
}
