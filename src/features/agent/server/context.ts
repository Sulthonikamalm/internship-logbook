import "server-only";
import { utcRangeForLocalDay } from "@/features/evidence/domain/date";
import type { GenerationRequest } from "../domain/schema";
import { AgentError, type AgentActor } from "./auth";

export async function getGenerationContext(actor: AgentActor, request: GenerationRequest, page: number) {
  const { db, user } = actor; const first = (page - 1) * 50; const last = first + 49;
  const start = utcRangeForLocalDay(request.from, user.timezone).start;
  const end = utcRangeForLocalDay(request.to, user.timezone).end;
  const repositories = await Promise.all(request.repositories.map(async repository => {
    const result = await db.from("github_commits").select("repository_name").eq("user_id", user.userId)
      .ilike("repository_name", repository.replace(/[_%\\]/g, "\\$&")).limit(1).maybeSingle();
    if (result.error) throw new AgentError("Daftar repository gagal dimuat.", 503);
    return result.data?.repository_name ?? repository;
  }));
  const results = await Promise.all([
    db.from("canonical_activities").select("id,title,description,activity_date,start_time,end_time,status,source,version,todo_id", { count: "exact" })
      .eq("user_id", user.userId).eq("work_category", request.category).neq("status", "ARCHIVED").gte("activity_date", request.from).lte("activity_date", request.to).order("activity_date").order("id").range(first, last),
    db.from("todos").select("id,title,description,completed_at,work_category", { count: "exact" }).eq("user_id", user.userId)
      .eq("work_category", request.category).is("deleted_at", null).order("id").range(first, last),
    db.from("attendance_sessions").select("id,work_date,started_at,ended_at,auto_closed", { count: "exact" }).eq("user_id", user.userId)
      .gte("work_date", request.from).lte("work_date", request.to).order("work_date").order("id").range(first, last),
    db.from("github_commits").select("id,repository_name,sha,message,author_date,source_status", { count: "exact" }).eq("user_id", user.userId)
      .in("repository_name", repositories).gte("author_date", start).lt("author_date", end).order("author_date").order("id").range(first, last),
    db.from("logbook_photo_inventory").select("id,title,note,captured_at,created_at,original_filename,metadata,used,allocated_activity_id", { count: "exact" })
      .eq("user_id", user.userId).eq("status", "AVAILABLE").is("deleted_at", null).order("captured_at", { ascending: true, nullsFirst: false }).order("id").range(first, last),
    db.from("internship_settings").select("start_date,end_date,working_days").eq("user_id", user.userId).maybeSingle(),
  ]);
  if (results.some(result => result.error)) throw new AgentError("Konteks belum dapat dimuat. Pastikan migrasi Codex sudah diterapkan.", 503, "CONTEXT_UNAVAILABLE");
  const names = ["activities", "todos", "attendance", "commits", "photos"];
  const sections = Object.fromEntries(results.slice(0, 5).map((result, index) => [names[index], {
    items: result.data, count: "count" in result ? result.count : 0,
    hasMore: "count" in result && (result.count ?? 0) > last + 1,
  }]));
  const ids = (results[0].data as { id: string }[] ?? []).map(row => row.id);
  const relations = ids.length ? await db.from("canonical_activity_evidences").select("activity_id,evidence_id").eq("attached_by", user.userId).in("activity_id", ids) : { data: [], error: null };
  if (relations.error) throw new AgentError("Relasi bukti gagal dimuat.", 503);
  return { request, page, user: { displayName: user.displayName, timezone: user.timezone }, ...sections,
    activityEvidence: relations.data, settings: results[5].data,
    instructions: "Periksa gambar sebelum memasangkan foto. used=true hanya boleh dipakai kembali untuk kegiatan yang sama; database memeriksa kembali secara atomik. created_at adalah waktu unggah, bukan tanggal kegiatan. Jangan mengarang hari kosong. Repo dan kategori membatasi sumber kegiatan." };
}
