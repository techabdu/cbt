"use client";

import { Clock } from "lucide-react";

import { formatClock } from "@/hooks/useExamTimer";
import { cn } from "@/lib/utils";

/**
 * Large always-visible countdown. Turns amber under 5 minutes and red+pulsing
 * under 1 minute, per the exam UI spec.
 */
export function ExamTimer({ remaining }: { remaining: number }) {
  const warning = remaining <= 300 && remaining > 60;
  const danger = remaining <= 60;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-3xl font-bold tabular-nums",
        danger
          ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : warning
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
      )}
      role="timer"
      aria-live={danger ? "assertive" : "off"}
      aria-label={`Time remaining ${formatClock(remaining)}`}
    >
      <Clock className="h-6 w-6" aria-hidden="true" />
      {formatClock(remaining)}
    </div>
  );
}
