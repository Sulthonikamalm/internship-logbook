import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
export type ActivityDay = { activity_date: string; has_ready: boolean; draft_id: string | null };
export async function getActivityDays(from: string, to: string): Promise<ActivityDay[]> {
  await requireActiveUser(); const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_days", { p_from: from, p_to: to });
  if (error) throw new Error("Ringkasan hari belum dapat dimuat.");
  return (data ?? []) as ActivityDay[];
}
