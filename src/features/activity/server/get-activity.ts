import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "../domain/types";
import { z } from "zod";

export async function getActivity(id: string): Promise<Activity | null> {
  const user = await requireActiveUser();
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").select("*")
    .eq("id", id).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
  if (error) {
    console.error(`[activity.get] database code=${error.code}`);
    throw new Error("Activity gagal dimuat.");
  }
  return data as Activity | null;
}
