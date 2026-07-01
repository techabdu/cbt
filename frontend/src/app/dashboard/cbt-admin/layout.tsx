"use client";

import * as React from "react";

import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function CbtAdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = useRoleGuard("cbt_admin");
  if (!allowed) return null;
  return <>{children}</>;
}
