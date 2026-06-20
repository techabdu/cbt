"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Send, CheckCircle2,
  XCircle, AlertCircle, GripVertical,
} from "lucide-react";
import type { AxiosError } from "axios";

import { questionBankService } from "@/services/questionBank.service";
import { QUESTION_BANK_STATUS, QUESTION_TYPE_LABELS, SEMESTER_LABELS } from "@/lib/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionEditorDialog } from "@/components/lecturer/QuestionEditorDialog";
import type { Question, QuestionBank } from "@/types/question.types";
import type { Semester } from "@/types/common.types";

export default function QuestionBankEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bankId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion] = React.useState<Question | null>(null);
  const [submitOpen, setSubmitOpen] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["question-bank", bankId],
    queryFn: () => questionBankService.get(bankId),
  });

  const bank = data?.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["question-bank", bankId] });
    queryClient.invalidateQueries({ queryKey: ["question-banks"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (questionId: number) => questionBankService.removeQuestion(bankId, questionId),
    onSuccess: () => {
      toast.success("Question removed");
      setDeletingQuestion(null);
      invalidate();
    },
    onError: () => toast.error("Could not remove question"),
  });

  const submitMutation = useMutation({
    mutationFn: () => questionBankService.submit(bankId),
    onSuccess: () => {
      toast.success("Question bank submitted for moderation");
      setSubmitOpen(false);
      invalidate();
    },
    onError: (err: AxiosError<{ errors?: Record<string, string[]>; message?: string }>) => {
      const msg = err.response?.data?.errors?.questions?.[0] ?? err.response?.data?.message ?? "Could not submit";
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !bank) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card><CardContent className="py-12 text-center text-slate-500">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          Question bank not found or you don&apos;t have access to it.
        </CardContent></Card>
      </div>
    );
  }

  const status = QUESTION_BANK_STATUS[bank.status];
  const editable = bank.is_editable;
  const questions = bank.questions ?? [];

  const openNew = () => { setEditingQuestion(null); setEditorOpen(true); };
  const openEdit = (q: Question) => { setEditingQuestion(q); setEditorOpen(true); };

  return (
    <div className="space-y-6">
      <BackLink />

      <BankHeader
        bank={bank}
        statusLabel={status.label}
        statusVariant={status.variant}
        editable={editable}
        canSubmit={questions.length > 0}
        onSubmit={() => setSubmitOpen(true)}
      />

      {bank.status === "rejected" && bank.rejection_reason && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="py-4 flex gap-3">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">Returned for revision</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{bank.rejection_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {bank.status === "approved" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="py-4 flex gap-3 items-center">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">
              This bank has been approved{bank.reviewer ? ` by ${bank.reviewer.name}` : ""} and is locked.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Questions <span className="text-slate-400 font-normal">({questions.length})</span>
        </h3>
        {editable && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        )}
      </div>

      {questions.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="text-slate-500">No questions yet.</p>
          {editable && (
            <Button className="mt-4" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add your first question
            </Button>
          )}
        </CardContent></Card>
      ) : (
        <ol className="space-y-3">
          {questions.map((q) => (
            <li key={q.id}>
              <QuestionCard
                question={q}
                editable={editable}
                onEdit={() => openEdit(q)}
                onDelete={() => setDeletingQuestion(q)}
              />
            </li>
          ))}
        </ol>
      )}

      <QuestionEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        bankId={bankId}
        question={editingQuestion}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={!!deletingQuestion}
        onOpenChange={(o) => !o && setDeletingQuestion(null)}
        title="Remove question?"
        description={<>Remove question #{deletingQuestion?.order_index} from this bank? Remaining questions will be renumbered.</>}
        confirmLabel="Remove"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deletingQuestion && deleteMutation.mutate(deletingQuestion.id)}
      />

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit for moderation?"
        description={<>Submit this bank with <strong>{questions.length} question{questions.length === 1 ? "" : "s"}</strong> to your Exam Officer for review? You won&apos;t be able to edit it while it is under review.</>}
        confirmLabel="Submit"
        loading={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
      />
    </div>
  );

  function BackLink() {
    return (
      <Link
        href="/dashboard/lecturer/question-banks"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        onClick={(e) => { e.preventDefault(); router.push("/dashboard/lecturer/question-banks"); }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to question banks
      </Link>
    );
  }
}

function BankHeader({
  bank, statusLabel, statusVariant, editable, canSubmit, onSubmit,
}: {
  bank: QuestionBank;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline";
  editable: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{bank.title || bank.course?.title || "Untitled bank"}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-mono">{bank.course?.code}</span>
              {" · "}{bank.session}
              {" · "}{SEMESTER_LABELS[bank.semester as Semester] ?? bank.semester}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {editable && (
              <Button onClick={onSubmit} disabled={!canSubmit}>
                <Send className="h-4 w-4" /> Submit for Moderation
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function QuestionCard({
  question, editable, onEdit, onDelete,
}: {
  question: Question;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5 text-slate-300">
            <GripVertical className="h-4 w-4" />
            <span className="text-xs font-semibold text-slate-400">{question.order_index}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[question.question_type]}</Badge>
              <span className="text-xs text-slate-400">{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{question.question_text}</p>

            {question.question_type !== "fill_blank" && question.options && (
              <ul className="mt-2 space-y-1">
                {question.options.map((opt) => (
                  <li key={opt.id} className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
                      opt.is_correct
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}>
                      {opt.option_label}
                    </span>
                    <span className={opt.is_correct ? "text-green-700 dark:text-green-300 font-medium" : "text-slate-600 dark:text-slate-400"}>
                      {opt.option_text}
                    </span>
                    {opt.is_correct && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </li>
                ))}
              </ul>
            )}

            {question.question_type === "fill_blank" && question.answers && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-400">Accepted:</span>
                {question.answers.map((a, i) => (
                  <Badge key={i} variant="success" className="text-xs font-normal">{a}</Badge>
                ))}
              </div>
            )}
          </div>

          {editable && (
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit question" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" aria-label="Delete question" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
