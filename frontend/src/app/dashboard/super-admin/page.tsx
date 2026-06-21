"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, GraduationCap, Shield, FileText, ArrowRight, ArrowLeftRight, FileUp, DownloadCloud, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

import { superAdminService } from "@/services/superAdmin.service";
import { cbtExamService } from "@/services/cbtExam.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

      <OfflineExchangeCard />

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

/**
 * Shown only on the OFFLINE (exam-hall) server, so whoever runs it — typically
 * the seeded Super Admin — can bring exams in and (after the exam) is pointed to
 * the exams area to export/push results, without needing a separate CBT Admin.
 */
function OfflineExchangeCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const importRef = React.useRef<HTMLInputElement>(null);
  const [pullOpen, setPullOpen] = React.useState(false);

  const { data: health } = useQuery({
    queryKey: ["server-health"],
    queryFn: () => cbtExamService.health(),
    staleTime: 5 * 60_000,
  });

  const importPkg = useMutation({
    mutationFn: (file: File) => cbtExamService.importPackage(file),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      if (res.exam?.id) router.push(`/dashboard/cbt-admin/exams/${res.exam.id}`);
    },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Could not import the exam package."),
  });

  if (!health?.offline_server) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-blue-500" /> Offline Exam Server</span>
          <Badge variant="secondary">Offline server</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Bring an exam onto this server, then students sit it on the LAN. Afterwards, open the exam under{" "}
          <Link href="/dashboard/cbt-admin/exams" className="text-blue-600 hover:underline">Manage exams</Link> to export or push results back.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => importRef.current?.click()} disabled={importPkg.isPending}>
            {importPkg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Import exam package (file)
          </Button>
          <Button variant="outline" onClick={() => setPullOpen(true)}>
            <DownloadCloud className="h-4 w-4" /> Pull from online
          </Button>
          <Button variant="ghost" onClick={() => router.push("/dashboard/cbt-admin/exams")}>
            Manage exams <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importPkg.mutate(f); e.target.value = ""; }}
        />
      </CardContent>

      <PullFromOnlineDialog open={pullOpen} onOpenChange={setPullOpen} onPulled={(id) => router.push(`/dashboard/cbt-admin/exams/${id}`)} />
    </Card>
  );
}

function PullFromOnlineDialog({
  open, onOpenChange, onPulled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPulled: (examId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [examId, setExamId] = React.useState("");

  React.useEffect(() => { if (open) setExamId(""); }, [open]);

  const mutation = useMutation({
    mutationFn: () => cbtExamService.networkPull(Number(examId)),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      onOpenChange(false);
      if (res.exam?.id) onPulled(res.exam.id);
    },
    onError: (err: AxiosError<{ message?: string }>) => toast.error(err.response?.data?.message ?? "Pull failed — could not reach the online server."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pull exam from online</DialogTitle>
          <DialogDescription>Enter the exam ID (shown on the online server&apos;s exam page). This server must be briefly online with ONLINE_SERVER_URL configured.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="sa_pull_id">Exam ID <span className="text-red-500">*</span></Label>
          <Input id="sa_pull_id" type="number" min={1} placeholder="e.g. 12" value={examId} onChange={(e) => setExamId(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!examId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pull Exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
