"use client";

import * as React from "react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function DepartmentOfficerLayout({ children }: { children: React.ReactNode }) {
  const allowed = useRoleGuard("department_exam_officer");
  if (!allowed) return null;
  return <>{children}</>;
}
