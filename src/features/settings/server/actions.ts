"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { isValidTimezone } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({ displayName: z.string().trim().min(1, "Nama wajib diisi.").max(100), timezone: z.string().refine(isValidTimezone, "Zona waktu tidak valid.") }).strict();
export async function saveProfile(input: unknown) {
  const user = await requireActiveUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const db = await createClient();
  const { data, error } = await db.from("profiles").update({ display_name: parsed.data.displayName, timezone: parsed.data.timezone }).eq("id", user.userId).select("id").single();
  if (error || !data) return { ok: false, message: "Profil belum tersimpan. Coba lagi." };
  revalidatePath("/", "layout");
  return { ok: true };
}
