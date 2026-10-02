import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck2, Images, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (user) redirect("/dashboard");
  return <div className="app-canvas min-h-dvh">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><Brand /><Button asChild variant="outline"><Link href="/login">Masuk<ArrowRight size={17} className="ml-2" /></Link></Button></header>
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="max-w-3xl"><p className="eyebrow mb-5 text-primary">Your internship, in flow</p><h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl">Kerja yang berarti.<br /><span className="text-primary">Catatan yang rapi.</span></h1><p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">Catat kegiatan, kumpulkan bukti, dan siapkan laporan magang dalam satu workspace.</p><Button asChild size="lg" className="mt-8 gap-3"><Link href="/login">Buka workspace<ArrowRight size={18} /></Link></Button></div>
      <section aria-label="Fitur InternFlow" className="glass-panel mt-16 grid gap-8 rounded-3xl p-7 shadow-[var(--shadow-glass)] sm:grid-cols-3 sm:p-9">
        {[{ icon: CalendarCheck2, title: "Catat dengan cepat", text: "Activity harian dan todo dalam satu alur." }, { icon: Images, title: "Bukti di satu tempat", text: "Foto, tautan, dan commit pilihanmu." }, { icon: FileSpreadsheet, title: "Siap untuk laporan", text: "Logbook rapi, ekspor Excel kapan saja." }].map(item => <div key={item.title}><item.icon size={25} strokeWidth={1.6} className="mb-5 text-primary" /><h2 className="text-base font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p></div>)}
      </section>
    </main>
  </div>;
}
