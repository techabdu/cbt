"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, ClipboardList, CheckSquare, Building2, ArrowRight } from "lucide-react";

import { examOfficerService } from "@/services/examOfficer.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExamOfficerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["exam-officer-stats"],
    queryFn: examOfficerService.stats,
  });

  const cards = [
    { label: "Lecturers",           value: data?.lecturers,           icon: Users,         href: "/dashboard/exam-officer/lecturers" },
    { label: "Students",            value: data?.students,            icon: GraduationCap, href: "/dashboard/exam-officer/students" },
    { label: "Courses",             value: data?.courses,             icon: ClipboardList, href: "/dashboard/exam-officer/courses" },
    { label: "Pending Moderation",  value: data?.pending_moderation,  icon: CheckSquare,   href: "/dashboard/exam-officer/moderation" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Exam Officer Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your school's staff, students, courses, and question bank moderation.</p>
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
                  Manage <ArrowRight className="h-3 w-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" /> Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>1. Create <Link href="/dashboard/exam-officer/departments" className="text-blue-600 hover:underline">Departments</Link> for your school.</p>
          <p>2. Add <Link href="/dashboard/exam-officer/lecturers" className="text-blue-600 hover:underline">Lecturers</Link> and <Link href="/dashboard/exam-officer/students" className="text-blue-600 hover:underline">Students</Link>.</p>
          <p>3. Create <Link href="/dashboard/exam-officer/courses" className="text-blue-600 hover:underline">Courses</Link> and use <Link href="/dashboard/exam-officer/assignments" className="text-blue-600 hover:underline">Assignments</Link> to link them to staff and students.</p>
        </CardContent>
      </Card>
    </div>
  );
}
