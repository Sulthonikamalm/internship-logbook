import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import type { WorkCategory } from "@/features/work/domain/category";
export type ActivityDay = { activity_date: string; has_ready: boolean; draft_id: string | null };
export async function getActivityDays(from: string, to: string, category: WorkCategory = "INTERNSHIP"): Promise<ActivityDay[]> {
  await requireActiveUser(); const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_days", { p_from: from, p_to: to, p_category: category });
  if (error) throw new Error("Ringkasan hari belum dapat dimuat.");
  return (data ?? []) as ActivityDay[];
}
