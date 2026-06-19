"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import type { AxiosError } from "axios";

import { schoolService, type SchoolListItem, type SchoolPayload } from "@/services/school.service";
import { schoolSchema, type SchoolInput } from "@/lib/validators";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SchoolListItem | null>(null);
  const [deleting, setDeleting] = React.useState<SchoolListItem | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["schools", page, debouncedSearch],
    queryFn: () => schoolService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => schoolService.remove(id),
    onSuccess: () => {
      toast.success("School deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete school");
    },
  });

  const schools = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools"
        description="Manage the schools (faculties) within the college."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add School
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
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : schools.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={debouncedSearch ? `No schools match “${debouncedSearch}”` : "No schools yet"}
            description={debouncedSearch ? "Try a different search." : "Create your first school to get started."}
            action={!debouncedSearch && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Add School
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
                  <TableHead>Head</TableHead>
                  <TableHead className="text-center">Departments</TableHead>
                  <TableHead className="text-center">Staff</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{school.code}</span></TableCell>
                    <TableCell className="text-slate-500">{school.head_name ?? "—"}</TableCell>
                    <TableCell className="text-center">{school.departments_count ?? 0}</TableCell>
                    <TableCell className="text-center">{school.users_count ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${school.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(school); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(school)}>
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

      <SchoolFormDialog open={formOpen} onOpenChange={setFormOpen} school={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete school?"
        description={<>This will permanently delete <strong>{deleting?.name}</strong>. Schools with departments, staff, or students cannot be deleted.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function SchoolFormDialog({
  open,
  onOpenChange,
  school,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  school: SchoolListItem | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!school;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SchoolInput>({ resolver: zodResolver(schoolSchema) });

  React.useEffect(() => {
    if (open) {
      reset({
        name: school?.name ?? "",
        code: school?.code ?? "",
        head_name: school?.head_name ?? "",
      });
    }
  }, [open, school, reset]);

  const onSubmit = async (data: SchoolInput) => {
    const payload: SchoolPayload = {
      name: data.name,
      code: data.code,
      head_name: data.head_name || null,
    };
    try {
      if (isEdit) {
        await schoolService.update(school!.id, payload);
        toast.success("School updated");
      } else {
        await schoolService.create(payload);
        toast.success("School created");
      }
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      onOpenChange(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const codeErr = axiosErr.response?.data?.errors?.code;
      if (codeErr) setError("code", { message: codeErr[0] });
      else toast.error("Could not save school");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit School" : "Add School"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this school's details." : "Create a new school within the college."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="school_name">Name <span className="text-red-500">*</span></Label>
            <Input id="school_name" placeholder="e.g. School of Sciences" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school_code">Code <span className="text-red-500">*</span></Label>
            <Input id="school_code" placeholder="e.g. SCI" className="font-mono" {...register("code")} />
            {errors.code && <p className="text-sm text-red-600">! {errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school_head">Head of School</Label>
            <Input id="school_head" placeholder="Optional" {...register("head_name")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create School"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
