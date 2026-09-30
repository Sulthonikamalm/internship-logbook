"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createActivity } from "../server/create-activity";
import { updateActivity } from "../server/update-activity";
import { localDateAt, maxActivityDate } from "../domain/date";
import { loadActivityDraft, removeActivityDraft, saveActivityDraft, type ActivityDraft } from "../domain/draft";
import type { Activity, ActivityStatus } from "../domain/types";
import { activityFieldsSchema } from "../schemas/activity";

type FormValues = {
  title: string; description: string; activityDate: string;
  startTime: string; endTime: string; status: ActivityStatus;
};

type Props = {
  userId: string;
  timezone: string;
  quick?: boolean;
  activity?: Activity;
};

export function ActivityForm({ userId, timezone, quick = false, activity }: Props) {
  const router = useRouter();
  const draftId = activity ? `edit-${activity.id}` : quick ? "quick" : "new";
  const today = localDateAt(new Date(), timezone);
  const initial: FormValues = {
    title: activity?.title ?? "", description: activity?.description ?? "",
    activityDate: activity?.activity_date ?? today,
    startTime: activity?.start_time?.slice(0, 5) ?? "",
    endTime: activity?.end_time?.slice(0, 5) ?? "",
    status: activity?.status ?? "DRAFT",
  };
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [restore, setRestore] = useState<ActivityDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const keyRef = useRef<string>(crypto.randomUUID());
  const valuesRef = useRef(values);
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    valuesRef.current = values;
    dirtyRef.current = dirty;
  }, [values, dirty]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRestore(loadActivityDraft(userId, draftId));
      setDraftChecked(true);
    });
    return () => { cancelled = true; };
  }, [userId, draftId]);

  useEffect(() => {
    if (!draftChecked || restore || !dirty) return;
    const timer = window.setTimeout(() => {
      const saved = saveActivityDraft(userId, draftId, {
        ...values, source: quick ? "quick_capture" : "manual",
        idempotencyKey: keyRef.current, savedAt: new Date().toISOString(),
      });
      if (!saved) setMessage("Draf lokal tidak dapat disimpan di perangkat ini.");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [values, dirty, draftChecked, restore, userId, draftId, quick]);

  useEffect(() => {
    function preserveDraft() {
      if (!dirtyRef.current) return;
      saveActivityDraft(userId, draftId, {
        ...valuesRef.current, source: quick ? "quick_capture" : "manual",
        idempotencyKey: keyRef.current, savedAt: new Date().toISOString(),
      });
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      preserveDraft();
      if (dirtyRef.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", preserveDraft);
    return () => {
      preserveDraft();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", preserveDraft);
    };
  }, [userId, draftId, quick]);

  function change<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setErrors((current) => ({ ...current, [field]: "" }));
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const source: "quick_capture" | "manual" = quick ? "quick_capture" : "manual";
    const input = {
      ...values,
      description: values.description,
      startTime: values.startTime,
      endTime: values.endTime,
      source,
    };
    const parsed = activityFieldsSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) =>
        [String(issue.path[0] ?? "form"), issue.message])));
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const result = activity
        ? await updateActivity(activity.id, { ...input, expectedVersion: activity.version })
        : await createActivity({ ...input, status: values.status === "ARCHIVED" ? "DRAFT" : values.status,
          idempotencyKey: keyRef.current });
      if (!result.ok) {
        setErrors(result.fields ?? {});
        setMessage(result.message);
        return;
      }
      removeActivityDraft(userId, draftId);
      dirtyRef.current = false;
      setDirty(false);
      router.push(`/activities/${result.activity.id}`);
      router.refresh();
    } catch {
      setMessage("Respons belum diterima. Coba lagi; kunci penyimpanan yang sama akan dipakai.");
    } finally {
      setPending(false);
    }
  }

  function reloadLatest() {
    saveActivityDraft(userId, draftId, {
      ...valuesRef.current, source: quick ? "quick_capture" : "manual",
      idempotencyKey: keyRef.current, savedAt: new Date().toISOString(),
    });
    dirtyRef.current = false;
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {restore && (
        <div className="rounded-lg border border-primary/40 bg-secondary p-4" role="status">
          <p className="font-medium">Draf aktivitas sebelumnya ditemukan.</p>
          <p className="text-sm text-muted-foreground">Disimpan {new Date(restore.savedAt).toLocaleString("id-ID")}.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => {
              setValues({ title: restore.title, description: restore.description,
                activityDate: restore.activityDate, startTime: restore.startTime,
                endTime: restore.endTime, status: restore.status });
              keyRef.current = restore.idempotencyKey;
              setDirty(true); setRestore(null);
            }}>Pulihkan</button>
            <button type="button" className="text-sm" onClick={() => {
              removeActivityDraft(userId, draftId); setRestore(null);
            }}>Hapus</button>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="activity-title" className="mb-1 block text-sm font-medium">
          {quick ? "Catatan singkat" : "Judul aktivitas"}
        </label>
        <input id="activity-title" name="title" value={values.title}
          onChange={(event) => change("title", event.target.value)} maxLength={160}
          autoFocus={quick} autoComplete="off" aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
          placeholder={quick ? "Apa yang Anda kerjakan?" : "Contoh: Membuat laporan mingguan"}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base" />
        {errors.title && <p id="title-error" className="mt-1 text-sm text-destructive">{errors.title}</p>}
      </div>
      <div>
        <label htmlFor="activity-date" className="mb-1 block text-sm font-medium">Tanggal kerja</label>
        <input id="activity-date" type="date" value={values.activityDate}
          onChange={(event) => change("activityDate", event.target.value)} max={maxActivityDate(today)}
          aria-invalid={Boolean(errors.activityDate)}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-base" />
        {errors.activityDate && <p className="mt-1 text-sm text-destructive">{errors.activityDate}</p>}
      </div>
      <details open={!quick} className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-medium">{quick ? "Detail tambahan" : "Rincian aktivitas"}</summary>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="activity-description" className="mb-1 block text-sm font-medium">Deskripsi</label>
            <textarea id="activity-description" value={values.description}
              onChange={(event) => change("description", event.target.value)} rows={4} maxLength={10000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="activity-start" className="mb-1 block text-sm font-medium">Jam mulai</label>
              <input id="activity-start" type="time" value={values.startTime}
                onChange={(event) => change("startTime", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" /></div>
            <div><label htmlFor="activity-end" className="mb-1 block text-sm font-medium">Jam selesai</label>
              <input id="activity-end" type="time" value={values.endTime}
                onChange={(event) => change("endTime", event.target.value)} aria-invalid={Boolean(errors.endTime)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
              {errors.endTime && <p className="text-sm text-destructive">{errors.endTime}</p>}</div>
          </div>
          <div><label htmlFor="activity-status" className="mb-1 block text-sm font-medium">Status</label>
            <select id="activity-status" value={values.status}
              onChange={(event) => change("status", event.target.value as ActivityStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base">
              <option value="DRAFT">Draf</option><option value="READY">Siap untuk logbook</option>
              {activity && <option value="ARCHIVED">Arsip</option>}
            </select></div>
        </div>
      </details>
      {message && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Menyimpan..." : "Simpan aktivitas"}
        </button>
        {activity && message.includes("perangkat lain") &&
          <button type="button" onClick={reloadLatest} className="text-sm text-primary underline">Muat ulang</button>}
        {dirty && <span className="text-xs text-muted-foreground">Perubahan belum tersimpan</span>}
      </div>
    </form>
  );
}
