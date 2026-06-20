"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardList, ArrowRight, FileEdit, Send, CheckCircle2 } from "lucide-react";

import { questionBankService } from "@/services/questionBank.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LecturerDashboardPage() {
  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ["question-banks", "summary"],
    queryFn: () => questionBankService.list({ per_page: 100 }),
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["lecturer-courses"],
    queryFn: questionBankService.myCourses,
  });

  const banks = banksData?.data ?? [];
  const draftCount = banks.filter((b) => b.status === "draft" || b.status === "rejected").length;
  const submittedCount = banks.filter((b) => b.status === "submitted" || b.status === "under_review").length;
  const approvedCount = banks.filter((b) => b.status === "approved").length;

  const cards = [
    { label: "Question Banks", value: banks.length, loading: banksLoading, icon: BookOpen, href: "/dashboard/lecturer/question-banks" },
    { label: "Assigned Courses", value: coursesData?.data.length, loading: coursesLoading, icon: ClipboardList, href: "/dashboard/lecturer/courses" },
    { label: "Awaiting Review", value: submittedCount, loading: banksLoading, icon: Send, href: "/dashboard/lecturer/question-banks" },
    { label: "Approved", value: approvedCount, loading: banksLoading, icon: CheckCircle2, href: "/dashboard/lecturer/question-banks" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lecturer Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Author question banks for your courses and submit them for moderation.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, loading, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="transition-colors group-hover:border-blue-300 dark:group-hover:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</CardTitle>
                <Icon className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold">{value ?? 0}</p>}
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
            <FileEdit className="h-4 w-4 text-slate-400" /> Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>1. Review your <Link href="/dashboard/lecturer/courses" className="text-blue-600 hover:underline">assigned courses</Link> ({draftCount > 0 ? `${draftCount} draft bank${draftCount === 1 ? "" : "s"} in progress` : "no drafts yet"}).</p>
          <p>2. Create a <Link href="/dashboard/lecturer/question-banks" className="text-blue-600 hover:underline">question bank</Link> for a course you teach.</p>
          <p>3. Add questions (multiple-choice, true/false, or fill-in-the-blank) and submit for moderation.</p>
        </CardContent>
      </Card>
    </div>
  );
}
