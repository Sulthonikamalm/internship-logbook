import Link from "next/link";
import { getDriveHealth } from "../server/health";

export async function DriveConnectionCard() {
  const status = await getDriveHealth();
  return <section className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
    <div><h2 className="text-sm font-semibold">Google Drive</h2>
      <p className={`mt-1 text-xs ${status.ready ? "text-muted-foreground" : "text-destructive"}`}>{status.message}</p>
    </div>
    <Link href={status.ready ? "/evidence?upload=1" : "/evidence"}
      className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
      {status.ready ? "Upload foto →" : "Buka evidence →"}
    </Link>
  </section>;
}

export function DriveConnectionFallback() {
  return <section aria-busy="true" className="glass-panel rounded-2xl p-5">
    <h2 className="text-sm font-semibold">Google Drive</h2>
    <p className="mt-1 text-xs text-muted-foreground">Memeriksa akses penyimpanan…</p>
  </section>;
}
