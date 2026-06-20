"use client";

import { cn } from "@/lib/utils";
import type { ExamQuestion } from "@/types/studentExam.types";

/**
 * Numbered navigator: each question is answered / unanswered / flagged, and the
 * current one is ringed. Lets the student jump anywhere.
 */
export function QuestionGrid({
  questions,
  answers,
  flagged,
  current,
  onJump,
}: {
  questions: ExamQuestion[];
  answers: Record<number, string | null>;
  flagged: Set<number>;
  current: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
      {questions.map((q, i) => {
        const isAnswered = !!answers[q.id];
        const isFlagged = flagged.has(q.id);
        const isCurrent = i === current;
        return (
          <button
            key={q.id}
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged" : ""}`}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
              isCurrent && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900",
              isFlagged
                ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : isAnswered
                  ? "border-green-300 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
