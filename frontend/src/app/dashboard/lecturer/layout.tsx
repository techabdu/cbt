"use client";

import * as React from "react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

// Exam officers and department exam officers are "lecturers-with-privilege" and
// reuse the lecturer Teaching pages (see DashboardSidebar TEACHING_SECTION), so
// they are allowed into this section alongside lecturers.
export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  const allowed = useRoleGuard("lecturer", "department_exam_officer", "exam_officer");
  if (!allowed) return null;
  return <>{children}</>;
}
