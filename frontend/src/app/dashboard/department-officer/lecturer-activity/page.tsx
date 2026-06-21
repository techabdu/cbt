"use client";

import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, Activity } from "lucide-react";

import { deptOfficerService } from "@/services/deptOfficer.service";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LecturerActivityPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dept-lecturer-activity", page, debouncedSearch],
    queryFn: () => deptOfficerService.lecturerActivity({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const lecturers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturer Activity"
        description="Track each lecturer's courses and question-bank progress (read-only)."
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or file number…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : lecturers.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={debouncedSearch ? `No lecturers match "${debouncedSearch}"` : "No lecturers yet"}
            description={debouncedSearch ? "Try a different search." : "Add lecturers to your department to see their activity here."}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>File Number</TableHead>
                  <TableHead className="text-center">Courses</TableHead>
                  <TableHead className="text-center">Question Banks</TableHead>
                  <TableHead className="text-center">Approved</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturers.map((lec) => (
                  <TableRow key={lec.id}>
                    <TableCell className="font-medium">{lec.name}</TableCell>
                    <TableCell><span className="font-mono text-xs">{lec.file_number}</span></TableCell>
                    <TableCell className="text-center">{lec.courses_count ?? 0}</TableCell>
                    <TableCell className="text-center">{lec.question_banks_count ?? 0}</TableCell>
                    <TableCell className="text-center">{lec.approved_banks_count ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={lec.is_active ? "success" : "secondary"}>
                        {lec.is_active ? "Active" : "Inactive"}
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
