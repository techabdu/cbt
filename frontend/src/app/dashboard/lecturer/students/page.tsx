"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, GraduationCap } from "lucide-react";

import { lecturerStudentsService } from "@/services/lecturerStudents.service";
import { LEVEL_LABELS, LEVEL_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StudentLevel } from "@/types/common.types";

export default function LecturerStudentsPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch, levelFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["lecturer-students", page, debouncedSearch, levelFilter],
    queryFn: () => lecturerStudentsService.list({
      page,
      "filter[search]": debouncedSearch || undefined,
      "filter[level]": levelFilter || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const students = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Students"
        description="Students enrolled in the courses you teach (read-only)."
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative max-w-sm flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or matric number…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 min-w-40"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            aria-label="Filter by level"
          >
            <option value="">All Levels</option>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={debouncedSearch || levelFilter ? "No students match the filters" : "No students yet"}
            description={debouncedSearch || levelFilter ? "Try adjusting your filters." : "Students appear here once they are enrolled in your assigned courses."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Combination</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{student.matric_number}</span></TableCell>
                    <TableCell className="text-sm text-slate-500">{student.combination?.code ?? "—"}</TableCell>
                    <TableCell className="text-sm">{LEVEL_LABELS[student.level as StudentLevel] ?? student.level}</TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? "success" : "secondary"}>
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
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
