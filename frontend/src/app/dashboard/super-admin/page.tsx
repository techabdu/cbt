"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, Shield, FileText, ArrowRight } from "lucide-react";

import { superAdminService } from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: superAdminService.stats,
  });

  const cards = [
    { label: "Schools", value: data?.schools, icon: Building2, href: "/dashboard/super-admin/schools" },
    { label: "Students", value: data?.students, icon: GraduationCap, href: "/dashboard/super-admin/schools" },
    { label: "CBT Admins", value: data?.cbt_admins, icon: Shield, href: "/dashboard/super-admin/cbt-admins" },
    { label: "Active Users", value: data?.active_users, icon: FileText, href: "/dashboard/super-admin/audit-logs" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Super Admin Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage the college, schools, CBT Admin accounts, and system health.</p>
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
          <CardTitle className="text-base">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>1. Configure your <Link href="/dashboard/super-admin/college" className="text-blue-600 hover:underline">College settings</Link>.</p>
          <p>2. Create <Link href="/dashboard/super-admin/schools" className="text-blue-600 hover:underline">Schools</Link> (faculties).</p>
          <p>3. Add <Link href="/dashboard/super-admin/cbt-admins" className="text-blue-600 hover:underline">CBT Admins</Link> to run exams.</p>
        </CardContent>
      </Card>
    </div>
  );
}
