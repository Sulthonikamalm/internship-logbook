import "server-only";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { readAllRows, relatedOne } from "@/lib/supabase/read-all-rows";
import { mergeWorkRecords, type RecordActivity, type RecordCompletion } from "../domain/records";
import type { WorkCategory } from "../domain/category";

export async function getWorkRecords(from: string, to: string, category?: WorkCategory) {
  const user = await requireActiveUser(); const db = await createClient();
  const start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
  const activities = await readAllRows((first, last) => {
    let query = db.from("activities").select("id,title,description,activity_date,start_time,end_time,status,work_category,todo_id,completion_transition_id,created_at,deleted_at")
      .eq("user_id", user.userId).gte("activity_date", from).lte("activity_date", to);
    if (category) query = query.eq("work_category", category);
    return query.order("activity_date").order("id").range(first, last);
  }, "Catatan pekerjaan gagal dimuat.");
  const stage = await db.from("todo_stages").select("id").eq("code", "DONE").single();
  if (stage.error) throw new Error("Tahap selesai tidak tersedia.");
  const completions = await readAllRows((first, last) => {
    let query = db.from("todo_transitions").select("id,todo_id,created_at,work_category,completion_snapshot,todo:todos(title,description,work_category,deleted_at)")
      .eq("user_id", user.userId).eq("to_stage_id", stage.data.id).gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    if (category) query = query.eq("work_category", category);
    return query.order("created_at").order("id").range(first, last);
  }, "Riwayat pekerjaan gagal dimuat.");
  return { user, records: mergeWorkRecords(activities as RecordActivity[], completions.map(row => ({ ...row, todo: relatedOne(row.todo) })) as RecordCompletion[], from, to, user.timezone) };
}
