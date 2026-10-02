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

export function LogbookMobileCards({ rows, returnToUrl }: Props) {
  const returnToParam = encodeURIComponent(returnToUrl);

  return (
    <div className="xl:hidden space-y-3">
      {rows.map((row) => {
        const isDraft = row.status === "DRAFT";

        return (
          <article
            key={row.id}
            className="surface p-4 space-y-3"
          >
            {/* Header: Row #, Date, Time */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
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
                  className="flex min-h-11 min-w-0 items-center font-semibold text-foreground text-sm hover:text-primary break-words"
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
                className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary shrink-0 px-3 rounded-xl hover:bg-secondary"
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
