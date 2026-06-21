"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Eye } from "lucide-react";

import { examOfficerService } from "@/services/examOfficer.service";
import { departmentService } from "@/services/department.service";
import { LEVEL_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StudentLevel } from "@/types/common.types";

type Tab = "courses" | "lecturers";

export default function OversightPage() {
  const [tab, setTab] = React.useState<Tab>("courses");
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => { setPage(1); }, [debouncedSearch, deptFilter, tab]);
  React.useEffect(() => { setSearch(""); setDeptFilter(""); }, [tab]);

  const { data: deptData } = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => departmentService.list({ per_page: 100 }),
    staleTime: 60_000,
  });

  const params = {
    page,
    "filter[search]": debouncedSearch || undefined,
    "filter[department_id]": deptFilter || undefined,
  };

  const coursesQuery = useQuery({
    queryKey: ["oversight-courses", params],
    queryFn: () => examOfficerService.oversightCourses(params),
    placeholderData: keepPreviousData,
    enabled: tab === "courses",
  });

  const lecturersQuery = useQuery({
    queryKey: ["oversight-lecturers", params],
    queryFn: () => examOfficerService.oversightLecturers(params),
    placeholderData: keepPreviousData,
    enabled: tab === "lecturers",
  });

  const departments = deptData?.data ?? [];
  const active = tab === "courses" ? coursesQuery : lecturersQuery;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oversight"
        description="Read-only view of courses and lecturers across every department in your school."
      />

      <div className="flex gap-2">
        <Button variant={tab === "courses" ? "default" : "outline"} size="sm" onClick={() => setTab("courses")}>Courses</Button>
        <Button variant={tab === "lecturers" ? "default" : "outline"} size="sm" onClick={() => setTab("lecturers")}>Lecturers</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative max-w-sm flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={tab === "courses" ? "Search by title or code…" : "Search by name or file number…"}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 min-w-40"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>

        {active.isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : tab === "courses" ? (
          (coursesQuery.data?.data ?? []).length === 0 ? (
            <EmptyState icon={Eye} title="No courses found" description="Adjust your filters to see courses." />
          ) : (
            <div className={cn(coursesQuery.isFetching && "opacity-60 transition-opacity")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-center">Lecturers</TableHead>
                    <TableHead className="text-center">Students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(coursesQuery.data?.data ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell><span className="font-mono text-xs">{c.code}</span></TableCell>
                      <TableCell className="text-sm text-slate-500">{c.department?.code ?? "—"}</TableCell>
                      <TableCell className="text-sm">{LEVEL_LABELS[c.level as StudentLevel] ?? c.level}</TableCell>
                      <TableCell className="text-center">{c.lecturers_count ?? 0}</TableCell>
                      <TableCell className="text-center">{c.students_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {coursesQuery.data && <Pagination meta={coursesQuery.data.meta} onPageChange={setPage} />}
            </div>
          )
        ) : (
          (lecturersQuery.data?.data ?? []).length === 0 ? (
            <EmptyState icon={Eye} title="No lecturers found" description="Adjust your filters to see lecturers." />
          ) : (
            <div className={cn(lecturersQuery.isFetching && "opacity-60 transition-opacity")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>File Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lecturersQuery.data?.data ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell><span className="font-mono text-xs">{l.file_number}</span></TableCell>
                      <TableCell className="text-sm text-slate-500">{l.department?.code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.is_active ? "success" : "secondary"}>
                          {l.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {lecturersQuery.data && <Pagination meta={lecturersQuery.data.meta} onPageChange={setPage} />}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
