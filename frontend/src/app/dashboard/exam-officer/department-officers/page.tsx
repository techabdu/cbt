"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, UserPlus, Search, MoreHorizontal, KeyRound, ArrowDown, UserX, Loader2, UserCog } from "lucide-react";
import type { AxiosError } from "axios";

import { departmentOfficerService, type DepartmentOfficerPayload } from "@/services/departmentOfficer.service";
import { departmentService } from "@/services/department.service";
import { departmentOfficerSchema, type DepartmentOfficerInput } from "@/lib/validators";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TempPasswordDialog } from "@/components/shared/TempPasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { StaffUser } from "@/types/user.types";

export default function DepartmentOfficersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [promoteOpen, setPromoteOpen] = React.useState(false);
  const [demoting, setDemoting] = React.useState<StaffUser | null>(null);
  const [resetting, setResetting] = React.useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = React.useState<StaffUser | null>(null);
  const [tempPassword, setTempPassword] = React.useState<{ fileNumber: string; password: string } | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentService.list({ per_page: 100 }),
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["department-officers", page, debouncedSearch],
    queryFn: () => departmentOfficerService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["department-officers"] });

  const demoteMutation = useMutation({
    mutationFn: (id: number) => departmentOfficerService.demote(id),
    onSuccess: () => { toast.success("Demoted to lecturer"); setDemoting(null); invalidate(); },
    onError: () => toast.error("Could not demote officer"),
  });

  const resetMutation = useMutation({
    mutationFn: (officer: StaffUser) => departmentOfficerService.resetPassword(officer.id),
    onSuccess: (res, officer) => {
      setResetting(null);
      setTempPassword({ fileNumber: officer.file_number, password: res.temp_password });
    },
    onError: () => toast.error("Could not reset password"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => departmentOfficerService.deactivate(id),
    onSuccess: () => { toast.success("Account deactivated"); setDeactivating(null); invalidate(); },
    onError: () => toast.error("Could not deactivate account"),
  });

  const departments = deptData?.data ?? [];
  const officers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Officers"
        description="Appoint a Department Exam Officer to own each department's courses and lecturers."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPromoteOpen(true)} disabled={departments.length === 0}>
              <UserPlus className="h-4 w-4" /> Promote Lecturer
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={departments.length === 0}>
              <Plus className="h-4 w-4" /> Create Officer
            </Button>
          </div>
        }
      />

      {departments.length === 0 && (
        <Card className="p-4 text-sm text-amber-600 dark:text-amber-400">
          Create at least one department before appointing a department officer.
        </Card>
      )}

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name or file number…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : officers.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title={debouncedSearch ? `No officers match "${debouncedSearch}"` : "No department officers yet"}
            description={debouncedSearch ? "Try a different search." : "Create an officer or promote an existing lecturer."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File Number</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {officers.map((officer) => (
                  <TableRow key={officer.id}>
                    <TableCell className="font-medium">{officer.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{officer.file_number}</span></TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {officer.department ? `${officer.department.name} (${officer.department.code})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={officer.is_active ? "success" : "secondary"}>
                        {officer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {officer.last_login_at ? format(new Date(officer.last_login_at), "dd MMM yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${officer.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setResetting(officer)}>
                            <KeyRound className="h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDemoting(officer)}>
                            <ArrowDown className="h-4 w-4" /> Demote to Lecturer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" disabled={!officer.is_active} onClick={() => setDeactivating(officer)}>
                            <UserX className="h-4 w-4" /> Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>

      <CreateOfficerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departments={departments}
        onCreated={(fileNumber, password) => { invalidate(); setTempPassword({ fileNumber, password }); }}
      />

      <PromoteLecturerDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        departments={departments}
        onPromoted={invalidate}
      />

      <ConfirmDialog
        open={!!demoting}
        onOpenChange={(o) => !o && setDemoting(null)}
        title="Demote to lecturer?"
        description={<><strong>{demoting?.name}</strong> will return to a lecturer role and lose department-officer access.</>}
        confirmLabel="Demote"
        destructive
        loading={demoteMutation.isPending}
        onConfirm={() => demoting && demoteMutation.mutate(demoting.id)}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title="Reset password?"
        description={<>Generate a new temporary password for <strong>{resetting?.name}</strong>? All current sessions will be revoked.</>}
        confirmLabel="Reset"
        loading={resetMutation.isPending}
        onConfirm={() => resetting && resetMutation.mutate(resetting)}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate account?"
        description={<><strong>{deactivating?.name}</strong> will no longer be able to sign in. Their account and history are preserved.</>}
        confirmLabel="Deactivate"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating.id)}
      />

      <TempPasswordDialog
        open={!!tempPassword}
        onOpenChange={(o) => !o && setTempPassword(null)}
        fileNumber={tempPassword?.fileNumber}
        password={tempPassword?.password ?? null}
      />
    </div>
  );
}

function CreateOfficerDialog({
  open, onOpenChange, departments, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  departments: { id: number; name: string; code: string }[];
  onCreated: (fileNumber: string, password: string) => void;
}) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<DepartmentOfficerInput>({ resolver: zodResolver(departmentOfficerSchema) });

  React.useEffect(() => {
    if (open) reset({ file_number: "", name: "", email: "", department_id: "" });
  }, [open, reset]);

  const onSubmit = async (data: DepartmentOfficerInput) => {
    const payload: DepartmentOfficerPayload = {
      file_number: data.file_number,
      name: data.name,
      email: data.email || null,
      department_id: Number(data.department_id),
    };
    try {
      const res = await departmentOfficerService.create(payload);
      onOpenChange(false);
      onCreated(res.user.file_number, res.temp_password);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.file_number) setError("file_number", { message: fe.file_number[0] });
      else if (fe?.email) setError("email", { message: fe.email[0] });
      else if (fe?.department_id) setError("department_id", { message: fe.department_id[0] });
      else toast.error(axiosErr.response?.data?.message ?? "Could not create officer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Department Officer</DialogTitle>
          <DialogDescription>A temporary password will be generated. The officer must change it on first login.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="do_file">File Number <span className="text-red-500">*</span></Label>
            <Input id="do_file" placeholder="e.g. STAFF/0010" className="font-mono" {...register("file_number")} />
            {errors.file_number && <p className="text-sm text-red-600">! {errors.file_number.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="do_name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do_dept">Department <span className="text-red-500">*</span></Label>
            <select
              id="do_dept"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              {...register("department_id")}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
            {errors.department_id && <p className="text-sm text-red-600">! {errors.department_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do_email">Email</Label>
            <Input id="do_email" type="email" placeholder="Optional" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">! {errors.email.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Officer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromoteLecturerDialog({
  open, onOpenChange, departments, onPromoted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  departments: { id: number; name: string; code: string }[];
  onPromoted: () => void;
}) {
  const [lecturerId, setLecturerId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data } = useQuery({
    queryKey: ["eligible-officers", debouncedSearch],
    queryFn: () => departmentOfficerService.eligible({ per_page: 50, "filter[search]": debouncedSearch || undefined }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => departmentOfficerService.promote(Number(lecturerId), Number(departmentId)),
    onSuccess: () => {
      toast.success("Lecturer promoted to department officer");
      onPromoted();
      onOpenChange(false);
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not promote lecturer");
    },
  });

  React.useEffect(() => {
    if (open) { setLecturerId(""); setDepartmentId(""); setSearch(""); }
  }, [open]);

  const lecturers = data?.data ?? [];
  const canSubmit = lecturerId && departmentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote Lecturer</DialogTitle>
          <DialogDescription>Promote an existing lecturer to Department Exam Officer for a department.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pl_search">Find Lecturer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="pl_search" placeholder="Search by name or file number…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl_lecturer">Lecturer <span className="text-red-500">*</span></Label>
            <select
              id="pl_lecturer"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
            >
              <option value="">Select lecturer…</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.file_number})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl_dept">Department <span className="text-red-500">*</span></Label>
            <select
              id="pl_dept"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
