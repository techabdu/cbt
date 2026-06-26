"use client";

import * as React from "react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = useRoleGuard("super_admin");
  if (!allowed) return null;
  return <>{children}</>;
}
