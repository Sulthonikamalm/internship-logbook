"use client";

export default function ActivitiesError({ reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="rounded-lg border p-8 text-center">
    <h1 className="font-semibold">Aktivitas gagal dimuat</h1>
    <p className="mt-1 text-sm text-muted-foreground">Periksa koneksi Anda lalu coba lagi.</p>
    <button onClick={reset} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Coba lagi</button>
  </div>;
}
