"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Trash2, Loader2, ClipboardList, ChevronRight, KeyRound, FileUp, DownloadCloud } from "lucide-react";
import type { AxiosError } from "axios";

import { cbtExamService, type CreateExamPayload } from "@/services/cbtExam.service";
import { EXAM_STATUS, SEMESTER_LABELS } from "@/lib/constants";
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
import type { Exam } from "@/types/exam.types";
import type { Semester } from "@/types/common.types";

export default function ExamsPage() {
  return (
    <React.Suspense fallback={null}>
      <ExamsView />
    </React.Suspense>
  );
}

function ExamsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [presetBank, setPresetBank] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<Exam | null>(null);
  const [pullOpen, setPullOpen] = React.useState(false);
  const importPkgRef = React.useRef<HTMLInputElement>(null);

  const { data: health } = useQuery({
    queryKey: ["server-health"],
    queryFn: () => cbtExamService.health(),
    staleTime: 5 * 60_000,
  });
  const isOffline = health?.offline_server ?? false;

  const importPkgMutation = useMutation({
    mutationFn: (file: File) => cbtExamService.importPackage(file),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
      if (res.exam?.id) router.push(`/dashboard/cbt-admin/exams/${res.exam.id}`);
    },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Could not import the exam package."),
  });

  // Open the create dialog pre-seeded when arriving from the banks page.
  React.useEffect(() => {
    const bank = searchParams.get("bank");
    if (bank) {
      setPresetBank(Number(bank));
      setCreateOpen(true);
    }
  }, [searchParams]);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["exams", page, debouncedSearch],
    queryFn: () => cbtExamService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cbtExamService.remove(id),
    onSuccess: () => {
      toast.success("Exam deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Could not delete exam"),
  });

  const exams = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description={isOffline
          ? "Import exams from the online server, then students sit them on this offline server."
          : "Configure exams from approved question banks and generate student access codes."}
        action={
          isOffline ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPullOpen(true)}>
                <DownloadCloud className="h-4 w-4" /> Pull from online
              </Button>
              <Button onClick={() => importPkgRef.current?.click()} disabled={importPkgMutation.isPending}>
                {importPkgMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Import exam package
              </Button>
            </div>
          ) : (
            <Button onClick={() => { setPresetBank(null); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" /> Configure Exam
            </Button>
          )
        }
      />

      <input
        ref={importPkgRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importPkgMutation.mutate(f); e.target.value = ""; }}
      />

      <PullFromOnlineDialog open={pullOpen} onOpenChange={setPullOpen} onPulled={(id) => router.push(`/dashboard/cbt-admin/exams/${id}`)} />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by course title or code…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={debouncedSearch ? "No matching exams" : "No exams configured"}
            description={debouncedSearch ? "Try a different search." : "Configure your first exam from an approved question bank."}
            action={!debouncedSearch && !isOffline && (
              <Button onClick={() => { setPresetBank(null); setCreateOpen(true); }}>
                <Plus className="h-4 w-4" /> Configure Exam
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Duration</TableHead>
                  <TableHead className="text-center">Codes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => {
                  const status = EXAM_STATUS[exam.status];
                  return (
                    <TableRow key={exam.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/cbt-admin/exams/${exam.id}`)}>
                      <TableCell>
                        <p className="font-medium">{exam.course?.title}</p>
                        <p className="font-mono text-xs text-slate-500">{exam.course?.code} · {exam.session} · {SEMESTER_LABELS[exam.semester as Semester] ?? exam.semester}</p>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(exam.exam_date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-sm font-mono">{exam.start_time?.slice(0, 5)}</TableCell>
                      <TableCell className="text-center text-sm">{exam.duration_minutes}m</TableCell>
                      <TableCell className="text-center">
                        {exam.codes_count ? (
                          <span className="inline-flex items-center gap-1 text-sm"><KeyRound className="h-3 w-3 text-slate-400" />{exam.codes_count}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Exam actions"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/cbt-admin/exams/${exam.id}`)}>
                              <ChevronRight className="h-4 w-4" /> Open
                            </DropdownMenuItem>
                            {exam.status === "scheduled" && (
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(exam)}>
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>

      <CreateExamDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setPresetBank(null); }}
        presetBankId={presetBank}
        onCreated={(id) => router.push(`/dashboard/cbt-admin/exams/${id}`)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete exam?"
        description={<>Delete the exam for <strong>{deleting?.course?.code}</strong>? This is only possible before it is synced to the offline server.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

/**
 * Offline server only: pull an exam package from the online server by its id
 * (shown on the online server's exam page) over a brief internet connection.
 */
function PullFromOnlineDialog({
  open, onOpenChange, onPulled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPulled: (examId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [examId, setExamId] = React.useState("");

  React.useEffect(() => { if (open) setExamId(""); }, [open]);

  const mutation = useMutation({
    mutationFn: () => cbtExamService.networkPull(Number(examId)),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      onOpenChange(false);
      if (res.exam?.id) onPulled(res.exam.id);
    },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Pull failed — could not reach the online server."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pull exam from online</DialogTitle>
          <DialogDescription>Enter the exam ID (shown on the online server&apos;s exam page). This server must be briefly online and have ONLINE_SERVER_URL configured.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pull_id">Exam ID <span className="text-red-500">*</span></Label>
          <Input id="pull_id" type="number" min={1} placeholder="e.g. 12" value={examId} onChange={(e) => setExamId(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!examId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pull Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExamForm {
  question_bank_id: string;
  exam_date: string;
  start_time: string;
  duration_minutes: string;
}

function CreateExamDialog({
  open, onOpenChange, presetBankId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetBankId: number | null;
  onCreated: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ExamForm>();

  const { data: banksData, isLoading } = useQuery({
    queryKey: ["cbt-approved-banks", "picker"],
    queryFn: () => cbtExamService.approvedBanks({ per_page: 100 }),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) {
      reset({ question_bank_id: presetBankId ? String(presetBankId) : "", exam_date: "", start_time: "09:00", duration_minutes: "60" });
    }
  }, [open, presetBankId, reset]);

  React.useEffect(() => {
    if (open && presetBankId) setValue("question_bank_id", String(presetBankId));
  }, [open, presetBankId, setValue]);

  const mutation = useMutation({
    mutationFn: (payload: CreateExamPayload) => cbtExamService.create(payload),
    onSuccess: (res) => {
      toast.success("Exam configured");
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["cbt-admin-stats"] });
      onOpenChange(false);
      onCreated(res.data.id);
    },
    onError: (err: AxiosError<{ errors?: Record<string, string[]>; message?: string }>) => {
      const msg = err.response?.data?.errors ? Object.values(err.response.data.errors)[0]?.[0] : undefined;
      toast.error(msg ?? err.response?.data?.message ?? "Could not configure exam");
    },
  });

  const banks = banksData?.data ?? [];

  const onSubmit = (form: ExamForm) => {
    mutation.mutate({
      question_bank_id: Number(form.question_bank_id),
      exam_date: form.exam_date,
      start_time: form.start_time,
      duration_minutes: Number(form.duration_minutes),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Exam</DialogTitle>
          <DialogDescription>Pick an approved question bank and set the schedule. The course, session and semester come from the bank.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : banks.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No approved banks" description="There are no approved question banks to build an exam from yet." />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ex_bank">Question Bank <span className="text-red-500">*</span></Label>
              <select
                id="ex_bank"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                {...register("question_bank_id", { required: "Select a question bank" })}
              >
                <option value="">Select approved bank…</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.course?.code} — {b.course?.title} ({b.total_questions} Qs, {b.session})
                  </option>
                ))}
              </select>
              {errors.question_bank_id && <p className="text-sm text-red-600">! {errors.question_bank_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ex_date">Exam Date <span className="text-red-500">*</span></Label>
                <Input id="ex_date" type="date" {...register("exam_date", { required: "Required" })} />
                {errors.exam_date && <p className="text-sm text-red-600">! {errors.exam_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex_time">Start Time <span className="text-red-500">*</span></Label>
                <Input id="ex_time" type="time" {...register("start_time", { required: "Required" })} />
                {errors.start_time && <p className="text-sm text-red-600">! {errors.start_time.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5 max-w-40">
              <Label htmlFor="ex_dur">Duration (min) <span className="text-red-500">*</span></Label>
              <Input id="ex_dur" type="number" min={5} max={480} {...register("duration_minutes", { required: "Required" })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Configure Exam
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
