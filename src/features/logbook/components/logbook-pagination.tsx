"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  baseUrl: string;
};

export function LogbookPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  baseUrl,
}: Props) {
  if (totalPages <= 1) return null;

  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalCount);

  function getPageUrl(page: number) {
    const url = new URL(baseUrl, "http://localhost");
    url.searchParams.set("page", String(page));
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  // Calculate page buttons to show
  const pages: number[] = [];
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <div>
        Menampilkan <span className="font-semibold text-foreground">{startRow}</span> -{" "}
        <span className="font-semibold text-foreground">{endRow}</span> dari{" "}
        <span className="font-semibold text-foreground">{totalCount}</span> baris
      </div>

      <div className="flex items-center gap-1.5">
        {/* Previous */}
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm" className="h-8 px-2.5">
            <Link href={getPageUrl(currentPage - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              <span>Sebelumnya</span>
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled className="h-8 px-2.5 opacity-50">
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            <span>Sebelumnya</span>
          </Button>
        )}

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {startPage > 1 && (
            <>
              <Link
                href={getPageUrl(1)}
                className="h-8 w-8 rounded-md flex items-center justify-center font-medium hover:bg-muted"
              >
                1
              </Link>
              {startPage > 2 && <span className="px-1 text-muted-foreground">…</span>}
            </>
          )}

          {pages.map((p) => (
            <Link
              key={p}
              href={getPageUrl(p)}
              className={`h-8 w-8 rounded-md flex items-center justify-center text-xs font-semibold transition-colors ${
                p === currentPage
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {p}
            </Link>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-1 text-muted-foreground">…</span>}
              <Link
                href={getPageUrl(totalPages)}
                className="h-8 w-8 rounded-md flex items-center justify-center font-medium hover:bg-muted"
              >
                {totalPages}
              </Link>
            </>
          )}
        </div>

        {/* Next */}
        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm" className="h-8 px-2.5">
            <Link href={getPageUrl(currentPage + 1)}>
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled className="h-8 px-2.5 opacity-50">
            <span>Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
