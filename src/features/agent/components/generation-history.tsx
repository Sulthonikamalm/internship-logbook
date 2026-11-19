import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/require-active-user";

export async function GenerationHistory() {
  const user = await requireActiveUser();
  const result = await (await createClient()).from("logbook_generation_runs").select("id,status,request_payload,created_at")
    .eq("user_id", user.userId).order("created_at", { ascending: false }).limit(20);
  return <section className="surface max-w-3xl space-y-4 p-5 sm:p-7">
    <div><h2 className="font-semibold">Laporan dari Codex</h2><p className="mt-1 text-sm text-muted-foreground">Hasil perintah Codex tersimpan di sini, lengkap dengan dokumentasi dan daftar yang perlu dilengkapi.</p></div>
    {result.error ? <p className="text-sm text-muted-foreground">Riwayat laporan dari Codex belum tersedia. Hubungi pengelola aplikasi.</p>
      : !result.data?.length ? <p className="text-sm text-muted-foreground">Belum ada laporan dari Codex.</p>
      : <ul className="divide-y">{result.data.map(run => <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><p className="text-sm font-medium">{run.request_payload.repositories.join(", ")}</p><p className="text-xs text-muted-foreground">{run.request_payload.from} — {run.request_payload.to} · {run.status === "PARTIAL" ? "Perlu dilengkapi" : "Tersimpan"}</p></div>
        <a href={`/api/reports/generations/${run.id}`} className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm text-primary">Unduh Excel</a>
      </li>)}</ul>}
  </section>;
}
