"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Loader2, Check } from "lucide-react";
import type { AxiosError } from "axios";

import { questionBankService } from "@/services/questionBank.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Question, QuestionPayload } from "@/types/question.types";
import type { QuestionType } from "@/types/common.types";

interface OptionDraft {
  option_text: string;
  is_correct: boolean;
}

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
];

export function QuestionEditorDialog({
  open, onOpenChange, bankId, question, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bankId: number;
  question: Question | null;
  onSaved: () => void;
}) {
  const isEdit = !!question;

  const [text, setText] = React.useState("");
  const [type, setType] = React.useState<QuestionType>("mcq");
  const [marks, setMarks] = React.useState(1);
  const [options, setOptions] = React.useState<OptionDraft[]>([
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
  ]);
  const [tfAnswer, setTfAnswer] = React.useState<"true" | "false">("true");
  const [answers, setAnswers] = React.useState<string[]>([""]);
  const [error, setError] = React.useState<string | null>(null);

  // Hydrate state whenever the dialog opens (for create or edit).
  React.useEffect(() => {
    if (!open) return;
    setError(null);

    if (question) {
      setText(question.question_text);
      setType(question.question_type);
      setMarks(question.marks);

      if (question.question_type === "mcq" && question.options) {
        setOptions(question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })));
      } else {
        setOptions([{ option_text: "", is_correct: true }, { option_text: "", is_correct: false }]);
      }

      if (question.question_type === "true_false" && question.options) {
        const correct = question.options.find((o) => o.is_correct);
        setTfAnswer(correct?.option_label === "T" ? "true" : "false");
      } else {
        setTfAnswer("true");
      }

      setAnswers(question.question_type === "fill_blank" && question.answers?.length ? [...question.answers] : [""]);
    } else {
      setText("");
      setType("mcq");
      setMarks(1);
      setOptions([{ option_text: "", is_correct: true }, { option_text: "", is_correct: false }]);
      setTfAnswer("true");
      setAnswers([""]);
    }
  }, [open, question]);

  const mutation = useMutation({
    mutationFn: (payload: QuestionPayload) =>
      isEdit
        ? questionBankService.updateQuestion(bankId, question!.id, payload)
        : questionBankService.addQuestion(bankId, payload),
    onSuccess: () => {
      toast.success(isEdit ? "Question updated" : "Question added");
      onSaved();
      onOpenChange(false);
    },
    onError: (err: AxiosError<{ errors?: Record<string, string[]>; message?: string }>) => {
      const firstError = err.response?.data?.errors
        ? Object.values(err.response.data.errors)[0]?.[0]
        : undefined;
      setError(firstError ?? err.response?.data?.message ?? "Could not save question");
    },
  });

  // ── Option helpers (MCQ) ──────────────────────────────────────────────────
  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { option_text: "", is_correct: false }]);
  };
  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Ensure at least one correct remains.
      if (!next.some((o) => o.is_correct) && next.length) next[0].is_correct = true;
      return next;
    });
  };
  const setOptionText = (idx: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, option_text: value } : o)));
  const setCorrect = (idx: number) =>
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));

  // ── Answer helpers (fill blank) ───────────────────────────────────────────
  const addAnswer = () => { if (answers.length < 10) setAnswers((p) => [...p, ""]); };
  const removeAnswer = (idx: number) => { if (answers.length > 1) setAnswers((p) => p.filter((_, i) => i !== idx)); };
  const setAnswer = (idx: number, value: string) => setAnswers((p) => p.map((a, i) => (i === idx ? value : a)));

  const validate = (): QuestionPayload | null => {
    if (!text.trim()) { setError("Question text is required."); return null; }
    if (marks < 1) { setError("Marks must be at least 1."); return null; }

    if (type === "mcq") {
      const filled = options.filter((o) => o.option_text.trim());
      if (filled.length < 2) { setError("Provide at least two options."); return null; }
      if (filled.filter((o) => o.is_correct).length !== 1) { setError("Mark exactly one option as correct."); return null; }
      return { question_text: text.trim(), question_type: "mcq", marks, options: filled };
    }

    if (type === "true_false") {
      return { question_text: text.trim(), question_type: "true_false", marks, correct_answer: tfAnswer };
    }

    // fill_blank
    const cleaned = answers.map((a) => a.trim()).filter(Boolean);
    if (cleaned.length === 0) { setError("Provide at least one accepted answer."); return null; }
    return { question_text: text.trim(), question_type: "fill_blank", marks, answers: cleaned };
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = validate();
    if (payload) mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Question" : "Add Question"}</DialogTitle>
          <DialogDescription>
            Choose a type, write the prompt, and define the correct answer{type === "fill_blank" ? "(s)" : ""}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label>Question Type <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    type === t.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question text */}
          <div className="space-y-1.5">
            <Label htmlFor="q_text">Question <span className="text-red-500">*</span></Label>
            <Textarea
              id="q_text"
              rows={3}
              placeholder={type === "fill_blank" ? "Use ___ to indicate the blank, e.g. The capital of France is ___." : "Type your question…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Marks */}
          <div className="space-y-1.5 max-w-32">
            <Label htmlFor="q_marks">Marks <span className="text-red-500">*</span></Label>
            <Input
              id="q_marks"
              type="number"
              min={1}
              max={100}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
            />
          </div>

          {/* Type-specific editor */}
          {type === "mcq" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options <span className="text-red-500">*</span></Label>
                <span className="text-xs text-slate-400">Click the circle to mark the correct answer</span>
              </div>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(idx)}
                    aria-label={`Mark option ${idx + 1} correct`}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      opt.is_correct
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-slate-300 text-transparent hover:border-green-400 dark:border-slate-600"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-sm font-medium text-slate-400">{String.fromCharCode(65 + idx)}</span>
                  <Input
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={opt.option_text}
                    onChange={(e) => setOptionText(idx, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-500"
                    disabled={options.length <= 2}
                    aria-label={`Remove option ${idx + 1}`}
                    onClick={() => removeOption(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {options.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-3.5 w-3.5" /> Add Option
                </Button>
              )}
            </div>
          )}

          {type === "true_false" && (
            <div className="space-y-1.5">
              <Label>Correct Answer <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {(["true", "false"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTfAnswer(val)}
                    className={cn(
                      "rounded-md border px-4 py-3 text-sm font-medium capitalize transition-colors",
                      tfAnswer === val
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
                    )}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "fill_blank" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Accepted Answers <span className="text-red-500">*</span></Label>
                <span className="text-xs text-slate-400">Matching is case-insensitive</span>
              </div>
              {answers.map((ans, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Accepted answer ${idx + 1}`}
                    value={ans}
                    onChange={(e) => setAnswer(idx, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-500"
                    disabled={answers.length <= 1}
                    aria-label={`Remove answer ${idx + 1}`}
                    onClick={() => removeAnswer(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {answers.length < 10 && (
                <Button type="button" variant="outline" size="sm" onClick={addAnswer}>
                  <Plus className="h-3.5 w-3.5" /> Add Variant
                </Button>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">! {error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
