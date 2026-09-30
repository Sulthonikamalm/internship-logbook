"use client";

import Link from "next/link";
import { Calendar, Clock, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIndonesianDate, formatTimeDisplay } from "../domain/filters";
import type { LogbookRow } from "../domain/types";
import { EvidenceSummaryBadges } from "./evidence-summary-badge";

type Props = {
  rows: LogbookRow[];
  page: number;
  pageSize: number;
  returnToUrl: string;
};

export function LogbookMobileCards({ rows, page, pageSize, returnToUrl }: Props) {
  const returnToParam = encodeURIComponent(returnToUrl);

  return (
    <div className="md:hidden space-y-3">
      {rows.map((row, index) => {
        const rowNumber = (page - 1) * pageSize + index + 1;
        const isDraft = row.status === "DRAFT";

        return (
          <article
            key={row.id}
            className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3 transition-colors hover:border-border/80"
          >
            {/* Header: Row #, Date, Time */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-primary">#{rowNumber}</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{formatIndonesianDate(row.activityDate)}</span>
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="h-3 w-3" />
                <span>{formatTimeDisplay(row.startTime, row.endTime)}</span>
              </div>
            </div>

            {/* Title & Status */}
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/activities/${row.id}?returnTo=${returnToParam}`}
                  className="font-semibold text-foreground text-sm hover:text-primary transition-colors line-clamp-2"
                >
                  {row.title}
                </Link>
                {isDraft && (
                  <Badge variant="warning" className="text-[10px] shrink-0 px-1.5 py-0">
                    Draf
                  </Badge>
                )}
              </div>

              {/* Description Excerpt */}
              {row.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {row.description}
                </p>
              )}
            </div>

            {/* Evidence summary & Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
              <div className="flex-1 overflow-hidden">
                <EvidenceSummaryBadges
                  evidences={row.evidences}
                  photoCount={row.photoCount}
                  linkCount={row.linkCount}
                  brokenCount={row.brokenCount}
                  totalEvidenceCount={row.totalEvidenceCount}
                />
              </div>

              <Link
                href={`/activities/${row.id}/edit?returnTo=${returnToParam}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
