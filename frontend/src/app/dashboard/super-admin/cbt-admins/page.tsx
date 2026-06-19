"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, KeyRound, Ban, Loader2, Shield } from "lucide-react";
import type { AxiosError } from "axios";
import { formatDistanceToNow } from "date-fns";

import { cbtAdminService, type CreateCbtAdminPayload } from "@/services/cbtAdmin.service";
import { cbtAdminSchema, type CbtAdminInput } from "@/lib/validators";
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

export default function CbtAdminsPage() {
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
    queryKey: ["cbt-admins", page, debouncedSearch],
    queryFn: () => cbtAdminService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => cbtAdminService.deactivate(id),
    onSuccess: () => {
      toast.success("CBT Admin deactivated");
      setDeactivating(null);
      queryClient.invalidateQueries({ queryKey: ["cbt-admins"] });
    },
    onError: () => toast.error("Could not deactivate account"),
  });

  const resetMutation = useMutation({
    mutationFn: (admin: AuthUser) => cbtAdminService.resetPassword(admin.id),
    onSuccess: (res, admin) => {
      setResetting(null);
      setTempPassword({ fileNumber: admin.file_number, password: res.temp_password });
    },
    onError: () => toast.error("Could not reset password"),
  });

  const toggleActive = useMutation({
    mutationFn: (admin: AuthUser) =>
      cbtAdminService.update(admin.id, { name: admin.name, email: admin.email, is_active: !admin.is_active }),
    onSuccess: () => {
      toast.success("Account status updated");
      queryClient.invalidateQueries({ queryKey: ["cbt-admins"] });
    },
    onError: () => toast.error("Could not update account"),
  });

  const admins = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CBT Admins"
        description="Create and manage CBT Administrator accounts."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add CBT Admin
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
        ) : admins.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={debouncedSearch ? `No admins match “${debouncedSearch}”` : "No CBT Admins yet"}
            description={debouncedSearch ? "Try a different search." : "Create the first CBT Admin account."}
            action={!debouncedSearch && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add CBT Admin</Button>
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
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{admin.file_number}</span></TableCell>
                    <TableCell className="text-slate-500">{admin.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={admin.is_active ? "success" : "secondary"}>
                        {admin.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {admin.last_login_at ? formatDistanceToNow(new Date(admin.last_login_at), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${admin.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(admin); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetting(admin)}>
                            <KeyRound className="h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive.mutate(admin)}>
                            {admin.is_active ? "Deactivate (toggle)" : "Reactivate"}
                          </DropdownMenuItem>
                          {admin.is_active && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(admin)}>
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

      <CbtAdminFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        admin={editing}
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

function CbtAdminFormDialog({
  open,
  onOpenChange,
  admin,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  admin: AuthUser | null;
  onCreated: (fileNumber: string, password: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!admin;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CbtAdminInput>({ resolver: zodResolver(cbtAdminSchema) });

  React.useEffect(() => {
    if (open) {
      reset({
        file_number: admin?.file_number ?? "",
        name: admin?.name ?? "",
        email: admin?.email ?? "",
      });
    }
  }, [open, admin, reset]);

  const onSubmit = async (data: CbtAdminInput) => {
    try {
      if (isEdit) {
        await cbtAdminService.update(admin!.id, {
          name: data.name,
          email: data.email || null,
          is_active: admin!.is_active,
        });
        toast.success("CBT Admin updated");
        queryClient.invalidateQueries({ queryKey: ["cbt-admins"] });
        onOpenChange(false);
      } else {
        const payload: CreateCbtAdminPayload = {
          file_number: data.file_number,
          name: data.name,
          email: data.email || null,
        };
        const res = await cbtAdminService.create(payload);
        queryClient.invalidateQueries({ queryKey: ["cbt-admins"] });
        onOpenChange(false);
        onCreated(data.file_number, res.temp_password);
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fieldErrors = axiosErr.response?.data?.errors;
      if (fieldErrors?.file_number) setError("file_number", { message: fieldErrors.file_number[0] });
      else if (fieldErrors?.email) setError("email", { message: fieldErrors.email[0] });
      else toast.error("Could not save account");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit CBT Admin" : "Add CBT Admin"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this administrator's details."
              : "A temporary password will be generated. The admin must change it on first login."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin_file">File Number <span className="text-red-500">*</span></Label>
            <Input id="admin_file" className="font-mono" placeholder="e.g. CBT/0001" disabled={isEdit} {...register("file_number")} />
            {errors.file_number && <p className="text-sm text-red-600">! {errors.file_number.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="admin_name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin_email">Email</Label>
            <Input id="admin_email" type="email" placeholder="Optional" {...register("email")} />
            {errors.email && <p className="text-sm text-red-600">! {errors.email.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
