import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProtectedNotFound() {
  return <div className="mx-auto max-w-lg pt-8">
    <section className="surface px-6 py-12 text-center">
      <SearchX size={28} className="mx-auto mb-4 text-primary" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Halaman tidak tersedia</h1>
      <p className="mt-2 text-sm text-muted-foreground">Periksa tautan atau kembali ke Home.</p>
      <Button asChild className="mt-6"><Link href="/dashboard">Kembali ke Home</Link></Button>
    </section>
  </div>;
}
