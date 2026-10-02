import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/require-active-user";
import { ActivityForm } from "@/features/activity/components/activity-form";
import { QuickActivitySheet } from "@/features/activity/components/quick-activity-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { parseWorkCategory } from "@/features/work/domain/category";
import { getTodoDetail } from "@/features/todos/server/get-todo-detail";
import { notFound } from "next/navigation";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ quick?: string; date?: string; returnTo?: string; todoId?: string; title?: string; description?: string; category?: string }> }) {
  const user = await requireActiveUser(); const search = await searchParams;
  const returnTo = search.returnTo ? safeRedirect(search.returnTo) : undefined;
  const backUrl = returnTo || (search.todoId ? "/todos" : search.quick === "1" ? "/dashboard" : "/activities");
  const todo = search.todoId ? await getTodoDetail(search.todoId) : null;
  if (search.todoId && !todo) notFound();
  const props = { userId: user.userId, timezone: user.timezone, initialCategory: parseWorkCategory(todo?.workCategory ?? search.category), initialDate: search.date, initialTitle: todo?.title ?? search.title, initialDescription: todo?.description ?? search.description, todoId: search.todoId, returnTo };
  return search.quick === "1" ? <QuickActivitySheet {...props} backUrl={backUrl} /> : <section className="mx-auto max-w-2xl space-y-6">
    <Link href={backUrl} className="inline-flex min-h-11 items-center text-sm text-primary">← Kembali</Link><PageHeader title="Buat Activity" description={search.todoId ? "Catat pekerjaan dari Todo ini." : "Apa yang Anda kerjakan?"} /><div className="surface p-5 sm:p-6"><ActivityForm {...props} /></div>
  </section>;
}
