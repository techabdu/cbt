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
  FileDown, FileUp, Send, ArrowLeftRight,
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

      <OfflineExchangeCard
        examId={examId}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["exam", examId] });
          queryClient.invalidateQueries({ queryKey: ["exams"] });
        }}
      />

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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Move exam data between a cloud-online server and an isolated exam-hall server.
 * The actions shown depend on which server this is (from /health): the online
 * server exports the exam package and imports results; the offline server
 * exports results and (when briefly online) pushes them back.
 */
function OfflineExchangeCard({ examId, onChanged }: { examId: number; onChanged: () => void }) {
  const resultsFileRef = React.useRef<HTMLInputElement>(null);

  const { data: health } = useQuery({
    queryKey: ["server-health"],
    queryFn: () => cbtExamService.health(),
    staleTime: 5 * 60_000,
  });
  const isOffline = health?.offline_server ?? false;

  const exportPkg = useMutation({
    mutationFn: () => cbtExamService.exportPackage(examId),
    onSuccess: ({ blob, filename }) => { triggerDownload(blob, filename); toast.success("Exam package downloaded."); onChanged(); },
    onError: () => toast.error("Could not export — make sure exam codes have been generated."),
  });

  const exportRes = useMutation({
    mutationFn: () => cbtExamService.exportResults(examId),
    onSuccess: ({ blob, filename }) => { triggerDownload(blob, filename); toast.success("Results downloaded."); },
    onError: () => toast.error("Could not export results."),
  });

  const importRes = useMutation({
    mutationFn: (file: File) => cbtExamService.importResults(examId, file),
    onSuccess: (res) => { toast.success(res.message); onChanged(); },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Could not import results."),
  });

  const pushRes = useMutation({
    mutationFn: () => cbtExamService.networkPushResults(examId),
    onSuccess: (res) => { toast.success(res.message); onChanged(); },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Push failed — could not reach the online server."),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-slate-400" /> Offline Exchange</span>
          <Badge variant="secondary">{isOffline ? "This is the OFFLINE server" : "This is the ONLINE server"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          For a cloud-hosted online server with an isolated exam-hall server, move exam data by <strong>file</strong> (download here, carry on a USB drive, upload on the other server) or, if this server is briefly online, over the <strong>network</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          {!isOffline ? (
            <>
              <Button variant="outline" size="sm" onClick={() => exportPkg.mutate()} disabled={exportPkg.isPending}>
                {exportPkg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Export exam package
              </Button>
              <Button variant="outline" size="sm" onClick={() => resultsFileRef.current?.click()} disabled={importRes.isPending}>
                {importRes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Import results (file)
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => exportRes.mutate()} disabled={exportRes.isPending}>
                {exportRes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Export results (file)
              </Button>
              <Button variant="outline" size="sm" onClick={() => pushRes.mutate()} disabled={pushRes.isPending}>
                {pushRes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Push results to online
              </Button>
            </>
          )}
        </div>
        <input
          ref={resultsFileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importRes.mutate(f); e.target.value = ""; }}
        />
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
