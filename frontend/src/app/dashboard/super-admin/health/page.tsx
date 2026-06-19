"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Server, Database, Users, Clock } from "lucide-react";
import { format } from "date-fns";

import { superAdminService } from "@/services/superAdmin.service";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SystemHealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: superAdminService.stats,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="System Health" description="Live status of the CBT platform." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">API Status</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : isError ? (
              <Badge variant="destructive">Unreachable</Badge>
            ) : (
              <span className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle2 className="h-5 w-5" /> Operational
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Server Mode</CardTitle>
            <Server className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-24" /> : (
              <Badge variant={data?.is_offline_server ? "warning" : "default"}>
                {data?.is_offline_server ? "Offline (LAN)" : "Online"}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Server Time</CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-32" /> : (
              <p className="text-sm font-medium">{data ? format(new Date(data.server_time), "dd MMM, HH:mm:ss") : "—"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-slate-400" /> Data Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="Schools" value={data?.schools} />
              <Stat label="Students" value={data?.students} />
              <Stat label="CBT Admins" value={data?.cbt_admins} />
              <Stat label="Exam Officers" value={data?.exam_officers} />
              <Stat label="Lecturers" value={data?.lecturers} />
              <Stat label="Active Users" value={data?.active_users} icon={Users} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value?: number; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value ?? 0}</p>
    </div>
  );
}
