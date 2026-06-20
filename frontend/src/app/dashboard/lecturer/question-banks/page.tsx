"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, BookOpen, Eye } from "lucide-react";
import type { AxiosError } from "axios";

import { questionBankService, type CreateBankPayload } from "@/services/questionBank.service";
import { QUESTION_BANK_STATUS, SEMESTER_LABELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { QuestionBank } from "@/types/question.types";
import type { Semester } from "@/types/common.types";

export default function QuestionBanksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<QuestionBank | null>(null);

  React.useEffect(() => setPage(1), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["question-banks", page, debouncedSearch],
    queryFn: () => questionBankService.list({ page, "filter[search]": debouncedSearch || undefined }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => questionBankService.remove(id),
    onSuccess: () => {
      toast.success("Question bank deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["question-banks"] });
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not delete question bank");
    },
  });

  const banks = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Banks"
        description="Create and manage question banks for the courses you teach."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New Question Bank
          </Button>
        }
      />

      <Card className="p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by title or course…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : banks.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={debouncedSearch ? `No banks match "${debouncedSearch}"` : "No question banks yet"}
            description={debouncedSearch ? "Try a different search." : "Create your first question bank for a course you teach."}
            action={!debouncedSearch && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Question Bank
              </Button>
            )}
          />
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title / Course</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => {
                  const status = QUESTION_BANK_STATUS[bank.status];
                  return (
                    <TableRow
                      key={bank.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/lecturer/question-banks/${bank.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium">{bank.title || bank.course?.title || "Untitled bank"}</p>
                        <p className="text-xs text-slate-500 font-mono">{bank.course?.code}</p>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{bank.session}</TableCell>
                      <TableCell className="text-sm">{SEMESTER_LABELS[bank.semester as Semester] ?? bank.semester}</TableCell>
                      <TableCell className="text-center">{bank.total_questions}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {bank.updated_at ? format(new Date(bank.updated_at), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Bank actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/lecturer/question-banks/${bank.id}`)}>
                              {bank.is_editable ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              {bank.is_editable ? "Edit" : "View"}
                            </DropdownMenuItem>
                            {bank.is_editable && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(bank)}>
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {data && <Pagination meta={data.meta} onPageChange={setPage} />}
          </div>
        )}
      </Card>

      <CreateBankDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/dashboard/lecturer/question-banks/${id}`)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete question bank?"
        description={<>Permanently delete <strong>{deleting?.title || deleting?.course?.title}</strong> and all its questions? This cannot be undone.</>}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

interface CreateBankForm {
  assignment: string; // "courseId|session|semester"
  title: string;
}

function CreateBankDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["lecturer-courses"],
    queryFn: questionBankService.myCourses,
    enabled: open,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateBankForm>();

  React.useEffect(() => {
    if (open) reset({ assignment: "", title: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (payload: CreateBankPayload) => questionBankService.create(payload),
    onSuccess: (res) => {
      toast.success("Question bank created");
      onOpenChange(false);
      onCreated(res.data.id);
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "Could not create question bank");
    },
  });

  const assignments = coursesData?.data ?? [];

  const onSubmit = (form: CreateBankForm) => {
    const [courseId, session, semester] = form.assignment.split("|");
    mutation.mutate({
      course_id: Number(courseId),
      session,
      semester,
      title: form.title || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Question Bank</DialogTitle>
          <DialogDescription>Pick a course you teach and give the bank an optional title.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses assigned"
            description="You need at least one assigned course before you can create a question bank."
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="qb_assignment">Course <span className="text-red-500">*</span></Label>
              <select
                id="qb_assignment"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                {...register("assignment", { required: "Select a course" })}
              >
                <option value="">Select course / session / semester…</option>
                {assignments.map((a, idx) => (
                  <option
                    key={`${a.course.id}-${a.session}-${a.semester}-${idx}`}
                    value={`${a.course.id}|${a.session}|${a.semester}`}
                  >
                    {a.course.code} — {a.course.title} ({a.session}, {SEMESTER_LABELS[a.semester as Semester] ?? a.semester})
                  </option>
                ))}
              </select>
              {errors.assignment && <p className="text-sm text-red-600">! {errors.assignment.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qb_title">Title</Label>
              <Input id="qb_title" placeholder="e.g. First CA, Final Exam (optional)" {...register("title")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create &amp; Add Questions
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
