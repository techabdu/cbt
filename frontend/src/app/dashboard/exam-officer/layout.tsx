"use client";

import * as React from "react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function ExamOfficerLayout({ children }: { children: React.ReactNode }) {
  const allowed = useRoleGuard("exam_officer");
  if (!allowed) return null;
  return <>{children}</>;
}
