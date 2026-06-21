"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, CalendarDays, CheckCircle2, Trash2 } from "lucide-react";
import type { AxiosError } from "axios";

import { academicCalendarService } from "@/services/academicCalendar.service";
import { academicSessionSchema, type AcademicSessionInput } from "@/lib/validators";
import { SEMESTER_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Semester } from "@/types/common.types";
import type { AcademicSession } from "@/types/combination.types";

const SEMESTERS: Semester[] = ["first", "second"];

export default function AcademicCalendarPage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = React.useState<AcademicSession | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["academic-calendar"],
    queryFn: academicCalendarService.get,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["academic-calendar"] });

  const setCurrentMutation = useMutation({
    mutationFn: (id: number) => academicCalendarService.setCurrentSession(id),
    onSuccess: () => { toast.success("Current session updated"); invalidate(); },
    onError: () => toast.error("Could not update current session"),
  });

  const setSemesterMutation = useMutation({
    mutationFn: (semester: Semester) => academicCalendarService.setSemester(semester),
    onSuccess: () => { toast.success("Current semester updated"); invalidate(); },
    onError: () => toast.error("Could not update semester"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => academicCalendarService.deleteSession(id),
    onSuccess: () => { toast.success("Session deleted"); setDeleting(null); invalidate(); },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete session");
    },
  });

  const sessions = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Calendar"
        description="Set the active session and semester. New assignments and exams default to these."
      />

      {/* Current state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <p className="text-2xl font-bold">{data?.current_session ?? "Not set"}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Semester</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {SEMESTERS.map((sem) => (
                <Button
                  key={sem}
                  size="sm"
                  variant={data?.current_semester === sem ? "default" : "outline"}
                  disabled={setSemesterMutation.isPending}
                  onClick={() => setSemesterMutation.mutate(sem)}
                >
                  {SEMESTER_LABELS[sem]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions list + add */}
      <Card className="p-4">
        <div className="mb-4">
          <AddSessionForm onAdded={invalidate} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No sessions yet"
            description="Add an academic session (e.g. 2024/2025) to get started."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <span className="font-medium">{s.session}</span>
                  {s.is_current && <Badge variant="success">Current</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!s.is_current && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setCurrentMutation.isPending}
                      onClick={() => setCurrentMutation.mutate(s.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Set Current
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn("h-8 w-8 text-red-500 hover:text-red-700", s.is_current && "invisible")}
                    aria-label={`Delete ${s.session}`}
                    onClick={() => setDeleting(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete session?"
        description={<>Delete <strong>{deleting?.session}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function AddSessionForm({ onAdded }: { onAdded: () => void }) {
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<AcademicSessionInput>({ resolver: zodResolver(academicSessionSchema) });

  const onSubmit = async (data: AcademicSessionInput) => {
    try {
      await academicCalendarService.createSession(data.session);
      toast.success("Session added");
      reset({ session: "" });
      onAdded();
    } catch (err) {
      const axiosErr = err as AxiosError<{ errors?: Record<string, string[]> }>;
      const fe = axiosErr.response?.data?.errors;
      if (fe?.session) setError("session", { message: fe.session[0] });
      else toast.error("Could not add session");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="sess">New Session</Label>
        <Input id="sess" placeholder="e.g. 2024/2025" className="font-mono w-40" {...register("session")} />
        {errors.session && <p className="text-sm text-red-600">! {errors.session.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add Session
      </Button>
    </form>
  );
}
