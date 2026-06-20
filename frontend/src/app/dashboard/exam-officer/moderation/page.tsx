"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, CheckSquare, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { moderationService } from "@/services/moderation.service";
import { QUESTION_BANK_STATUS, SEMESTER_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { QuestionBankStatus, Semester } from "@/types/common.types";

const FILTERS: { label: string; value: string }[] = [
  { label: "Awaiting Review", value: "queue" },
  { label: "Approved", value: "approved" },
  { label: "Returned", value: "rejected" },
  { label: "All", value: "" },
];

export default function ModerationPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState("queue");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch, tab]);

  // "queue" is a virtual tab covering submitted + under_review; the rest map to a
  // single status filter. We fetch and then, for the queue, filter client-side
  // to the two in-flight states.
  const statusFilter = tab === "queue" || tab === "" ? undefined : tab;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["moderation", page, debouncedSearch, statusFilter],
    queryFn: () => moderationService.list({
      page,
      "filter[search]": debouncedSearch || undefined,
      "filter[status]": statusFilter,
      sort: tab === "queue" ? "submitted_at" : "-reviewed_at",
    }),
    placeholderData: keepPreviousData,
  });

  const allBanks = data?.data ?? [];
  const banks = tab === "queue"
    ? allBanks.filter((b) => b.status === "submitted" || b.status === "under_review")
    : allBanks;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation"
        description="Review question banks submitted by lecturers in your school, then approve or return them."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTab(f.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === f.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by course, code or lecturer…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : banks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={tab === "queue" ? "Nothing awaiting review" : debouncedSearch ? "No matches" : "No banks here"}
            description={tab === "queue" ? "Submitted question banks from your lecturers will appear here." : "Try a different filter or search."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course / Bank</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => {
                  const status = QUESTION_BANK_STATUS[bank.status as QuestionBankStatus];
                  return (
                    <TableRow
                      key={bank.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/exam-officer/moderation/${bank.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium">{bank.course?.title ?? bank.title ?? "Untitled"}</p>
                        <p className="font-mono text-xs text-slate-500">{bank.course?.code}{bank.title ? ` · ${bank.title}` : ""}</p>
                      </TableCell>
                      <TableCell className="text-sm">{bank.lecturer?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{SEMESTER_LABELS[bank.semester as Semester] ?? bank.semester}</TableCell>
                      <TableCell className="text-center">{bank.total_questions}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {bank.submitted_at ? formatDistanceToNow(new Date(bank.submitted_at), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {data && tab !== "queue" && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>
    </div>
  );
}
