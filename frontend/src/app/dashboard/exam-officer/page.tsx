"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Layers, UserCog, CheckSquare, Building2, ArrowRight } from "lucide-react";

import { examOfficerService } from "@/services/examOfficer.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExamOfficerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["exam-officer-stats"],
    queryFn: examOfficerService.stats,
  });

  const cards = [
    { label: "Students",            value: data?.students,             icon: GraduationCap, href: "/dashboard/exam-officer/students" },
    { label: "Combinations",        value: data?.combinations,         icon: Layers,        href: "/dashboard/exam-officer/combinations" },
    { label: "Department Officers", value: data?.department_officers,  icon: UserCog,       href: "/dashboard/exam-officer/department-officers" },
    { label: "Pending Moderation",  value: data?.pending_moderation,   icon: CheckSquare,   href: "/dashboard/exam-officer/moderation" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">School Exam Officer Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage departments, combinations, students, department officers and question-bank moderation.</p>
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
          <p>1. Set the <Link href="/dashboard/exam-officer/academic-calendar" className="text-blue-600 hover:underline">Academic Calendar</Link> (session &amp; semester).</p>
          <p>2. Create <Link href="/dashboard/exam-officer/departments" className="text-blue-600 hover:underline">Departments</Link>, then couple them into <Link href="/dashboard/exam-officer/combinations" className="text-blue-600 hover:underline">Combinations</Link>.</p>
          <p>3. Appoint a <Link href="/dashboard/exam-officer/department-officers" className="text-blue-600 hover:underline">Department Officer</Link> for each department to manage its courses and lecturers.</p>
          <p>4. Register <Link href="/dashboard/exam-officer/students" className="text-blue-600 hover:underline">Students</Link> and assign them to a combination to auto-enrol them.</p>
        </CardContent>
      </Card>
    </div>
  );
}
