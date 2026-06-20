"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { questionBankService } from "@/services/questionBank.service";
import { LEVEL_LABELS, SEMESTER_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StudentLevel, Semester } from "@/types/common.types";

export default function LecturerCoursesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-courses"],
    queryFn: questionBankService.myCourses,
  });

  const assignments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        description="Courses you are assigned to teach. Question banks are created per course, session, and semester."
      />

      <Card className="p-4">
        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No courses assigned"
            description="Your Exam Officer has not assigned you to any courses yet. Contact them to get started."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Semester</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a, idx) => (
                <TableRow key={`${a.course.id}-${a.session}-${a.semester}-${idx}`}>
                  <TableCell className="font-medium">{a.course.title}</TableCell>
                  <TableCell><span className="font-mono text-xs">{a.course.code}</span></TableCell>
                  <TableCell className="text-sm text-slate-500">{a.course.department?.code ?? "—"}</TableCell>
                  <TableCell className="text-sm">{LEVEL_LABELS[a.course.level as StudentLevel] ?? a.course.level}</TableCell>
                  <TableCell className="text-sm font-mono">{a.session}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{SEMESTER_LABELS[a.semester as Semester] ?? a.semester}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
