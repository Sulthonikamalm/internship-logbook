import "server-only";

import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "../domain/types";

export async function getActivity(id: string): Promise<Activity | null> {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").select("*")
    .eq("id", id).eq("user_id", user.userId).is("deleted_at", null).maybeSingle();
  if (error) {
    console.error(`[activity.get] database code=${error.code}`);
    return null;
  }
  return data as Activity | null;
}
