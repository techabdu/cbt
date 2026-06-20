"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle, User2, BookOpen,
} from "lucide-react";
import type { AxiosError } from "axios";

import { moderationService } from "@/services/moderation.service";
import { QUESTION_BANK_STATUS, SEMESTER_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuestionPreview } from "@/components/shared/QuestionPreview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Semester } from "@/types/common.types";

export default function ModerationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bankId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [approveOpen, setApproveOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["moderation-bank", bankId],
    queryFn: () => moderationService.get(bankId),
  });

  const bank = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["moderation-bank", bankId] });
    queryClient.invalidateQueries({ queryKey: ["moderation"] });
    queryClient.invalidateQueries({ queryKey: ["exam-officer-stats"] });
  };

  const approveMutation = useMutation({
    mutationFn: () => moderationService.approve(bankId),
    onSuccess: () => {
      toast.success("Question bank approved");
      setApproveOpen(false);
      invalidate();
    },
    onError: (err: AxiosError<{ message?: string }>) =>
      toast.error(err.response?.data?.message ?? "Could not approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => moderationService.reject(bankId, reason),
    onSuccess: () => {
      toast.success("Question bank returned to lecturer");
      setRejectOpen(false);
      invalidate();
    },
    onError: (err: AxiosError<{ errors?: Record<string, string[]>; message?: string }>) =>
      toast.error(err.response?.data?.errors?.reason?.[0] ?? err.response?.data?.message ?? "Could not reject"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError || !bank) {
    return (
      <div className="space-y-4">
        <BackLink router={router} />
        <Card><CardContent className="py-12 text-center text-slate-500">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
          Question bank not found or outside your school.
        </CardContent></Card>
      </div>
    );
  }

  const status = QUESTION_BANK_STATUS[bank.status];
  const pending = bank.status === "submitted" || bank.status === "under_review";
  const questions = bank.questions ?? [];

  return (
    <div className="space-y-6">
      <BackLink router={router} />

      <PageHeader
        title={bank.course?.title ?? bank.title ?? "Question Bank"}
        description={`${bank.course?.code ?? ""} · ${bank.session} · ${SEMESTER_LABELS[bank.semester as Semester] ?? bank.semester}`}
        action={<Badge variant={status.variant}>{status.label}</Badge>}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-500">Submission details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
          <div className="flex items-center gap-2">
            <User2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-slate-400 text-xs">Lecturer</p>
              <p className="font-medium">{bank.lecturer?.name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-slate-400 text-xs">Questions</p>
              <p className="font-medium">{bank.total_questions}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-slate-400 text-xs">Total marks</p>
              <p className="font-medium">{questions.reduce((sum, q) => sum + q.marks, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {bank.status === "rejected" && bank.rejection_reason && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="flex gap-3 py-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">Returned to lecturer</p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{bank.rejection_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {bank.status === "approved" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              Approved{bank.reviewer ? ` by ${bank.reviewer.name}` : ""}. CBT Admins have been notified.
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Questions <span className="font-normal text-slate-400">({questions.length})</span>
        </h3>
        <ol className="space-y-3">
          {questions.map((q) => (
            <li key={q.id}><QuestionPreview question={q} /></li>
          ))}
        </ol>
      </div>

      {pending && (
        <div className="sticky bottom-4 flex justify-end gap-3 rounded-lg border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950" onClick={() => setRejectOpen(true)}>
            <XCircle className="h-4 w-4" /> Return for Revision
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => setApproveOpen(true)}>
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve question bank?"
        description={<>Approve <strong>{bank.course?.code}</strong> with {questions.length} question{questions.length === 1 ? "" : "s"}? The lecturer and all CBT Admins will be notified, and the bank will be locked.</>}
        confirmLabel="Approve"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={rejectMutation.isPending}
        onSubmit={(reason) => rejectMutation.mutate(reason)}
      />
    </div>
  );
}

function BackLink({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Link
      href="/dashboard/exam-officer/moderation"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      onClick={(e) => { e.preventDefault(); router.push("/dashboard/exam-officer/moderation"); }}
    >
      <ArrowLeft className="h-4 w-4" /> Back to moderation queue
    </Link>
  );
}

function RejectDialog({
  open, onOpenChange, loading, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) { setReason(""); setTouched(false); }
  }, [open]);

  const tooShort = reason.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return for revision</DialogTitle>
          <DialogDescription>
            Explain what needs to change. The lecturer will see this and can edit and resubmit the bank.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject_reason">Reason <span className="text-red-500">*</span></Label>
          <Textarea
            id="reject_reason"
            rows={4}
            placeholder="e.g. Question 3 has two correct options; question 7 is missing its answer."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {touched && tooShort && (
            <p className="text-sm text-red-600">! Please give at least 5 characters so it is actionable.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={tooShort || loading}
            onClick={() => onSubmit(reason.trim())}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Return to Lecturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
