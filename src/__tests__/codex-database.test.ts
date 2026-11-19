// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
let db: PGlite;
async function asUser(id = owner) {
  await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`);
}
async function photo(checksum = "a".repeat(64)) {
  await db.exec("RESET ROLE");
  const id = randomUUID();
  await db.query("INSERT INTO public.evidences(id,user_id,type,status,upload_id,title) VALUES($1,$2,'PHOTO','UPLOADING',$3,'Bukti')", [id, owner, randomUUID()]);
  await db.query("INSERT INTO public.photo_evidences(evidence_id,drive_file_id,drive_folder_id,stored_filename,mime_type,size_bytes,checksum,width,height) VALUES($1,$2,'folder','image.png','image/png',100,$3,10,10)", [id, randomUUID(), checksum]);
  await db.query("UPDATE public.evidences SET status='AVAILABLE' WHERE id=$1", [id]);
  await asUser(); return id;
}
function payload(evidenceId: string, date = "2020-10-01") {
  return { request: { requestId: randomUUID(), period: "daily", from: date, to: date, category: "INTERNSHIP", repositories: ["owner/project"] },
    plan: { entries: [{ date, title: "Mengerjakan fitur", description: "Berdasarkan dokumentasi pekerjaan.", evidenceIds: [evidenceId], sourceRefs: [{ kind: "photo", id: evidenceId }] }], gaps: [], summary: "Selesai mengerjakan fitur." } };
}
async function save(value: ReturnType<typeof payload>) {
  return db.query<{ result: { id: string; status: string; snapshot: { activities: { id: string }[] } } }>("SELECT to_jsonb(public.save_logbook_generation($1::jsonb,$2::jsonb)) result", [JSON.stringify(value.request), JSON.stringify(value.plan)]);
}

describe("Codex migrations and transactional evidence allocation", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated,service_role;`);
    for (const name of (await readdir(resolve("supabase/migrations"))).filter(name => name.endsWith(".sql")).sort()) {
      let sql = await readFile(resolve("supabase/migrations", name), "utf8");
      // PGlite runs PostgreSQL itself; only the provider's cron scheduler is absent.
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_cron[\s\S]*?(?=NOTIFY pgrst)/, "");
      try { await db.exec(sql); } catch (error) { const info = error as Error & { position?: string; internalPosition?: string; internalQuery?: string }; const query = info.internalQuery ?? sql; const position = Number(info.internalPosition ?? info.position ?? 0); throw new Error(`Migration ${name}: ${info.message} at ${position}: ${query.slice(Math.max(0, position - 120), position + 120)}`); }
    }
    await db.exec("GRANT USAGE ON SCHEMA private TO authenticated;");
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'owner@example.test'),($2,'other@example.test')", [owner, other]);
    await asUser();
  }, 60000);
  afterAll(async () => { await db?.close(); });

  it("replays every application migration and saves an owned photo and snapshot", async () => {
    const id = await photo(); const value = payload(id); const result = (await save(value)).rows[0].result;
    expect(result.status).toBe("SAVED");
    expect(result.snapshot.activities).toHaveLength(1);
    expect((await db.query("SELECT * FROM public.logbook_photo_allocations WHERE evidence_id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM public.audit_logs WHERE entity_id=$1 AND action='report.codex_saved'", [result.id])).rows).toHaveLength(1);
  });
  it("replays a request without creating a second activity, and rejects changed content", async () => {
    const id = await photo("b".repeat(64)); const value = payload(id);
    const first = (await save(value)).rows[0].result;
    expect((await save(value)).rows[0].result.id).toBe(first.id);
    value.plan.summary = "Isi berbeda";
    await expect(save(value)).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  });
  it("reuses the same activity across independently requested reports", async () => {
    const id = await photo("c".repeat(64)); const value = payload(id);
    const first = (await save(value)).rows[0].result;
    value.request.requestId = randomUUID();
    expect((await save(value)).rows[0].result.snapshot.activities[0].id).toBe(first.snapshot.activities[0].id);
  });
  it("rejects assigning the same image checksum to another day, atomically", async () => {
    const id = await photo("d".repeat(64)); await save(payload(id));
    const duplicate = await photo("d".repeat(64)); const value = payload(duplicate, "2020-10-02");
    await expect(save(value)).rejects.toThrow("PHOTO_ALREADY_USED");
    expect((await db.query("SELECT id FROM public.logbook_generation_runs WHERE request_id=$1", [value.request.requestId])).rows).toHaveLength(0);
  });
  it("detects prior manual attachments on a duplicate upload", async () => {
    const id = await photo("e".repeat(64));
    const activity = (await db.query<{ id: string }>("INSERT INTO public.activities(user_id,title,activity_date,source,status,work_category) VALUES($1,'Manual','2020-09-30','manual','READY','INTERNSHIP') RETURNING id", [owner])).rows[0];
    await db.query("INSERT INTO public.activity_evidences(activity_id,evidence_id,attached_by) VALUES($1,$2,$3)", [activity.id, id, owner]);
    const duplicate = await photo("e".repeat(64));
    expect((await db.query<{ used: boolean }>("SELECT used FROM public.logbook_photo_inventory WHERE id=$1", [duplicate])).rows[0].used).toBe(true);
    await expect(save(payload(duplicate))).rejects.toThrow("PHOTO_ALREADY_USED");
  });
  it("denies cross-owner sources, snapshots, and disabled accounts", async () => {
    const id = await photo("f".repeat(64)); const value = payload(id);
    await asUser(other); await expect(save(value)).rejects.toThrow("Source unavailable");
    expect((await db.query("SELECT * FROM public.logbook_generation_runs")).rows).toHaveLength(0);
    await db.exec("RESET ROLE"); await db.query("UPDATE public.profiles SET is_active=false WHERE id=$1", [other]);
    await asUser(other); await expect(save(value)).rejects.toThrow("Active account required"); await asUser();
  });
  it("creates a multi-photo draft atomically and replays its retry", async () => {
    const first = await photo("1".repeat(64)); const second = await photo("2".repeat(64)); const key = randomUUID();
    const query = "SELECT to_jsonb(public.create_photo_batch_activity($1,$2::uuid[],'2020-10-01','INTERNSHIP')) result";
    const result = await db.query<{ result: { id: string; status: string } }>(query, [key, [first, second]]);
    expect(result.rows[0].result.status).toBe("DRAFT");
    expect((await db.query(query, [key, [second, first]])).rows).toEqual(result.rows);
    expect((await db.query("SELECT * FROM public.activity_evidences WHERE activity_id=$1", [result.rows[0].result.id])).rows).toHaveLength(2);
  });
  it("matches repository casing while enforcing a reconstructed screenshot's commit and day", async () => {
    await db.exec("RESET ROLE");
    const connectionId = randomUUID(); const commitId = randomUUID();
    await db.query("INSERT INTO public.github_connections(id,user_id,github_user_id,github_username,connection_status) VALUES($1,$2,'123','Owner','CONNECTED')", [connectionId, owner]);
    await db.query("INSERT INTO public.github_commits(id,user_id,github_connection_id,repository_id,repository_name,sha,author_date) VALUES($1,$2,$3,'repo-1','Owner/Project',$4,'2020-10-01T03:00:00Z')", [commitId, owner, connectionId, "a".repeat(40)]);
    const id = await photo("3".repeat(64));
    await db.exec("RESET ROLE");
    await db.query("UPDATE public.evidences SET metadata=$1::jsonb WHERE id=$2", [JSON.stringify({ source: "github_reconstruction", repository: "Owner/Project", commitId, commitDate: "2020-10-01T03:00:00Z" }), id]);
    await asUser();
    const value = payload(id); value.plan.entries[0].sourceRefs.push({ kind: "commit", id: commitId });
    expect((await save(value)).rows[0].result.status).toBe("SAVED");
    const wrongProject = payload(id); wrongProject.request.repositories = ["owner/other-project"];
    wrongProject.plan.entries[0].sourceRefs.push({ kind: "commit", id: commitId });
    await expect(save(wrongProject)).rejects.toThrow("Source unavailable");
    const missingCommit = payload(id); missingCommit.request.requestId = randomUUID();
    missingCommit.plan.entries[0].sourceRefs = [{ kind: "photo", id }];
    await expect(save(missingCommit)).rejects.toThrow("Screenshot commit/date must match its source");
  });
});
