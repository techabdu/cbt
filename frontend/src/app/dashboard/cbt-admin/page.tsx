"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, BookOpen, Shield, KeyRound, ArrowRight, RefreshCw } from "lucide-react";

import { cbtExamService } from "@/services/cbtExam.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CbtAdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cbt-admin-stats"],
    queryFn: cbtExamService.stats,
  });

  const cards = [
    { label: "Approved Banks", value: data?.approved_banks, icon: BookOpen, href: "/dashboard/cbt-admin/question-banks" },
    { label: "Scheduled Exams", value: data?.scheduled_exams, icon: ClipboardList, href: "/dashboard/cbt-admin/exams" },
    { label: "Codes Generated", value: data?.codes_generated, icon: KeyRound, href: "/dashboard/cbt-admin/exams" },
    { label: "Exam Officers", value: data?.exam_officers, icon: Shield, href: "/dashboard/cbt-admin/role-management" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">CBT Admin Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Configure exams from approved banks, generate exam codes, and manage exam officer roles.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="transition-colors group-hover:border-blue-300 dark:group-hover:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{value ?? 0}</p>}
                <span className="mt-1 flex items-center gap-1 text-xs text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400" /> Exam Setup Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>1. Browse <Link href="/dashboard/cbt-admin/question-banks" className="text-blue-600 hover:underline">approved question banks</Link> from lecturers.</p>
          <p>2. Configure an <Link href="/dashboard/cbt-admin/exams" className="text-blue-600 hover:underline">exam</Link> (date, time, duration) and generate codes for enrolled students.</p>
          <p>3. Sync the exam to the offline server (Phase 8), then pull results back (Phase 9).</p>
        </CardContent>
      </Card>
    </div>
  );
}
