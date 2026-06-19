import type {
  Role,
  StudentLevel,
  Semester,
  QuestionType,
  QuestionBankStatus,
  ExamStatus,
} from "@/types/common.types";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  cbt_admin: "CBT Admin",
  exam_officer: "School Exam Officer",
  lecturer: "Lecturer",
};

/** Landing dashboard path per role. */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/dashboard/super-admin",
  cbt_admin: "/dashboard/cbt-admin",
  exam_officer: "/dashboard/exam-officer",
  lecturer: "/dashboard/lecturer",
};

export const LEVEL_LABELS: Record<StudentLevel, string> = {
  NCE_100: "100 Level",
  NCE_200: "200 Level",
  NCE_300: "300 Level",
  Spillover_I: "Spillover I",
  Spillover_II: "Spillover II",
};

export const LEVEL_OPTIONS = Object.entries(LEVEL_LABELS).map(
  ([value, label]) => ({ value: value as StudentLevel, label })
);

export const SEMESTER_LABELS: Record<Semester, string> = {
  first: "First Semester",
  second: "Second Semester",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "outline";

export const QUESTION_BANK_STATUS: Record<
  QuestionBankStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Submitted", variant: "default" },
  under_review: { label: "Under Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export const EXAM_STATUS: Record<
  ExamStatus,
  { label: string; variant: BadgeVariant }
> = {
  scheduled: { label: "Scheduled", variant: "outline" },
  synced: { label: "Synced to Offline", variant: "secondary" },
  ongoing: { label: "Ongoing", variant: "warning" },
  completed: { label: "Completed", variant: "default" },
  results_synced: { label: "Results Synced", variant: "success" },
};

/** Polling interval for the in-app notification bell (60s, per design). */
export const NOTIFICATION_POLL_MS = 60_000;
