"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Search, Shield, ArrowUpCircle, ArrowDownCircle, Loader2, History, Users } from "lucide-react";
import type { AxiosError } from "axios";

import { roleManagementService } from "@/services/roleManagement.service";
import { ROLE_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/common.types";
import type { StaffUser } from "@/types/user.types";

type Action = { user: StaffUser; kind: "promote" | "demote" };

export default function RoleManagementPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<"users" | "history">("users");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [action, setAction] = React.useState<Action | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch, tab]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["role-users", page, debouncedSearch],
    queryFn: () => roleManagementService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
    enabled: tab === "users",
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["role-history", page],
    queryFn: () => roleManagementService.history({ page }),
    placeholderData: keepPreviousData,
    enabled: tab === "history",
  });

  const mutation = useMutation({
    mutationFn: ({ user, kind, reason }: Action & { reason: string }) =>
      kind === "promote"
        ? roleManagementService.promote(user.id, reason)
        : roleManagementService.demote(user.id, reason),
    onSuccess: (_res, vars) => {
      toast.success(vars.kind === "promote" ? "Promoted to Exam Officer" : "Demoted to Lecturer");
      setAction(null);
      queryClient.invalidateQueries({ queryKey: ["role-users"] });
      queryClient.invalidateQueries({ queryKey: ["role-history"] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
    },
    onError: (err: AxiosError<{ errors?: Record<string, string[]>; message?: string }>) => {
      const msg = err.response?.data?.errors?.role?.[0] ?? err.response?.data?.message ?? "Could not change role";
      toast.error(msg);
    },
  });

  const users = data?.data ?? [];
  const history = historyData?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Management"
        description="Promote lecturers to School Exam Officers, or demote officers back to lecturers."
      />

      <div className="flex gap-2">
        {([["users", "Staff", Users], ["history", "History", History]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => { setTab(value); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <Card className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search by name or file number…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : users.length === 0 ? (
            <EmptyState icon={Shield} title={debouncedSearch ? "No matching staff" : "No eligible staff"} description={debouncedSearch ? "Try a different search." : "Lecturers and exam officers appear here."} />
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>File Number</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="font-mono text-xs">{u.file_number}</TableCell>
                      <TableCell><Badge variant={u.role === "exam_officer" ? "default" : "outline"}>{ROLE_LABELS[u.role as Role]}</Badge></TableCell>
                      <TableCell><Badge variant={u.is_active ? "success" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {u.role === "lecturer" ? (
                          <Button size="sm" variant="outline" disabled={!u.is_active} onClick={() => setAction({ user: u, kind: "promote" })}>
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Promote
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400" onClick={() => setAction({ user: u, kind: "demote" })}>
                            <ArrowDownCircle className="h-3.5 w-3.5" /> Demote
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && <Pagination meta={data.meta} onPageChange={setPage} />}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4">
          {historyLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState icon={History} title="No role changes yet" description="Promotions and demotions will be recorded here." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{h.user?.name ?? "—"}</p>
                        <p className="font-mono text-xs text-slate-500">{h.user?.file_number}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-500">{ROLE_LABELS[h.from_role as Role]}</span>
                        {" → "}
                        <span className="font-medium">{ROLE_LABELS[h.to_role as Role]}</span>
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm text-slate-500">{h.reason ?? "—"}</TableCell>
                      <TableCell className="text-sm">{h.upgraded_by?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {historyData && <Pagination meta={historyData.meta} onPageChange={setPage} />}
            </>
          )}
        </Card>
      )}

      <RoleChangeDialog
        action={action}
        onOpenChange={(o) => !o && setAction(null)}
        loading={mutation.isPending}
        onConfirm={(reason) => action && mutation.mutate({ ...action, reason })}
      />
    </div>
  );
}

function RoleChangeDialog({
  action, onOpenChange, loading, onConfirm,
}: {
  action: Action | null;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => { if (action) setReason(""); }, [action]);

  const promote = action?.kind === "promote";

  return (
    <Dialog open={!!action} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{promote ? "Promote to Exam Officer" : "Demote to Lecturer"}</DialogTitle>
          <DialogDescription>
            {promote
              ? <>Grant <strong>{action?.user.name}</strong> School Exam Officer permissions for their school. Their active sessions will be revoked.</>
              : <>Return <strong>{action?.user.name}</strong> to a Lecturer role. They will lose Exam Officer permissions and their sessions will be revoked.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="role_reason">Reason <span className="text-slate-400">(optional)</span></Label>
          <Textarea id="role_reason" rows={3} placeholder="Why is this change being made?" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={loading} onClick={() => onConfirm(reason)} className={promote ? "" : "bg-amber-600 hover:bg-amber-700"}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {promote ? "Promote" : "Demote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
