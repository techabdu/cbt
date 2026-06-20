"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, KeyRound, Loader2, AlertCircle, Search, Users, CheckCircle2,
  Calendar, Clock, Timer, BookOpen, UploadCloud, DownloadCloud,
} from "lucide-react";
import type { AxiosError } from "axios";

import { cbtExamService } from "@/services/cbtExam.service";
import { EXAM_STATUS, SEMESTER_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Semester } from "@/types/common.types";

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const examId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => cbtExamService.get(examId),
  });

  const exam = data?.data;

  const { data: codesData, isLoading: codesLoading, isFetching: codesFetching } = useQuery({
    queryKey: ["exam-codes", examId, page, debouncedSearch],
    queryFn: () => cbtExamService.codes(examId, { page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
    enabled: !!exam,
  });

  const generateMutation = useMutation({
    mutationFn: () => cbtExamService.generateCodes(examId),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exam-codes", examId] });
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
    },
    onError: () => toast.error("Could not generate codes"),
  });

  const syncMutation = useMutation({
    mutationFn: () => cbtExamService.sync(examId),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) =>
      toast.error(err.response?.data?.message ?? "Sync failed — could not reach the offline server."),
  });

  const pullMutation = useMutation({
    mutationFn: () => cbtExamService.pullResults(examId),
    onSuccess: (res) => {
      toast.success(res.message ?? "Results pulled successfully.");
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (err: AxiosError<{ message?: string }>) =>
      toast.error(err.response?.data?.message ?? "Pull failed — could not reach the offline server."),
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (isError || !exam) {
    return (
      <div className="space-y-4">
        <BackLink router={router} />
        <Card><CardContent className="py-12 text-center text-slate-500">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" /> Exam not found.
        </CardContent></Card>
      </div>
    );
  }

  const status = EXAM_STATUS[exam.status];
  const codes = codesData?.data ?? [];
  const codesTotal = codesData?.meta.total ?? 0;
  const eligible = exam.eligible_count ?? 0;
  const allGenerated = eligible > 0 && codesTotal >= eligible;
  const canSync = (exam.status === "scheduled" || exam.status === "synced") && codesTotal > 0;
  const canPull = ["synced", "ongoing", "completed", "results_synced"].includes(exam.status);

  return (
    <div className="space-y-6">
      <BackLink router={router} />

      <PageHeader
        title={exam.course?.title ?? "Exam"}
        description={`${exam.course?.code ?? ""} · ${exam.session} · ${SEMESTER_LABELS[exam.semester as Semester] ?? exam.semester}`}
        action={
          <div className="flex items-center gap-3">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Button onClick={() => syncMutation.mutate()} disabled={!canSync || syncMutation.isPending} variant="outline">
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {exam.status === "synced" ? "Re-sync" : "Sync to Offline"}
            </Button>
            <Button onClick={() => pullMutation.mutate()} disabled={!canPull || pullMutation.isPending}>
              {pullMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              Pull Results
            </Button>
          </div>
        }
      />

      {exam.status === "synced" && (
        <Card className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30">
          <CardContent className="flex items-center gap-3 py-3 text-sm text-purple-700 dark:text-purple-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> This exam has been synced to the offline server and is ready for students.
          </CardContent>
        </Card>
      )}

      {exam.status === "results_synced" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-3 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Results have been pulled from the offline server. Lecturers can now view and download them.
          </CardContent>
        </Card>
      )}

      {/* Schedule summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile icon={Calendar} label="Date" value={format(new Date(exam.exam_date), "dd MMM yyyy")} />
        <SummaryTile icon={Clock} label="Start" value={exam.start_time?.slice(0, 5)} />
        <SummaryTile icon={Timer} label="Duration" value={`${exam.duration_minutes} min`} />
        <SummaryTile icon={BookOpen} label="Questions" value={String(exam.question_bank?.total_questions ?? "—")} />
      </div>

      {/* Codes section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" /> Exam Codes</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {codesTotal} of {eligible} eligible student{eligible === 1 ? "" : "s"} have a code.
            </p>
          </div>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || allGenerated}>
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : allGenerated ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {allGenerated ? "All Generated" : codesTotal > 0 ? "Generate Missing" : "Generate Codes"}
          </Button>
        </CardHeader>
        <CardContent>
          {eligible === 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              No students are enrolled in this course for {exam.session} ({SEMESTER_LABELS[exam.semester as Semester]}). Ask the Exam Officer to enroll students first.
            </div>
          )}

          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search by student name or matric…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {codesLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : codes.length === 0 ? (
            <EmptyState
              icon={Users}
              title={debouncedSearch ? "No matching codes" : "No codes generated yet"}
              description={debouncedSearch ? "Try a different search." : "Generate codes to give enrolled students access to this exam."}
            />
          ) : (
            <div className={codesFetching ? "opacity-60 transition-opacity" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.student?.full_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{c.student?.matric_number}</TableCell>
                      <TableCell><span className="rounded bg-slate-100 px-2 py-1 font-mono text-sm font-semibold tracking-wider dark:bg-slate-800">{c.code}</span></TableCell>
                      <TableCell>
                        <Badge variant={c.is_used ? "secondary" : "success"}>{c.is_used ? "Used" : "Unused"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {codesData && <Pagination meta={codesData.meta} onPageChange={setPage} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-slate-400"><Icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">{label}</span></div>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BackLink({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Link
      href="/dashboard/cbt-admin/exams"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      onClick={(e) => { e.preventDefault(); router.push("/dashboard/cbt-admin/exams"); }}
    >
      <ArrowLeft className="h-4 w-4" /> Back to exams
    </Link>
  );
}
