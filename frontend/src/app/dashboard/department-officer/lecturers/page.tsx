"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Pencil, KeyRound, UserX, Loader2, Users } from "lucide-react";
import type { AxiosError } from "axios";

import { deptOfficerService } from "@/services/deptOfficer.service";
import { lecturerSchema, type LecturerInput } from "@/lib/validators";
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

export default function DeptLecturersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = React.useState<StaffUser | null>(null);
  const [resetting, setResetting] = React.useState<StaffUser | null>(null);
  const [tempPassword, setTempPassword] = React.useState<{ fileNumber: string; password: string } | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dept-lecturers", page, debouncedSearch],
    queryFn: () => deptOfficerService.listLecturers({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deptOfficerService.deactivateLecturer(id),
    onSuccess: () => {
      toast.success("Lecturer deactivated");
      setDeactivating(null);
      queryClient.invalidateQueries({ queryKey: ["dept-lecturers"] });
      queryClient.invalidateQueries({ queryKey: ["dept-officer-stats"] });
    },
    onError: () => toast.error("Could not deactivate lecturer"),
  });

  const resetMutation = useMutation({
    mutationFn: (id: number) => deptOfficerService.resetLecturerPassword(id),
    onSuccess: (res, id) => {
      const lecturer = data?.data.find((l) => l.id === id);
      setResetting(null);
      setTempPassword({ fileNumber: lecturer?.file_number ?? "", password: res.temp_password });
    },
    onError: () => toast.error("Could not reset password"),
  });

  const lecturers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturers"
        description="Manage lecturers attached to your department."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Lecturer
          </Button>
        }
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or file number…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : lecturers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? `No lecturers match "${debouncedSearch}"` : "No lecturers yet"}
            description={debouncedSearch ? "Try a different search." : "Add your first lecturer to get started."}
            action={!debouncedSearch && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Lecturer
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturers.map((lec) => (
                  <TableRow key={lec.id}>
                    <TableCell className="font-medium">{lec.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{lec.file_number}</span></TableCell>
                    <TableCell className="text-slate-500 text-sm">{lec.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={lec.is_active ? "success" : "secondary"}>
                        {lec.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {lec.last_login_at ? format(new Date(lec.last_login_at), "dd MMM yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${lec.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(lec); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetting(lec)}>
                            <KeyRound className="h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" disabled={!lec.is_active} onClick={() => setDeactivating(lec)}>
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

      <DeptLecturerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lecturer={editing}
        onCreated={(fileNumber, password) => setTempPassword({ fileNumber, password })}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["dept-lecturers"] });
          queryClient.invalidateQueries({ queryKey: ["dept-officer-stats"] });
        }}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate lecturer?"
        description={<>Deactivate <strong>{deactivating?.name}</strong>? They will lose access immediately. You can reactivate them later by editing their record.</>}
        confirmLabel="Deactivate"
        destructive
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating.id)}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title="Reset password?"
        description={<>Generate a new temporary password for <strong>{resetting?.name}</strong>? All current sessions will be revoked.</>}
        confirmLabel="Reset"
        loading={resetMutation.isPending}
        onConfirm={() => resetting && resetMutation.mutate(resetting.id)}
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

function DeptLecturerFormDialog({
  open, onOpenChange, lecturer, onCreated, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lecturer: StaffUser | null;
  onCreated: (fileNumber: string, password: string) => void;
  onSaved: () => void;
}) {
  const isEdit = !!lecturer;

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<LecturerInput>({ resolver: zodResolver(lecturerSchema) });

  React.useEffect(() => {
    if (open) reset({ file_number: lecturer?.file_number ?? "", name: lecturer?.name ?? "", email: lecturer?.email ?? "" });
  }, [open, lecturer, reset]);

  const onSubmit = async (data: LecturerInput) => {
    try {
      if (isEdit) {
        await deptOfficerService.updateLecturer(lecturer!.id, data);
        toast.success("Lecturer updated");
        onSaved();
        onOpenChange(false);
      } else {
        const res = await deptOfficerService.createLecturer(data);
        onSaved();
        onOpenChange(false);
        onCreated(res.user.file_number, res.temp_password);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.file_number) setError("file_number", { message: fe.file_number[0] });
      else if (fe?.email) setError("email", { message: fe.email[0] });
      else toast.error("Could not save lecturer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lecturer" : "Add Lecturer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update lecturer details." : "Create a new lecturer account in your department. A temporary password will be generated."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="lec_file">File Number <span className="text-red-500">*</span></Label>
              <Input id="lec_file" placeholder="e.g. LEC/0001" className="font-mono" {...register("file_number")} />
              {errors.file_number && <p className="text-sm text-red-600">! {errors.file_number.message}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="lec_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="lec_name" placeholder="e.g. Dr. Aminu Kano" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lec_email">Email</Label>
            <Input id="lec_email" type="email" placeholder="Optional" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">! {errors.email.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Lecturer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
