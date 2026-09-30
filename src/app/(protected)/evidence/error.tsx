"use client";

export default function EvidenceError({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-lg border p-6">
    <p>Evidence gagal dimuat.</p>
    <button onClick={reset} className="mt-2 text-primary underline">Coba lagi</button>
  </div>;
}
