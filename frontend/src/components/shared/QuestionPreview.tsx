"use client";

import { CheckCircle2 } from "lucide-react";

import { QUESTION_TYPE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/question.types";

/**
 * Read-only rendering of a single question, showing the correct option(s) or
 * accepted answers. Shared by the lecturer preview and the moderation review.
 */
export function QuestionPreview({ question }: { question: Question }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800">
            {question.order_index}
          </span>

          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[question.question_type]}</Badge>
              <span className="text-xs text-slate-400">{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm font-medium text-slate-900 dark:text-slate-100">{question.question_text}</p>

            {question.question_type !== "fill_blank" && question.options && (
              <ul className="mt-2 space-y-1">
                {question.options.map((opt) => (
                  <li key={opt.id} className="flex items-center gap-2 text-sm">
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                      opt.is_correct
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    )}>
                      {opt.option_label}
                    </span>
                    <span className={opt.is_correct ? "font-medium text-green-700 dark:text-green-300" : "text-slate-600 dark:text-slate-400"}>
                      {opt.option_text}
                    </span>
                    {opt.is_correct && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </li>
                ))}
              </ul>
            )}

            {question.question_type === "fill_blank" && question.answers && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Accepted:</span>
                {question.answers.map((a, i) => (
                  <Badge key={i} variant="success" className="text-xs font-normal">{a}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
