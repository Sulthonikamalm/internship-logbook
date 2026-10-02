import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { listManagedUsers } from "@/features/admin/server/list-users";
import { CreateUserDialog } from "@/features/admin/components/create-user-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Pengguna — InternFlow" };
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams; const raw = Number(params.page); const page = Number.isInteger(raw) && raw > 0 && raw <= 1000 ? raw : 1;
  const data = await listManagedUsers(page);
  return <div className="space-y-6"><PageHeader title="Pengguna" description="Buat akun langsung dari workspace." action={<CreateUserDialog />} />
    <div className="flex flex-wrap items-center gap-3 text-sm"><Badge><ShieldCheck size={14} />Super admin</Badge><span className="text-muted-foreground">{data.total} pengguna</span></div>
    <section className="surface overflow-hidden" aria-label="Daftar pengguna"><div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_80px_110px] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid"><span>Nama</span><span>Email</span><span>Status</span><span>Dibuat</span></div>
      {data.users.map(user => <div key={user.id} className="grid min-w-0 gap-2 border-b p-5 last:border-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_80px_110px] lg:items-center lg:gap-4"><p className="break-words text-sm font-medium">{user.name}</p><p className="break-all text-sm text-muted-foreground">{user.email}</p><div><Badge variant={user.active ? "success" : "secondary"}>{user.active ? "Aktif" : "Nonaktif"}</Badge></div><p className="text-xs text-muted-foreground">{user.createdAt.slice(0, 10)}</p></div>)}
    </section><nav aria-label="Halaman pengguna" className="flex items-center justify-between"><Button asChild variant="outline" disabled={page === 1}><Link href={`/admin/users?page=${Math.max(1, page - 1)}`}>Sebelumnya</Link></Button><span className="text-sm text-muted-foreground">Halaman {page}</span>{data.nextPage ? <Button asChild variant="outline"><Link href={`/admin/users?page=${data.nextPage}`}>Berikutnya</Link></Button> : <span />}</nav>
  </div>;
}
