"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
export function PageError({ retry }: { retry: () => void }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  return <div className="surface mx-auto max-w-lg space-y-5 p-6"><h1 className="text-xl font-semibold">Halaman belum dapat dimuat</h1><Feedback tone="info">Periksa koneksi, lalu coba lagi.</Feedback><div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => startTransition(() => { router.refresh(); retry(); })}>{pending ? "Memuat…" : "Coba lagi"}</Button><Button asChild variant="outline"><Link href="/dashboard">Home</Link></Button><Button asChild variant="ghost"><Link href="/login">Masuk kembali</Link></Button></div></div>;
}
