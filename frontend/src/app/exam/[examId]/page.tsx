"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Send, CheckCircle2, Wifi, WifiOff, AlertTriangle } from "lucide-react";

import { examService, examToken } from "@/services/examClient";
import { useExamTimer } from "@/hooks/useExamTimer";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionGrid } from "@/components/exam/QuestionGrid";
import { ExamQuestionView } from "@/components/exam/ExamQuestionView";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExamLoginResponse } from "@/types/studentExam.types";

const ANSWERS_KEY = "cbt_exam_answers";
const FLAGS_KEY = "cbt_exam_flags";

export default function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  use(params); // examId is implied by the session token; unwrap to satisfy the route
  const router = useRouter();

  const [data, setData] = React.useState<ExamLoginResponse | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<number, string | null>>({});
  const [flagged, setFlagged] = React.useState<Set<number>>(new Set());
  const [current, setCurrent] = React.useState(0);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<number>(Date.now());

  const saveTimers = React.useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Question ids whose local edits are not yet confirmed saved on the server.
  const dirty = React.useRef<Set<number>>(new Set());
  // Always-current snapshot of answers so autosave never reads a stale closure.
  const answersRef = React.useRef(answers);

  // ── Bootstrap: prefer instant boot data, then confirm with the server ──────
  React.useEffect(() => {
    if (!examToken.get()) {
      router.replace("/exam/login");
      return;
    }

    const boot = sessionStorage.getItem("cbt_exam_boot");
    if (boot) {
      try { hydrate(JSON.parse(boot)); } catch { /* ignore */ }
    }

    examService.resume()
      .then((fresh) => hydrate(fresh))
      .catch(() => {
        if (!boot) setLoadError(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrate(payload: ExamLoginResponse) {
    setData(payload);
    // Merge server-saved answers with any local backup (local wins for unsynced edits).
    const localAnswers = readJson<Record<number, string | null>>(ANSWERS_KEY) ?? {};
    setAnswers((prev) => ({ ...payload.saved_answers, ...localAnswers, ...prev }));
    const localFlags = readJson<number[]>(FLAGS_KEY) ?? [];
    if (localFlags.length) setFlagged(new Set(localFlags));
    if (payload.session.submitted_at) setSubmitted(true);
  }

  // ── Persist locally for crash/F5 resilience ────────────────────────────────
  React.useEffect(() => {
    answersRef.current = answers;
    if (data) sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  }, [answers, data]);
  React.useEffect(() => {
    if (data) sessionStorage.setItem(FLAGS_KEY, JSON.stringify([...flagged]));
  }, [flagged, data]);

  // ── Warn before accidental navigation ──────────────────────────────────────
  React.useEffect(() => {
    if (submitted) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitted]);

  // ── Periodic bulk autosave (every 60s) — only changed answers ──────────────
  // bulkSave reads refs (not state) so it's stable and the interval isn't torn
  // down and rebuilt on every keystroke.
  const bulkSave = React.useCallback(async () => {
    const ids = [...dirty.current];
    if (!ids.length) return;
    // Snapshot what we send so we only clear the dirty flag for ids that haven't
    // changed again while the request was in flight (no lost updates).
    const sent = ids.map((qid) => [qid, answersRef.current[qid] ?? null] as const);
    try {
      await examService.autosave(sent.map(([question_id, answer]) => ({ question_id, answer })));
      sent.forEach(([id, val]) => {
        if ((answersRef.current[id] ?? null) === val) dirty.current.delete(id);
      });
      setLastSaved(Date.now());
    } catch { /* LAN hiccup — keep them dirty, retry next cycle */ }
  }, []);

  React.useEffect(() => {
    if (!data || submitted) return;
    const id = setInterval(() => { void bulkSave(); }, 60_000);
    return () => clearInterval(id);
  }, [data, submitted, bulkSave]);

  const setAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    dirty.current.add(questionId);
    // Debounced single-answer save.
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(async () => {
      try {
        await examService.answer(questionId, value);
        dirty.current.delete(questionId);
        setLastSaved(Date.now());
      } catch { /* stays dirty — re-sent by the next bulk autosave */ }
    }, 700);
  };

  const toggleFlag = (questionId: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  };

  const doSubmit = React.useCallback(async (auto: boolean) => {
    setSubmitting(true);
    try {
      await bulkSave().catch(() => {});
      await examService.submit(auto);
      sessionStorage.removeItem(ANSWERS_KEY);
      sessionStorage.removeItem(FLAGS_KEY);
      sessionStorage.removeItem("cbt_exam_boot");
      examToken.clear();
      setSubmitted(true);
    } catch {
      setSubmitting(false);
    }
  }, [bulkSave]);

  const onExpire = React.useCallback(() => { void doSubmit(true); }, [doSubmit]);

  // ── Render states ──────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Centered>
        <WifiOff className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-lg font-semibold">Could not load your exam</p>
        <p className="mt-1 text-sm text-slate-400">Your session may have expired.</p>
        <Button className="mt-4" onClick={() => router.replace("/exam/login")}>Back to login</Button>
      </Centered>
    );
  }

  if (submitted) {
    return (
      <Centered>
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <p className="mt-4 text-2xl font-bold text-white">Exam submitted</p>
        <p className="mt-2 text-sm text-slate-400">Your answers have been recorded. You may now leave the exam hall.</p>
        <Button className="mt-6" onClick={() => router.replace("/exam/login")}>Done</Button>
      </Centered>
    );
  }

  if (!data) {
    return <Centered><Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" /><p className="mt-3 text-sm text-slate-400">Loading your exam…</p></Centered>;
  }

  const questions = data.questions;
  const q = questions[current];
  const answeredCount = questions.filter((x) => !!answers[x.id]).length;
  const unanswered = questions.length - answeredCount;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <TimerHeader
        endsAt={data.session.ends_at}
        serverTime={data.session.server_time}
        onExpire={onExpire}
        student={data.student.full_name}
        lastSaved={lastSaved}
      />

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 lg:grid-cols-[1fr_280px]">
        {/* Question panel */}
        <div className="flex flex-col">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <ExamQuestionView
              question={q}
              total={questions.length}
              answer={answers[q.id] ?? null}
              flagged={flagged.has(q.id)}
              onAnswer={(v) => setAnswer(q.id, v)}
              onToggleFlag={() => toggleFlag(q.id)}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-slate-500">{current + 1} / {questions.length}</span>
            {current === questions.length - 1 ? (
              <Button onClick={() => setSubmitOpen(true)} className={cn(unanswered === 0 ? "" : "bg-slate-600 hover:bg-slate-700")}>
                <Send className="h-4 w-4" /> Submit
              </Button>
            ) : (
              <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Navigator panel */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Questions</p>
              <p className="text-xs text-slate-500">{answeredCount}/{questions.length} answered</p>
            </div>
            <QuestionGrid
              questions={questions}
              answers={answers}
              flagged={flagged}
              current={current}
              onJump={setCurrent}
            />
            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              <Legend className="bg-green-100 dark:bg-green-950" label="Answered" />
              <Legend className="bg-amber-100 dark:bg-amber-950" label="Flagged for review" />
              <Legend className="border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" label="Not answered" />
            </div>
          </div>

          <Button className="w-full" variant="outline" onClick={() => setSubmitOpen(true)}>
            <Send className="h-4 w-4" /> Submit Exam
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit your exam?"
        description={
          <>
            You have answered <strong>{answeredCount}</strong> of {questions.length} questions.
            {unanswered > 0 && <> <strong className="text-amber-600">{unanswered}</strong> remain unanswered.</>}
            {" "}Once submitted you cannot make changes.
          </>
        }
        confirmLabel="Submit Now"
        loading={submitting}
        onConfirm={() => doSubmit(false)}
      />
    </div>
  );
}

function TimerHeader({
  endsAt, serverTime, onExpire, student, lastSaved,
}: {
  endsAt: string;
  serverTime: string;
  onExpire: () => void;
  student: string;
  lastSaved: number;
}) {
  const remaining = useExamTimer(endsAt, serverTime, onExpire);
  const [stale, setStale] = React.useState(false);

  // Resilience indicator: amber if the last successful save was > 90s ago.
  React.useEffect(() => {
    const id = setInterval(() => setStale(Date.now() - lastSaved > 90_000), 5_000);
    return () => clearInterval(id);
  }, [lastSaved]);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{student}</p>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            {stale ? <><WifiOff className="h-3 w-3 text-amber-500" /> Saving delayed…</> : <><Wifi className="h-3 w-3 text-green-500" /> Saved</>}
          </p>
        </div>
        <ExamTimer remaining={remaining} />
      </div>
      {remaining <= 60 && (
        <div className="flex items-center justify-center gap-2 bg-red-600 py-1.5 text-sm font-medium text-white">
          <AlertTriangle className="h-4 w-4" /> Less than 1 minute left — your exam will submit automatically.
        </div>
      )}
    </header>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("inline-block h-4 w-4 rounded", className)} />
      {label}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="text-center">{children}</div>
    </div>
  );
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
