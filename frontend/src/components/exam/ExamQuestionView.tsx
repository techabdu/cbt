"use client";

import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExamQuestion } from "@/types/studentExam.types";

/**
 * Single-question view. MCQ/True-False render large radio-style tap targets;
 * fill-in-the-blank renders a text field. Answers are reported up as the raw
 * stored value (option label, or text).
 */
export function ExamQuestionView({
  question,
  total,
  answer,
  flagged,
  onAnswer,
  onToggleFlag,
}: {
  question: ExamQuestion;
  total: number;
  answer: string | null;
  flagged: boolean;
  onAnswer: (value: string) => void;
  onToggleFlag: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">
            Question {question.position} of {total} · {question.marks} mark{question.marks === 1 ? "" : "s"}
          </p>
          <h2 className="mt-1 whitespace-pre-wrap text-lg font-semibold text-slate-900 dark:text-slate-100">
            {question.question_text}
          </h2>
        </div>
        <Button
          variant={flagged ? "default" : "outline"}
          size="sm"
          className={cn("shrink-0", flagged && "bg-amber-500 hover:bg-amber-600")}
          onClick={onToggleFlag}
        >
          <Flag className="h-4 w-4" /> {flagged ? "Flagged" : "Flag"}
        </Button>
      </div>

      {question.question_type === "fill_blank" ? (
        <div className="space-y-2">
          <label htmlFor="fb_answer" className="text-sm text-slate-500">Your answer</label>
          <Input
            id="fb_answer"
            value={answer ?? ""}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Type your answer here…"
            className="max-w-md text-base"
            autoComplete="off"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {question.options.map((opt) => {
            const selected = answer === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => onAnswer(opt.label)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                  "min-h-[3rem]",
                  selected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                )}
                aria-pressed={selected}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    selected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-slate-500 dark:border-slate-600"
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-base text-slate-800 dark:text-slate-100">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
