"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, KeyRound, Ban, Loader2, Users } from "lucide-react";
import type { AxiosError } from "axios";
import { formatDistanceToNow } from "date-fns";

import { examOfficerAdminService, type CreateExamOfficerPayload } from "@/services/examOfficerAdmin.service";
import { examOfficerSchema, type ExamOfficerInput } from "@/lib/validators";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TempPasswordDialog } from "@/components/shared/TempPasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AuthUser } from "@/types/auth.types";
import type { School } from "@/types/user.types";

export default function ExamOfficersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AuthUser | null>(null);
  const [deactivating, setDeactivating] = React.useState<AuthUser | null>(null);
  const [resetting, setResetting] = React.useState<AuthUser | null>(null);
  const [tempPassword, setTempPassword] = React.useState<{ fileNumber: string; password: string } | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["exam-officers", page, debouncedSearch],
    queryFn: () => examOfficerAdminService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  // Schools (owned by the Super Admin) — for the assign-to-school picker and to
  // resolve each officer's school name in the table.
  const { data: schools = [] } = useQuery({
    queryKey: ["cbt-admin-schools"],
    queryFn: () => examOfficerAdminService.schools(),
  });

  const schoolsById = React.useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => examOfficerAdminService.deactivate(id),
    onSuccess: () => {
      toast.success("Exam Officer deactivated");
      setDeactivating(null);
      queryClient.invalidateQueries({ queryKey: ["exam-officers"] });
    },
    onError: () => toast.error("Could not deactivate account"),
  });

  const resetMutation = useMutation({
    mutationFn: (officer: AuthUser) => examOfficerAdminService.resetPassword(officer.id),
    onSuccess: (res, officer) => {
      setResetting(null);
      setTempPassword({ fileNumber: officer.file_number, password: res.temp_password });
    },
    onError: () => toast.error("Could not reset password"),
  });

  const toggleActive = useMutation({
    mutationFn: (officer: AuthUser) =>
      examOfficerAdminService.update(officer.id, { name: officer.name, email: officer.email, is_active: !officer.is_active }),
    onSuccess: () => {
      toast.success("Account status updated");
      queryClient.invalidateQueries({ queryKey: ["exam-officers"] });
    },
    onError: () => toast.error("Could not update account"),
  });

  const officers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Officers"
        description="Create School Exam Officer accounts and assign them to a school."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Exam Officer
          </Button>
        }
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name, file number, email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : officers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? `No officers match “${debouncedSearch}”` : "No Exam Officers yet"}
            description={debouncedSearch ? "Try a different search." : "Create the first School Exam Officer and assign them to a school."}
            action={!debouncedSearch && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add Exam Officer</Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File Number</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Email</TableHead>
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
                    <TableCell className="text-slate-600 dark:text-slate-300">
                      {officer.school_id ? (schoolsById.get(officer.school_id)?.name ?? `#${officer.school_id}`) : "—"}
                    </TableCell>
                    <TableCell className="text-slate-500">{officer.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={officer.is_active ? "success" : "secondary"}>
                        {officer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {officer.last_login_at ? formatDistanceToNow(new Date(officer.last_login_at), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${officer.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(officer); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetting(officer)}>
                            <KeyRound className="h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive.mutate(officer)}>
                            {officer.is_active ? "Deactivate (toggle)" : "Reactivate"}
                          </DropdownMenuItem>
                          {officer.is_active && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(officer)}>
                                <Ban className="h-4 w-4" /> Deactivate Account
                              </DropdownMenuItem>
                            </>
                          )}
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

      <ExamOfficerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        officer={editing}
        schools={schools}
        onCreated={(fileNumber, password) => setTempPassword({ fileNumber, password })}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate this account?"
        description={<><strong>{deactivating?.name}</strong> will no longer be able to sign in. Their account and history are preserved.</>}
        confirmLabel="Deactivate"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating.id)}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title="Reset password?"
        description={<>A new temporary password will be generated for <strong>{resetting?.name}</strong>. Their current sessions will be ended.</>}
        confirmLabel="Reset Password"
        loading={resetMutation.isPending}
        onConfirm={() => resetting && resetMutation.mutate(resetting)}
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

function ExamOfficerFormDialog({
  open,
  onOpenChange,
  officer,
  schools,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  officer: AuthUser | null;
  schools: School[];
  onCreated: (fileNumber: string, password: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!officer;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExamOfficerInput>({ resolver: zodResolver(examOfficerSchema) });

  React.useEffect(() => {
    if (open) {
      reset({
        file_number: officer?.file_number ?? "",
        name: officer?.name ?? "",
        email: officer?.email ?? "",
        school_id: officer?.school_id ? String(officer.school_id) : "",
      });
    }
  }, [open, officer, reset]);

  const onSubmit = async (data: ExamOfficerInput) => {
    try {
      if (isEdit) {
        await examOfficerAdminService.update(officer!.id, {
          name: data.name,
          email: data.email || null,
          is_active: officer!.is_active,
        });
        toast.success("Exam Officer updated");
        queryClient.invalidateQueries({ queryKey: ["exam-officers"] });
        onOpenChange(false);
      } else {
        const payload: CreateExamOfficerPayload = {
          file_number: data.file_number,
          name: data.name,
          email: data.email || null,
          school_id: Number(data.school_id),
        };
        const res = await examOfficerAdminService.create(payload);
        queryClient.invalidateQueries({ queryKey: ["exam-officers"] });
        onOpenChange(false);
        onCreated(data.file_number, res.temp_password);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fieldErrors = axiosErr.response?.data?.errors;
      if (fieldErrors?.file_number) setError("file_number", { message: fieldErrors.file_number[0] });
      else if (fieldErrors?.email) setError("email", { message: fieldErrors.email[0] });
      else if (fieldErrors?.school_id) setError("school_id", { message: fieldErrors.school_id[0] });
      else toast.error("Could not save account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Exam Officer" : "Add Exam Officer"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this officer's details. The assigned school can't be changed here — demote them to lecturer to reassign."
              : "A temporary password will be generated. The officer must change it on first login."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="eo_file">File Number <span className="text-red-500">*</span></Label>
            <Input id="eo_file" className="font-mono" placeholder="e.g. STAFF/0001" disabled={isEdit} {...register("file_number")} />
            {errors.file_number && <p className="text-sm text-red-600">! {errors.file_number.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eo_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="eo_name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eo_school">School <span className="text-red-500">*</span></Label>
            <select
              id="eo_school"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950"
              disabled={isEdit}
              {...register("school_id")}
            >
              <option value="">Select school…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
            {!isEdit && schools.length === 0 && (
              <p className="text-sm text-amber-600">No schools exist yet — ask a Super Admin to create one first.</p>
            )}
            {errors.school_id && <p className="text-sm text-red-600">! {errors.school_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eo_email">Email</Label>
            <Input id="eo_email" type="email" placeholder="Optional" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">! {errors.email.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Officer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
