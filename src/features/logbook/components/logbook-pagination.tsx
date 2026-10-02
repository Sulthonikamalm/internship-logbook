"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { currentPage: number; totalPages: number; totalCount: number; pageSize: number; baseUrl: string };
export function LogbookPagination({ currentPage, totalPages, totalCount, pageSize, baseUrl }: Props) {
  if (totalPages <= 1) return null;
  function href(page: number) {
    const url = new URL(baseUrl, "http://localhost");
    url.searchParams.set("page", String(page));
    return `${url.pathname}?${url.searchParams}`;
  }
  return <nav aria-label="Halaman logbook" className="flex flex-col items-center justify-between gap-3 pt-3 sm:flex-row">
    <p className="text-xs text-muted-foreground">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} dari {totalCount}</p>
    <div className="flex items-center gap-3">
      {currentPage > 1 ? <Button asChild variant="outline" size="icon"><Link href={href(currentPage - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={18} /></Link></Button> : <Button variant="outline" size="icon" disabled aria-label="Halaman sebelumnya"><ChevronLeft size={18} /></Button>}
      <span className="text-sm tabular-nums" aria-live="polite">{currentPage} / {totalPages}</span>
      {currentPage < totalPages ? <Button asChild variant="outline" size="icon"><Link href={href(currentPage + 1)} aria-label="Halaman berikutnya"><ChevronRight size={18} /></Link></Button> : <Button variant="outline" size="icon" disabled aria-label="Halaman berikutnya"><ChevronRight size={18} /></Button>}
    </div>
  </nav>;
}
