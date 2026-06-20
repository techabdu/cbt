"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, Calendar, ChevronRight } from "lucide-react";

import { resultsService } from "@/services/results.service";
import { EXAM_STATUS, SEMESTER_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Semester } from "@/types/common.types";

export default function LecturerResultsPage() {
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-results", page],
    queryFn: () => resultsService.list({ page }),
    placeholderData: keepPreviousData,
  });

  const exams = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Exam Results" description="Results for exams on your courses that have been synced from the offline server." />

      <Card className="p-4">
        {isLoading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No results yet"
            description="Results will appear here once the CBT Admin pulls them from the offline server after an exam."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {exams.map((exam) => {
              const status = EXAM_STATUS[exam.status];
              return (
                <Link
                  key={exam.id}
                  href={`/dashboard/lecturer/results/${exam.id}`}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-4 px-4 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{exam.course?.title ?? `Exam #${exam.id}`}</p>
                      <span className="text-xs text-slate-400 font-mono">{exam.course?.code}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(exam.exam_date), "dd MMM yyyy")}</span>
                      <span>{exam.session} · {SEMESTER_LABELS[exam.semester as Semester] ?? exam.semester}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
