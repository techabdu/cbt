"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, GraduationCap } from "lucide-react";
import type { AxiosError } from "axios";

import { studentService, type StudentPayload } from "@/services/student.service";
import { departmentService } from "@/services/department.service";
import { studentSchema, type StudentInput } from "@/lib/validators";
import { LEVEL_LABELS, LEVEL_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Student } from "@/types/student.types";
import type { StudentLevel } from "@/types/common.types";

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Student | null>(null);
  const [deleting, setDeleting] = React.useState<Student | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch, deptFilter]);

  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentService.list({ per_page: 100 }),
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["students", page, debouncedSearch, deptFilter],
    queryFn: () => studentService.list({
      page,
      "filter[search]": debouncedSearch || undefined,
      "filter[department_id]": deptFilter || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentService.remove(id),
    onSuccess: () => {
      toast.success("Student deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete student");
    },
  });

  const departments = deptData?.data ?? [];
  const students = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage students enrolled in your school."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Student
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative max-w-sm flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or matric number…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 min-w-40"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={debouncedSearch || deptFilter ? "No students match the filters" : "No students yet"}
            description={debouncedSearch || deptFilter ? "Try adjusting your filters." : "Add your first student to get started."}
            action={!debouncedSearch && !deptFilter && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Student
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{student.matric_number}</span></TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {student.department?.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {LEVEL_LABELS[student.level as StudentLevel] ?? student.level}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? "success" : "secondary"}>
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${student.full_name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(student); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(student)}>
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

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        student={editing}
        departments={departments}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["students"] });
          queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete student?"
        description={<>Permanently delete <strong>{deleting?.full_name}</strong>? Students with exam records cannot be deleted — deactivate them instead.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function StudentFormDialog({
  open, onOpenChange, student, departments, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student: Student | null;
  departments: { id: number; name: string; code: string }[];
  onSaved: () => void;
}) {
  const isEdit = !!student;

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<StudentInput>({ resolver: zodResolver(studentSchema) });

  React.useEffect(() => {
    if (open) {
      reset({
        matric_number: student?.matric_number ?? "",
        full_name:     student?.full_name ?? "",
        department_id: String(student?.department_id ?? ""),
        level:         student?.level ?? "",
      });
    }
  }, [open, student, reset]);

  const onSubmit = async (data: StudentInput) => {
    const payload: StudentPayload = {
      ...data,
      department_id: Number(data.department_id),
    };
    try {
      if (isEdit) {
        await studentService.update(student!.id, payload);
        toast.success("Student updated");
      } else {
        await studentService.create(payload);
        toast.success("Student added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.matric_number) setError("matric_number", { message: fe.matric_number[0] });
      else if (fe?.department_id) setError("department_id", { message: fe.department_id[0] });
      else toast.error("Could not save student");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update student details." : "Enroll a new student in your school."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stu_matric">Matric Number <span className="text-red-500">*</span></Label>
            <Input id="stu_matric" placeholder="e.g. NCE/2024/001" className="font-mono" {...register("matric_number")} />
            {errors.matric_number && <p className="text-sm text-red-600">! {errors.matric_number.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stu_name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="stu_name" placeholder="e.g. Amina Bello" {...register("full_name")} />
            {errors.full_name && <p className="text-sm text-red-600">! {errors.full_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stu_dept">Department <span className="text-red-500">*</span></Label>
            <select
              id="stu_dept"
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
            <Label htmlFor="stu_level">Level <span className="text-red-500">*</span></Label>
            <select
              id="stu_level"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              {...register("level")}
            >
              <option value="">Select level…</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.level && <p className="text-sm text-red-600">! {errors.level.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
