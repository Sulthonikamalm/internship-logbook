"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Edit2,
  Trash2,
  CalendarCheck2,
  Layers,
  History,
  AlertTriangle,
  Plus,
  Trash,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { TodoDetailItem, TodoPriority } from "../domain/types";
import { updateTodo, deleteTodo, attachTodoEvidence, detachTodoEvidence } from "../server/mutations";

export function TodoDetailDrawer({
  isOpen,
  onClose,
  initialData,
}: {
  todoId?: string;
  isOpen: boolean;
  onClose: () => void;
  initialData?: TodoDetailItem | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<TodoDetailItem | null>(initialData || null);
  const [prevId, setPrevId] = useState(initialData?.id);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [priority, setPriority] = useState<TodoPriority>(initialData?.priority || "MEDIUM");
  const [dueDate, setDueDate] = useState(initialData?.dueDate || "");

  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Evidence attach state
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [availableEvidences, setAvailableEvidences] = useState<Array<{ id: string; title: string | null; type: string }>>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [attachPending, setAttachPending] = useState(false);

  // Adjust state during render when initialData prop changes
  if (initialData && initialData.id !== prevId) {
    setPrevId(initialData.id);
    setData(initialData);
    setTitle(initialData.title);
    setDescription(initialData.description || "");
    setPriority(initialData.priority);
    setDueDate(initialData.dueDate || "");
  }

  // Load available evidences when attach picker opens
  useEffect(() => {
    if (showAttachPicker) {
      fetch("/api/evidence/library?limit=30")
        .then((r) => r.json())
        .then((res) => {
          if (res?.items) {
            setAvailableEvidences(
              res.items.filter((item: { status: string }) => item.status === "AVAILABLE")
            );
          }
        })
        .catch(() => {});
    }
  }, [showAttachPicker]);

  if (!isOpen || !data) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;

    setPending(true);
    setErrorMessage(null);

    try {
      const res = await updateTodo({
        id: data.id,
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || null,
        expectedVersion: data.version,
      });

      if (!res.ok) {
        setErrorMessage(res.message);
      } else {
        setIsEditing(false);
        setData((prev) => (prev ? { ...prev, ...res.data } : null));
        router.refresh();
      }
    } catch {
      setErrorMessage("Gagal memperbarui Todo.");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus Todo ini?")) return;
    setPending(true);
    try {
      await deleteTodo(data.id);
      onClose();
      router.refresh();
    } catch {
      alert("Gagal menghapus Todo.");
    } finally {
      setPending(false);
    }
  };

  const handleAttachEvidence = async () => {
    if (!selectedEvidenceId || attachPending) return;
    setAttachPending(true);
    try {
      const res = await attachTodoEvidence({
        todoId: data.id,
        evidenceId: selectedEvidenceId,
      });
      if (res.ok) {
        setShowAttachPicker(false);
        setSelectedEvidenceId("");
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch {
      alert("Gagal melampirkan evidence.");
    } finally {
      setAttachPending(false);
    }
  };

  const handleDetachEvidence = async (relId: string) => {
    if (!confirm("Lepaskan evidence ini dari Todo?")) return;
    try {
      const res = await detachTodoEvidence(relId);
      if (res.ok) {
        setData((prev) =>
          prev ? { ...prev, evidences: prev.evidences.filter((e) => e.id !== relId) } : null
        );
        router.refresh();
      } else {
        alert(res.message);
      }
    } catch {
      alert("Gagal melepas evidence.");
    }
  };

  // URL for "Catat sebagai Activity"
  const recordActivityUrl = `/activities/new?todoId=${data.id}&title=${encodeURIComponent(
    data.title
  )}&description=${encodeURIComponent(data.description || "")}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-card border-l border-border h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Rincian Todo</span>
            <Badge variant="outline" className="text-xs">
              {data.stage.name}
            </Badge>
            {data.evidenceHealth === "EVIDENCE_INCOMPLETE" && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Evidence Kurang
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(!isEditing)}
              title="Edit Todo"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              title="Hapus Todo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* Edit Form OR View Details */}
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Judul Todo</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Deskripsi</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Prioritas</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TodoPriority)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Jatuh Tempo</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-foreground leading-snug">{data.title}</h1>
                {data.description ? (
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {data.description}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground italic">Tidak ada deskripsi.</p>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/30 text-xs">
                <div>
                  <span className="text-muted-foreground block">Prioritas</span>
                  <span className="font-semibold text-foreground">{data.priority}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Jatuh Tempo</span>
                  <span className="font-semibold text-foreground">{data.dueDate || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Mulai</span>
                  <span className="font-semibold text-foreground">
                    {data.startedAt ? new Date(data.startedAt).toLocaleDateString("id-ID") : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Selesai</span>
                  <span className="font-semibold text-foreground">
                    {data.completedAt ? new Date(data.completedAt).toLocaleDateString("id-ID") : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Helper: Catat sebagai Activity */}
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between gap-4">
            <div className="space-y-0.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                Catat ke Jurnal Activity
              </span>
              <p className="text-muted-foreground">
                Salin judul dan deskripsi Todo ini langsung ke formulir Activity harian.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 gap-1.5 text-xs shadow-xs">
              <Link href={recordActivityUrl}>
                <span>Catat sebagai Activity</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          {/* Section: Attached Evidence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Evidence Terlampir ({data.evidences.length})
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowAttachPicker(!showAttachPicker)}
              >
                <Plus className="h-3 w-3" />
                <span>Lampirkan</span>
              </Button>
            </div>

            {showAttachPicker && (
              <div className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs">
                <label className="font-medium text-foreground">Pilih dari Evidence Library:</label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="">-- Pilih Evidence --</option>
                  {availableEvidences.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title || (ev.type === "PHOTO" ? "Foto" : "Tautan")} ({ev.type})
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAttachPicker(false)}>
                    Batal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!selectedEvidenceId || attachPending}
                    onClick={handleAttachEvidence}
                  >
                    {attachPending ? "Menyimpan..." : "Simpan Lampiran"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {data.evidences.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-md border border-border/80 bg-background flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                      {ev.type}
                    </Badge>
                    <span className="font-medium text-foreground truncate">{ev.title || "Evidence tanpa judul"}</span>
                    {ev.status === "BROKEN" && (
                      <span className="text-[10px] font-semibold text-destructive">Rusak</span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDetachEvidence(ev.id)}
                    title="Lepas lampiran"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {data.evidences.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Belum ada evidence terlampir pada Todo ini.</p>
              )}
            </div>
          </div>

          {/* Section: Linked Activities */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
              Activity Terkait ({data.activities.length})
            </h3>
            <div className="space-y-2">
              {data.activities.map((act) => (
                <Link
                  key={act.id}
                  href={`/activities/${act.id}`}
                  className="p-2.5 rounded-md border border-border/70 hover:border-primary/50 bg-background flex items-center justify-between text-xs transition-colors group"
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {act.title}
                  </span>
                  <span className="text-muted-foreground">{act.activityDate}</span>
                </Link>
              ))}
              {data.activities.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Belum ada Activity yang ditautkan ke Todo ini.</p>
              )}
            </div>
          </div>

          {/* Section: Transition History */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-muted-foreground" />
              Riwayat Perjalanan (Audit Trail)
            </h3>
            <div className="space-y-2.5">
              {data.transitions.map((t) => (
                <div key={t.id} className="p-2.5 rounded-md border border-border/50 bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t.fromStageName ? `${t.fromStageName} → ` : ""}
                      {t.toStageName}
                    </span>
                    <span className="text-[11px]">{new Date(t.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                  {t.note && <p className="text-foreground/90 italic">&ldquo;{t.note}&rdquo;</p>}
                  <span className="text-[10px] text-muted-foreground block">
                    Evidence tervalidasi: {t.evidenceCount}
                  </span>
                </div>
              ))}
              {data.transitions.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Belum ada riwayat transisi.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
