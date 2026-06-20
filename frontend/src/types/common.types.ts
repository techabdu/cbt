export type Role =
  | "super_admin"
  | "cbt_admin"
  | "exam_officer"
  | "department_exam_officer"
  | "lecturer";

export type StudentLevel =
  | "NCE_100"
  | "NCE_200"
  | "NCE_300"
  | "Spillover_I"
  | "Spillover_II";

export type Semester = "first" | "second";

export type QuestionType = "mcq" | "true_false" | "fill_blank";

export type QuestionBankStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export type ExamStatus =
  | "scheduled"
  | "synced"
  | "ongoing"
  | "completed"
  | "results_synced";

/** Laravel paginator envelope (length-aware). */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

/** Common query params for list endpoints (search/sort/paginate). */
export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  [key: string]: string | number | undefined;
}
