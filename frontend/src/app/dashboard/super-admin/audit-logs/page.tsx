"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, FileText } from "lucide-react";
import { format } from "date-fns";

import { superAdminService } from "@/services/superAdmin.service";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Human label + tone for known audit actions; falls back to the raw key. */
const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  password_changed: "Changed password",
  password_reset: "Reset password",
  college_updated: "Updated college",
  school_created: "Created school",
  school_updated: "Updated school",
  school_deleted: "Deleted school",
  cbt_admin_created: "Created CBT admin",
  cbt_admin_updated: "Updated CBT admin",
};

function actionVariant(action: string): "default" | "success" | "warning" | "destructive" | "secondary" {
  if (action.includes("deleted")) return "destructive";
  if (action.includes("created")) return "success";
  if (action.includes("updated") || action.includes("reset")) return "warning";
  if (action === "login" || action === "logout") return "secondary";
  return "default";
}

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", page, debouncedSearch],
    queryFn: () => superAdminService.auditLogs({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="A chronological record of privileged actions across the system." />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by action or user…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={FileText} title={debouncedSearch ? "No matching events" : "No audit events yet"} description={debouncedSearch ? "Try a different search." : "Privileged actions will appear here."} />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={actionVariant(log.action)}>{ACTION_LABELS[log.action] ?? log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <div>
                          <p className="font-medium text-sm">{log.user.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{log.user.file_number}</p>
                        </div>
                      ) : <span className="text-slate-400">System</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {log.model_type ? `${log.model_type}${log.model_id ? ` #${log.model_id}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 font-mono">{log.ip_address ?? "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>
    </div>
  );
}
