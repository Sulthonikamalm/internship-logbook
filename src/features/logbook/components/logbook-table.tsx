"use client";

import Link from "next/link";
import { Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIndonesianDate, formatTimeDisplay } from "../domain/filters";
import type { LogbookRow } from "../domain/types";
import { EvidenceSummaryBadges } from "./evidence-summary-badge";

type Props = {
  rows: LogbookRow[];
  page: number;
  pageSize: number;
  returnToUrl: string;
};

export function LogbookDesktopTable({ rows, page, pageSize, returnToUrl }: Props) {
  const returnToParam = encodeURIComponent(returnToUrl);

  return (
    <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground">
          <caption className="sr-only">Tabel Logbook Aktivitas Magang</caption>
          <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="w-12 px-4 py-3 text-center font-semibold">
                No.
              </th>
              <th scope="col" className="w-36 px-4 py-3 font-semibold">
                Tanggal
              </th>
              <th scope="col" className="w-28 px-4 py-3 font-semibold">
                Waktu
              </th>
              <th scope="col" className="w-64 px-4 py-3 font-semibold">
                Aktivitas
              </th>
              <th scope="col" className="min-w-[220px] px-4 py-3 font-semibold">
                Keterangan
              </th>
              <th scope="col" className="w-48 px-4 py-3 font-semibold">
                Evidence
              </th>
              <th scope="col" className="w-20 px-4 py-3 text-right font-semibold">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => {
              const rowNumber = (page - 1) * pageSize + index + 1;
              const isDraft = row.status === "DRAFT";

              return (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  {/* No. */}
                  <td className="px-4 py-3.5 text-center text-xs font-mono text-muted-foreground">
                    {rowNumber}
                  </td>

                  {/* Tanggal */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-medium text-foreground block">
                      {formatIndonesianDate(row.activityDate, { includeDayName: false })}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      {formatIndonesianDate(row.activityDate).split(",")[0]}
                    </span>
                  </td>

                  {/* Waktu */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                    {formatTimeDisplay(row.startTime, row.endTime)}
                  </td>

                  {/* Aktivitas */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/activities/${row.id}?returnTo=${returnToParam}`}
                          className="inline-flex min-h-11 items-center font-semibold text-foreground hover:text-primary break-words"
                        >
                          {row.title}
                        </Link>
                        {isDraft && (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                            Draf
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Keterangan */}
                  <td className="px-4 py-3.5">
                    {row.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
                        {row.description}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </td>

                  {/* Evidence */}
                  <td className="px-4 py-3.5">
                    <EvidenceSummaryBadges
                      evidences={row.evidences}
                      photoCount={row.photoCount}
                      linkCount={row.linkCount}
                      brokenCount={row.brokenCount}
                      totalEvidenceCount={row.totalEvidenceCount}
                    />
                  </td>

                  {/* Aksi */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="size-11 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Edit aktivitas"
                    >
                      <Link href={`/activities/${row.id}/edit?returnTo=${returnToParam}`}>
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit {row.title}</span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
