import Link from "next/link";

export default function ActivityNotFound() {
  return <section className="mx-auto max-w-xl rounded-lg border bg-card p-8 text-center">
    <h1 className="text-xl font-semibold">Aktivitas tidak tersedia</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      Aktivitas tidak ditemukan atau sudah dihapus.
    </p>
    <Link href="/activities" className="mt-5 inline-block text-sm font-medium text-primary underline">
      Kembali ke aktivitas
    </Link>
  </section>;
}
