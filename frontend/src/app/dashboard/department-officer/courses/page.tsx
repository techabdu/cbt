"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react";
import type { AxiosError } from "axios";

import { deptOfficerService, type CourseWithCounts, type DeptCoursePayload } from "@/services/deptOfficer.service";
import { deptCourseSchema, type DeptCourseInput } from "@/lib/validators";
import { LEVEL_LABELS, LEVEL_OPTIONS, SEMESTER_LABELS } from "@/lib/constants";
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
import type { StudentLevel, Semester } from "@/types/common.types";

export default function DeptCoursesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CourseWithCounts | null>(null);
  const [deleting, setDeleting] = React.useState<CourseWithCounts | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch, levelFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dept-courses", page, debouncedSearch, levelFilter],
    queryFn: () => deptOfficerService.listCourses({
      page,
      "filter[search]": debouncedSearch || undefined,
      "filter[level]": levelFilter || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deptOfficerService.removeCourse(id),
    onSuccess: () => {
      toast.success("Course deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["dept-courses"] });
      queryClient.invalidateQueries({ queryKey: ["dept-officer-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete course");
    },
  });

  const courses = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Manage the courses offered by your department, per level and semester."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Course
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative max-w-sm flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by title or code…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 min-w-40"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            aria-label="Filter by level"
          >
            <option value="">All Levels</option>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={debouncedSearch || levelFilter ? "No courses match the filters" : "No courses yet"}
            description={debouncedSearch || levelFilter ? "Try adjusting your filters." : "Create your first course to get started."}
            action={!debouncedSearch && !levelFilter && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" /> Add Course
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Units</TableHead>
                  <TableHead className="text-center">Lecturers</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell><span className="font-mono text-xs">{course.code}</span></TableCell>
                    <TableCell className="text-sm">{LEVEL_LABELS[course.level as StudentLevel] ?? course.level}</TableCell>
                    <TableCell className="text-sm">{SEMESTER_LABELS[course.semester as Semester] ?? course.semester}</TableCell>
                    <TableCell className="text-center">{course.credit_units}</TableCell>
                    <TableCell className="text-center">{course.lecturers_count ?? 0}</TableCell>
                    <TableCell className="text-center">{course.students_count ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${course.title}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(course); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(course)}>
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

      <DeptCourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["dept-courses"] });
          queryClient.invalidateQueries({ queryKey: ["dept-officer-stats"] });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete course?"
        description={<>Permanently delete <strong>{deleting?.title}</strong>? Courses with assigned lecturers or enrolled students cannot be deleted.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function DeptCourseFormDialog({
  open, onOpenChange, course, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course: CourseWithCounts | null;
  onSaved: () => void;
}) {
  const isEdit = !!course;

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<DeptCourseInput>({ resolver: zodResolver(deptCourseSchema) });

  React.useEffect(() => {
    if (open) {
      reset({
        title:        course?.title ?? "",
        code:         course?.code ?? "",
        credit_units: String(course?.credit_units ?? "3"),
        level:        course?.level ?? "",
        semester:     course?.semester ?? "",
      });
    }
  }, [open, course, reset]);

  const onSubmit = async (data: DeptCourseInput) => {
    const payload: DeptCoursePayload = {
      title:        data.title,
      code:         data.code,
      level:        data.level,
      semester:     data.semester,
      credit_units: Number(data.credit_units),
    };
    try {
      if (isEdit) {
        await deptOfficerService.updateCourse(course!.id, payload);
        toast.success("Course updated");
      } else {
        await deptOfficerService.createCourse(payload);
        toast.success("Course created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.code) setError("code", { message: fe.code[0] });
      else toast.error("Could not save course");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Course" : "Add Course"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update course details." : "Create a new course in your department."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="crs_title">Title <span className="text-red-500">*</span></Label>
            <Input id="crs_title" placeholder="e.g. Introduction to Computing" {...register("title")} />
            {errors.title && <p className="text-sm text-red-600">! {errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="crs_code">Code <span className="text-red-500">*</span></Label>
              <Input id="crs_code" placeholder="e.g. CSC101" className="font-mono" {...register("code")} />
              {errors.code && <p className="text-sm text-red-600">! {errors.code.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crs_units">Credit Units <span className="text-red-500">*</span></Label>
              <Input id="crs_units" type="number" min={1} max={10} {...register("credit_units")} />
              {errors.credit_units && <p className="text-sm text-red-600">! {errors.credit_units.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="crs_level">Level <span className="text-red-500">*</span></Label>
              <select
                id="crs_level"
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
            <div className="space-y-1.5">
              <Label htmlFor="crs_semester">Semester <span className="text-red-500">*</span></Label>
              <select
                id="crs_semester"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                {...register("semester")}
              >
                <option value="">Select semester…</option>
                <option value="first">First Semester</option>
                <option value="second">Second Semester</option>
              </select>
              {errors.semester && <p className="text-sm text-red-600">! {errors.semester.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
