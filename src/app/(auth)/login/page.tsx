import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/features/auth/components/login-form";
import { Brand } from "@/components/layout/brand";
import { safeLoginRedirect } from "@/lib/auth/safe-redirect";
export const metadata: Metadata = { title: "Masuk — InternFlow" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  if (user) redirect(safeLoginRedirect(params.next));
  return <main className="app-canvas flex min-h-dvh items-center justify-center px-5 py-12"><div className="w-full max-w-sm space-y-7"><div className="flex justify-center"><Brand /></div><div className="glass-panel rounded-3xl p-6 sm:p-8"><h1 className="text-2xl font-semibold">Selamat datang</h1><p className="mb-7 mt-2 text-sm text-muted-foreground">Masuk untuk melanjutkan pekerjaan.</p><LoginForm nextUrl={params.next} /></div><p className="text-center text-xs text-muted-foreground">InternFlow · Logbook magang</p></div></main>;
}
