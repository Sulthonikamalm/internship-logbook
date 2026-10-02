import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/components/login-form";
import { Brand } from "@/components/layout/brand";
import { safeLoginRedirect } from "@/lib/auth/safe-redirect";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
export const metadata: Metadata = { title: "Masuk — InternFlow" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  if (user) redirect(safeLoginRedirect(params.next));
  return <main className="auth-canvas flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8 sm:py-16"><div className="relative grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
    <section className="hidden space-y-12 lg:block" aria-label="InternFlow"><Brand /><div><p className="mb-5 text-sm font-medium text-primary">Satu workspace, semua kegiatan.</p><p className="max-w-md text-5xl font-semibold leading-[1.12] tracking-[-.04em]">Magang.<br />Tugas akhir.<br /><span className="text-primary">Rutinitasmu.</span></p><p className="mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">Rencanakan tugas, simpan bukti, dan susun laporan dari pekerjaanmu.</p></div><div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">{["Rencanakan", "Kerjakan", "Catat"].map(label => <span key={label} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" />{label}</span>)}</div></section>
    <div className="w-full max-w-md justify-self-center"><div className="mb-9 flex justify-center lg:hidden"><Brand /></div><section className="glass-panel rounded-[1.75rem] p-6 shadow-[var(--shadow-float)] sm:p-9"><p className="mb-3 text-xs font-medium text-primary">Workspace kamu</p><h1 className="text-[1.8rem] font-semibold leading-tight sm:text-[2rem]">Selamat datang<br />kembali.</h1><p className="mb-8 mt-3 text-sm text-muted-foreground">Lanjutkan dari langkah terakhirmu.</p><LoginForm nextUrl={params.next} /><div className="mt-7 flex items-center gap-3 border-t border-border/60 pt-5"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary"><ShieldCheck size={21} /></span><p className="text-xs leading-relaxed text-muted-foreground">Aktivitas dan bukti terhubung<br />ke akun pribadimu.</p></div></section><p className="mt-6 text-center text-xs text-muted-foreground">InternFlow · Rencanakan. Kerjakan. Catat.</p></div>
  </div></main>;
}
