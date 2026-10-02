"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, PencilLine } from "lucide-react";
import { activityDraftKey, loadActivityDraft } from "@/features/activity/domain/draft";

const subscribe = (notify: () => void) => {
  window.addEventListener("storage", notify); window.addEventListener("focus", notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener("focus", notify); };
};
export function LocalDraftShortcut({ userId }: { userId: string }) {
  const raw = useSyncExternalStore(subscribe, () => {
    try {
      const prefix = activityDraftKey(userId, "");
      const drafts = Object.keys(localStorage).filter(key => key.startsWith(prefix)).flatMap(key => {
        const id = key.slice(prefix.length);
        const validId = /^(quick|new|(?:edit|todo)-[0-9a-f-]{36})$/.test(id);
        const value = validId ? loadActivityDraft(userId, id) : null;
        if (!value?.title.trim()) return [];
        const href = id.startsWith("edit-") ? `/activities/${id.slice(5)}/edit` : id.startsWith("todo-") ? `/activities/new?todoId=${id.slice(5)}` : id === "quick" ? "/activities/new?quick=1" : "/activities/new";
        return [{ title: value.title, savedAt: value.savedAt, href }];
      }).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      return drafts[0] ? JSON.stringify({ title: drafts[0].title, href: drafts[0].href }) : null;
    } catch { return null; }
  }, () => null);
  const draft = raw ? JSON.parse(raw) as { title: string; href: string } : null;
  if (!draft) return null;
  return <Link href={draft.href} className="pressable surface flex items-center gap-3 p-4">
    <PencilLine size={20} className="shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Draft di perangkat ini</p><p className="truncate text-sm font-medium">{draft.title}</p></div><ArrowUpRight size={18} />
  </Link>;
}
