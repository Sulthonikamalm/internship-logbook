"use client";
import { useRef, useState } from "react";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback } from "@/components/ui/feedback";
import { createManagedUser } from "../server/users";

export function CreateUserDialog() {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget; const values = new FormData(form);
    lock.current = true; setPending(true); setError("");
    try {
      const result = await createManagedUser({ name: values.get("name"), email: values.get("email"), password: values.get("password") });
      if (!result.ok) { setError(result.message); return; }
      form.reset(); setVisible(false); setOpen(false); toast.success("Pengguna dibuat. Akun siap masuk."); router.refresh();
    } catch { setError("Respons belum diterima. Periksa daftar pengguna sebelum mencoba lagi."); }
    finally { lock.current = false; setPending(false); }
  }
  return <><Button onClick={() => { setError(""); setVisible(false); setOpen(true); }}><UserPlus size={17} />Tambah pengguna</Button>
    <Modal open={open} onClose={() => setOpen(false)} busy={pending} title="Pengguna baru" description="Akun langsung aktif setelah dibuat.">
      <form onSubmit={submit} className="space-y-5" aria-busy={pending}><fieldset disabled={pending} className="space-y-4">
        <label className="block space-y-2 text-sm font-medium"><span>Nama</span><Input name="name" autoComplete="off" required minLength={2} maxLength={100} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Email</span><Input name="email" type="email" autoComplete="off" required maxLength={254} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Password</span><div className="relative"><Input name="password" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} className="pr-12" /><button type="button" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={visible} onClick={() => setVisible(value => !value)} className="absolute top-0 right-0 flex size-11 items-center justify-center text-muted-foreground">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><span className="block text-xs font-normal text-muted-foreground">Minimal 12 karakter. Berikan langsung kepada pengguna.</span></label>
      </fieldset>{error && <Feedback>{error}</Feedback>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Batal</Button><Button disabled={pending}>{pending ? "Membuat…" : "Buat akun"}</Button></div></form>
    </Modal></>;
}
