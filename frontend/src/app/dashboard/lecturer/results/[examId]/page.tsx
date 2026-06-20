"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, BarChart3, Download, FileSpreadsheet, FileText, Users } from "lucide-react";

import { resultsService } from "@/services/results.service";
import { SEMESTER_LABELS } from "@/lib/constants";
import { getToken } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Semester } from "@/types/common.types";

const GRADE_VARIANT: Record<string, "success" | "default" | "warning" | "destructive"> = {
  A: "success", B: "success", C: "default", D: "warning", E: "warning", F: "destructive",
};

export default function ResultDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId: examIdStr } = use(params);
  const examId = Number(examIdStr);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lecturer-result", examId],
    queryFn: () => resultsService.show(examId),
  });

  const exam = data?.exam;
  const results = data?.results ?? [];

  const handleExport = async (type: "pdf" | "excel") => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/api$/, "");
    const token = getToken();
    const path = type === "pdf" ? resultsService.pdfUrl(examId) : resultsService.excelUrl(examId);
    const url = `${baseUrl}${path}`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "*/*" } });
    if (!resp.ok) { toast.error("Export failed — please try again."); return; }

    const blob = await resp.blob();
    const ext = type === "pdf" ? "pdf" : "xlsx";
    const filename = `results-${examId}.${ext}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !exam) {
    return (
      <div className="space-y-4">
        <BackLink router={router} />
        <Card><CardContent className="py-12 text-center text-slate-500">Exam not found or results not available.</CardContent></Card>
      </div>
    );
  }

  const passing = results.filter((r) => r.grade !== "F" && !r.is_absent).length;
  const avg = results.length > 0
    ? (results.reduce((sum, r) => sum + (r.is_absent ? 0 : r.percentage), 0) / results.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <BackLink router={router} />

      <PageHeader
        title={exam.course?.title ?? "Exam Results"}
        description={`${exam.course?.code ?? ""} · ${exam.session} · ${SEMESTER_LABELS[exam.semester as Semester] ?? exam.semester} · ${format(new Date(exam.exam_date), "dd MMM yyyy")}`}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="h-4 w-4 mr-2" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={String(results.length)} />
        <StatCard label="Pass Rate" value={results.length > 0 ? `${((passing / results.length) * 100).toFixed(0)}%` : "—"} />
        <StatCard label="Average %" value={`${avg}%`} />
        <StatCard label="Highest" value={results.length > 0 ? `${Math.max(...results.filter((r) => !r.is_absent).map((r) => r.percentage)).toFixed(1)}%` : "—"} />
      </div>

      {/* Results table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" /> Student Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <EmptyState icon={BarChart3} title="No results yet" description="Results will appear once synced from the offline server." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Matric No.</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-slate-400 tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{r.student?.matric_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.student?.full_name ?? "—"}</TableCell>
                    {r.is_absent ? (
                      <TableCell colSpan={4} className="text-slate-400 italic">Absent</TableCell>
                    ) : (
                      <>
                        <TableCell className="tabular-nums">{r.total_score.toFixed(1)}</TableCell>
                        <TableCell className="tabular-nums text-slate-500">{r.total_marks.toFixed(1)}</TableCell>
                        <TableCell className="tabular-nums font-medium">{r.percentage.toFixed(1)}%</TableCell>
                        <TableCell>
                          <Badge variant={GRADE_VARIANT[r.grade?.[0] ?? "F"] ?? "default"}>{r.grade ?? "—"}</Badge>
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Badge variant={r.is_absent ? "secondary" : "outline"}>{r.is_absent ? "Absent" : "Present"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function BackLink({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Link
      href="/dashboard/lecturer/results"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      onClick={(e) => { e.preventDefault(); router.push("/dashboard/lecturer/results"); }}
    >
      <ArrowLeft className="h-4 w-4" /> Back to results
    </Link>
  );
}
