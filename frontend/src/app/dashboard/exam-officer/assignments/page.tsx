"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Users, UserPlus, UserMinus, GraduationCap, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

import { courseService, type CourseWithCounts } from "@/services/course.service";
import { assignmentService } from "@/services/assignment.service";
import { lecturerService } from "@/services/lecturer.service";
import { studentService } from "@/services/student.service";
import { LEVEL_LABELS, SEMESTER_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StaffUser } from "@/types/user.types";
import type { Student } from "@/types/student.types";
import type { StudentLevel, Semester } from "@/types/common.types";

export default function AssignmentsPage() {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [expanded, setExpanded] = React.useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["courses", "all", debouncedSearch],
    queryFn: () => courseService.list({ per_page: 50, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const courses = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Assign lecturers to courses and enroll students."
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search courses…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={debouncedSearch ? `No courses match "${debouncedSearch}"` : "No courses yet"}
          description="Create courses first, then assign lecturers and students here."
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <CourseAssignmentCard
              key={course.id}
              course={course}
              expanded={expanded === course.id}
              onToggle={() => setExpanded(expanded === course.id ? null : course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseAssignmentCard({
  course, expanded, onToggle,
}: {
  course: CourseWithCounts;
  expanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const [lecturerDialogOpen, setLecturerDialogOpen] = React.useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = React.useState(false);

  const { data: lecturerData } = useQuery({
    queryKey: ["course-lecturers", course.id],
    queryFn: () => assignmentService.courseLecturers(course.id),
    enabled: expanded,
  });

  const { data: studentData } = useQuery({
    queryKey: ["course-students", course.id],
    queryFn: () => assignmentService.courseStudents(course.id, { per_page: 100 }),
    enabled: expanded,
  });

  const removeLecturerMutation = useMutation({
    mutationFn: (lecturerId: number) => assignmentService.removeLecturer(course.id, lecturerId),
    onSuccess: () => {
      toast.success("Lecturer removed");
      queryClient.invalidateQueries({ queryKey: ["course-lecturers", course.id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: () => toast.error("Could not remove lecturer"),
  });

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: number) => assignmentService.removeStudent(course.id, studentId),
    onSuccess: () => {
      toast.success("Student removed from course");
      queryClient.invalidateQueries({ queryKey: ["course-students", course.id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: () => toast.error("Could not remove student"),
  });

  const lecturers = lecturerData?.data ?? [];
  const students  = studentData?.data ?? [];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-4"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            <div>
              <CardTitle className="text-base">{course.title}</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono">{course.code}</span>
                {" · "}
                {LEVEL_LABELS[course.level as StudentLevel] ?? course.level}
                {" · "}
                {SEMESTER_LABELS[course.semester as Semester] ?? course.semester}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{course.lecturers_count ?? 0}</Badge>
            <Badge variant="secondary"><GraduationCap className="h-3 w-3 mr-1" />{course.students_count ?? 0}</Badge>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* Lecturers panel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Lecturers</h3>
                <Button size="sm" variant="outline" onClick={() => setLecturerDialogOpen(true)}>
                  <UserPlus className="h-3 w-3" /> Assign
                </Button>
              </div>
              {!lecturerData ? (
                <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
              ) : lecturers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No lecturers assigned</p>
              ) : (
                <ul className="space-y-1">
                  {lecturers.map((lec) => (
                    <li key={lec.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{lec.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{lec.file_number}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        aria-label={`Remove ${lec.name}`}
                        disabled={removeLecturerMutation.isPending}
                        onClick={() => removeLecturerMutation.mutate(lec.id)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Students panel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Students ({students.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setStudentDialogOpen(true)}>
                  <UserPlus className="h-3 w-3" /> Enroll
                </Button>
              </div>
              {!studentData ? (
                <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : students.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No students enrolled</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto space-y-1">
                  {students.map((stu) => (
                    <li key={stu.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 px-3 py-1.5">
                      <div>
                        <p className="text-sm">{stu.full_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{stu.matric_number}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        aria-label={`Remove ${stu.full_name}`}
                        disabled={removeStudentMutation.isPending}
                        onClick={() => removeStudentMutation.mutate(stu.id)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      )}

      <AssignLecturerDialog
        open={lecturerDialogOpen}
        onOpenChange={setLecturerDialogOpen}
        courseId={course.id}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ["course-lecturers", course.id] });
          queryClient.invalidateQueries({ queryKey: ["courses"] });
        }}
      />

      <EnrollStudentsDialog
        open={studentDialogOpen}
        onOpenChange={setStudentDialogOpen}
        courseId={course.id}
        onEnrolled={() => {
          queryClient.invalidateQueries({ queryKey: ["course-students", course.id] });
          queryClient.invalidateQueries({ queryKey: ["courses"] });
        }}
      />
    </Card>
  );
}

function AssignLecturerDialog({
  open, onOpenChange, courseId, onAssigned,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: number;
  onAssigned: () => void;
}) {
  const [lecturerId, setLecturerId] = React.useState("");
  const [session, setSession] = React.useState("");
  const [semester, setSemester] = React.useState("");

  const { data: lecturerData } = useQuery({
    queryKey: ["lecturers", "all"],
    queryFn: () => lecturerService.list({ per_page: 100 }),
    enabled: open,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => assignmentService.assignLecturer(courseId, {
      lecturer_id: Number(lecturerId),
      session,
      semester,
    }),
    onSuccess: () => {
      toast.success("Lecturer assigned");
      onAssigned();
      onOpenChange(false);
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not assign lecturer");
    },
  });

  React.useEffect(() => {
    if (open) { setLecturerId(""); setSession(""); setSemester(""); }
  }, [open]);

  const canSubmit = lecturerId && session && semester;
  const lecturers = lecturerData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Lecturer</DialogTitle>
          <DialogDescription>Select a lecturer and specify the session/semester for this assignment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="al_lecturer">Lecturer <span className="text-red-500">*</span></Label>
            <select
              id="al_lecturer"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
            >
              <option value="">Select lecturer…</option>
              {lecturers.map((l: StaffUser) => (
                <option key={l.id} value={l.id}>{l.name} ({l.file_number})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al_session">Session <span className="text-red-500">*</span></Label>
            <Input
              id="al_session"
              placeholder="e.g. 2024/2025"
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al_semester">Semester <span className="text-red-500">*</span></Label>
            <select
              id="al_semester"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Select semester…</option>
              <option value="first">First Semester</option>
              <option value="second">Second Semester</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollStudentsDialog({
  open, onOpenChange, courseId, onEnrolled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId: number;
  onEnrolled: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<number[]>([]);
  const [session, setSession] = React.useState("");
  const [semester, setSemester] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data } = useQuery({
    queryKey: ["students", "picker", debouncedSearch],
    queryFn: () => studentService.list({ per_page: 50, "filter[search]": debouncedSearch || undefined }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => assignmentService.assignStudents(courseId, {
      student_ids: selected,
      session,
      semester,
    }),
    onSuccess: () => {
      toast.success(`${selected.length} student(s) enrolled`);
      onEnrolled();
      onOpenChange(false);
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not enroll students");
    },
  });

  React.useEffect(() => {
    if (open) { setSearch(""); setSelected([]); setSession(""); setSemester(""); }
  }, [open]);

  const toggleStudent = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const students = data?.data ?? [];
  const canSubmit = selected.length > 0 && session && semester;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll Students</DialogTitle>
          <DialogDescription>Select students and specify the session/semester for this enrolment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="es_session">Session <span className="text-red-500">*</span></Label>
              <Input id="es_session" placeholder="2024/2025" value={session} onChange={(e) => setSession(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="es_semester">Semester <span className="text-red-500">*</span></Label>
              <select
                id="es_semester"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="">Select…</option>
                <option value="first">First</option>
                <option value="second">Second</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="es_search">Search Students</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="es_search" placeholder="Name or matric number…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            {students.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No students found</p>
            ) : (
              students.map((stu: Student) => (
                <label
                  key={stu.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(stu.id)}
                    onChange={() => toggleStudent(stu.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-medium">{stu.full_name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{stu.matric_number}</span>
                  </span>
                </label>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <p className="text-sm text-blue-600 font-medium">{selected.length} student(s) selected</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enroll {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
