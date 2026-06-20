"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { RefreshCw, UploadCloud, DownloadCloud, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { cbtExamService } from "@/services/cbtExam.service";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SyncStatus } from "@/types/sync.types";

const STATUS: Record<SyncStatus, { label: string; variant: "success" | "destructive" | "warning"; icon: React.ComponentType<{ className?: string }> }> = {
  success: { label: "Success", variant: "success", icon: CheckCircle2 },
  failed:  { label: "Failed", variant: "destructive", icon: XCircle },
  pending: { label: "Pending", variant: "warning", icon: Clock },
};

export default function SyncLogsPage() {
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sync-logs", page],
    queryFn: () => cbtExamService.syncLogs({ page }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Sync Logs" description="History of exam pushes to, and result pulls from, the offline server." />

      <Card className="p-4">
        {isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={RefreshCw} title="No sync activity yet" description="Pushes and pulls between the online and offline servers will appear here." />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const s = STATUS[log.status];
                  const StatusIcon = s.icon;
                  const DirIcon = log.direction === "push" ? UploadCloud : DownloadCloud;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <DirIcon className="h-4 w-4 text-slate-400" />
                          {log.direction === "push" ? "Push" : "Pull"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.exam?.course ?? `#${log.exam_id ?? "—"}`}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {log.payload_summary
                          ? Object.entries(log.payload_summary).map(([k, v]) => `${v} ${k}`).join(", ")
                          : log.error_message
                            ? <span className="text-red-500">{log.error_message}</span>
                            : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant} className="gap-1"><StatusIcon className="h-3 w-3" /> {s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.initiated_by ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>
    </div>
  );
}
