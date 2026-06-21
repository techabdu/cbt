"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Layers, Users, UserMinus } from "lucide-react";
import type { AxiosError } from "axios";

import { combinationService, type CombinationPayload } from "@/services/combination.service";
import { departmentService } from "@/services/department.service";
import { studentService } from "@/services/student.service";
import { combinationSchema, type CombinationInput } from "@/lib/validators";
import { LEVEL_LABELS } from "@/lib/constants";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Combination } from "@/types/combination.types";
import type { Student } from "@/types/student.types";
import type { StudentLevel } from "@/types/common.types";

export default function CombinationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Combination | null>(null);
  const [deleting, setDeleting] = React.useState<Combination | null>(null);
  const [assigning, setAssigning] = React.useState<Combination | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentService.list({ per_page: 100 }),
    staleTime: 60_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["combinations", page, debouncedSearch],
    queryFn: () => combinationService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => combinationService.remove(id),
    onSuccess: () => {
      toast.success("Combination deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["combinations"] });
      queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete combination");
    },
  });

  const departments = deptData?.data ?? [];
  const combinations = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Combinations"
        description="Couple two or more departments into a combined NCE major (e.g. CSC/MAT)."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={departments.length < 2}>
            <Plus className="h-4 w-4" /> Add Combination
          </Button>
        }
      />

      {departments.length < 2 && (
        <Card className="p-4 text-sm text-amber-600 dark:text-amber-400">
          Create at least two departments before building a combination.
        </Card>
      )}

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
        ) : combinations.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={debouncedSearch ? `No combinations match "${debouncedSearch}"` : "No combinations yet"}
            description={debouncedSearch ? "Try a different search." : "Create your first combination to couple departments."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Departments</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((combo) => (
                  <TableRow key={combo.id}>
                    <TableCell className="font-medium">{combo.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{combo.code}</span></TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(combo.departments ?? []).map((d) => (
                          <Badge key={d.id} variant="secondary">{d.code}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{combo.students_count ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${combo.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssigning(combo)}>
                            <Users className="h-4 w-4" /> Manage Students
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(combo); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(combo)}>
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

      <CombinationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        combination={editing}
        departments={departments}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["combinations"] });
          queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
        }}
      />

      <ManageStudentsDialog
        combination={assigning}
        onOpenChange={(o) => !o && setAssigning(null)}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["combinations"] });
          queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete combination?"
        description={<>Permanently delete <strong>{deleting?.name}</strong>? Combinations with assigned students cannot be deleted.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function CombinationFormDialog({
  open, onOpenChange, combination, departments, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  combination: Combination | null;
  departments: { id: number; name: string; code: string }[];
  onSaved: () => void;
}) {
  const isEdit = !!combination;

  const { register, handleSubmit, reset, setValue, watch, setError, formState: { errors, isSubmitting } } =
    useForm<CombinationInput>({ resolver: zodResolver(combinationSchema) });

  const selected = watch("department_ids") ?? [];

  React.useEffect(() => {
    if (open) {
      reset({
        name: combination?.name ?? "",
        code: combination?.code ?? "",
        department_ids: (combination?.departments ?? []).map((d) => String(d.id)),
      });
    }
  }, [open, combination, reset]);

  const toggleDept = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setValue("department_ids", next, { shouldValidate: true });
  };

  const onSubmit = async (data: CombinationInput) => {
    const payload: CombinationPayload = {
      name: data.name,
      code: data.code,
      department_ids: data.department_ids.map(Number),
    };
    try {
      if (isEdit) {
        await combinationService.update(combination!.id, payload);
        toast.success("Combination updated");
      } else {
        await combinationService.create(payload);
        toast.success("Combination created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.code) setError("code", { message: fe.code[0] });
      else toast.error("Could not save combination");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Combination" : "Add Combination"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the combination and its departments." : "Name the combination and select the departments it couples."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cmb_name">Name <span className="text-red-500">*</span></Label>
            <Input id="cmb_name" placeholder="e.g. Computer Science / Mathematics" {...register("name")} />
            {errors.name && <p className="text-sm text-red-600">! {errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmb_code">Code <span className="text-red-500">*</span></Label>
            <Input id="cmb_code" placeholder="e.g. CSC/MAT" className="font-mono" {...register("code")} />
            {errors.code && <p className="text-sm text-red-600">! {errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Departments <span className="text-red-500">*</span></Label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {departments.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={selected.includes(String(d.id))}
                    onChange={() => toggleDept(String(d.id))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm">{d.name} <span className="font-mono text-xs text-slate-500">({d.code})</span></span>
                </label>
              ))}
            </div>
            {errors.department_ids && <p className="text-sm text-red-600">! {errors.department_ids.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Combination"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageStudentsDialog({
  combination, onOpenChange, onChanged,
}: {
  combination: Combination | null;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const open = !!combination;
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<number[]>([]);
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => {
    if (open) { setSearch(""); setSelected([]); }
  }, [open, combination?.id]);

  // Students already in this combination
  const { data: assignedData } = useQuery({
    queryKey: ["combination-students", combination?.id],
    queryFn: () => combinationService.students(combination!.id, { per_page: 100 }),
    enabled: open,
  });

  // Unassigned students (available to add) — backend filters out those already
  // tied to a combination via filter[unassigned].
  const { data: pickerData } = useQuery({
    queryKey: ["students", "unassigned", debouncedSearch],
    queryFn: () => studentService.list({
      per_page: 50,
      "filter[search]": debouncedSearch || undefined,
      "filter[unassigned]": 1,
    }),
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: () => combinationService.assignStudents(combination!.id, selected),
    onSuccess: (res) => {
      toast.success(`${selected.length} student(s) assigned · ${res.enrolments_created} enrolment(s) created`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["combination-students", combination?.id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onChanged();
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not assign students");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: number) => combinationService.removeStudent(combination!.id, studentId),
    onSuccess: () => {
      toast.success("Student removed from combination");
      queryClient.invalidateQueries({ queryKey: ["combination-students", combination?.id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onChanged();
    },
    onError: () => toast.error("Could not remove student"),
  });

  const toggleStudent = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const assigned = assignedData?.data ?? [];
  const picker = pickerData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Students — {combination?.code}</DialogTitle>
          <DialogDescription>
            Assigning a student auto-enrols them into every course of this combination&apos;s departments at their level.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add students */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add Students</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search unassigned…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {picker.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No unassigned students found</p>
              ) : (
                picker.map((stu: Student) => (
                  <label key={stu.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={selected.includes(stu.id)}
                      onChange={() => toggleStudent(stu.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex-1 text-sm">
                      {stu.full_name}
                      <span className="ml-2 font-mono text-xs text-slate-500">{stu.matric_number}</span>
                      <span className="ml-2 text-xs text-slate-400">{LEVEL_LABELS[stu.level as StudentLevel] ?? stu.level}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <Button
              className="w-full"
              disabled={selected.length === 0 || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>

          {/* Currently assigned */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Assigned ({assigned.length})</h3>
            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {assigned.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No students assigned yet</p>
              ) : (
                assigned.map((stu) => (
                  <div key={stu.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">
                      {stu.full_name}
                      <span className="ml-2 font-mono text-xs text-slate-500">{stu.matric_number}</span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      aria-label={`Remove ${stu.full_name}`}
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(stu.id)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
