"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import type { AxiosError } from "axios";

import { departmentService, type DepartmentWithCounts } from "@/services/department.service";
import { departmentSchema, type DepartmentInput } from "@/lib/validators";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DepartmentWithCounts | null>(null);
  const [deleting, setDeleting] = React.useState<DepartmentWithCounts | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["departments", page, debouncedSearch],
    queryFn: () => departmentService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentService.remove(id),
    onSuccess: () => {
      toast.success("Department deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete department");
    },
  });

  const departments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage the departments within your school."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Department
          </Button>
        }
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or code…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={debouncedSearch ? `No departments match "${debouncedSearch}"` : "No departments yet"}
            description={debouncedSearch ? "Try a different search." : "Create your first department to get started."}
            action={!debouncedSearch && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Department
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead className="text-center">Courses</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{dept.code}</span></TableCell>
                    <TableCell className="text-slate-500 text-sm">{dept.full_name || "—"}</TableCell>
                    <TableCell className="text-center">{dept.courses_count ?? 0}</TableCell>
                    <TableCell className="text-center">{dept.students_count ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${dept.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(dept); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(dept)}>
                            <Trash2 className="h-4 w-4" /> Delete
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

      <DeptFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dept={editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["departments"] })}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete department?"
        description={<>Permanently delete <strong>{deleting?.name}</strong>? Departments with courses or students cannot be deleted.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function DeptFormDialog({
  open, onOpenChange, dept, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dept: DepartmentWithCounts | null;
  onSaved: () => void;
}) {
  const isEdit = !!dept;

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<DepartmentInput>({ resolver: zodResolver(departmentSchema) });

  React.useEffect(() => {
    if (open) reset({ name: dept?.name ?? "", code: dept?.code ?? "", full_name: dept?.full_name ?? "" });
  }, [open, dept, reset]);

  const onSubmit = async (data: DepartmentInput) => {
    try {
      if (isEdit) {
        await departmentService.update(dept!.id, data);
        toast.success("Department updated");
      } else {
        await departmentService.create(data);
        toast.success("Department created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const codeErr = axiosErr.response?.data?.errors?.code;
      if (codeErr) setError("code", { message: codeErr[0] });
      else toast.error("Could not save department");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update department details." : "Create a new department within your school."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept_name">Name <span className="text-red-500">*</span></Label>
            <Input id="dept_name" placeholder="e.g. Computer Science" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept_code">Code <span className="text-red-500">*</span></Label>
            <Input id="dept_code" placeholder="e.g. CSC/MAT" className="font-mono" {...register("code")} />
            {errors.code && <p className="text-sm text-red-600">! {errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept_fullname">Full Name</Label>
            <Input id="dept_fullname" placeholder="Optional long-form name" {...register("full_name")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
