"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, BookOpen, ArrowRight } from "lucide-react";
import { format } from "date-fns";

import { cbtExamService } from "@/services/cbtExam.service";
import { SEMESTER_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Semester } from "@/types/common.types";

export default function CbtQuestionBanksPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cbt-approved-banks", page, debouncedSearch],
    queryFn: () => cbtExamService.approvedBanks({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const banks = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approved Question Banks"
        description="Question banks approved by exam officers, ready to be configured into exams."
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by course title or code…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : banks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={debouncedSearch ? "No matching banks" : "No approved banks yet"}
            description={debouncedSearch ? "Try a different search." : "Approved question banks from lecturers will appear here, ready for exam setup."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell>
                      <p className="font-medium">{bank.course?.title ?? bank.title}</p>
                      <p className="font-mono text-xs text-slate-500">{bank.course?.code}</p>
                    </TableCell>
                    <TableCell className="text-sm">{bank.lecturer?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{bank.session}</TableCell>
                    <TableCell className="text-sm">{SEMESTER_LABELS[bank.semester as Semester] ?? bank.semester}</TableCell>
                    <TableCell className="text-center">{bank.total_questions}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {bank.reviewed_at ? format(new Date(bank.reviewed_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/cbt-admin/exams?bank=${bank.id}`}>
                        <Button size="sm" variant="outline">
                          Set Up Exam <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>
    </div>
  );
}
