"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/AuthProvider";
import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/types/common.types";

/**
 * Client-side, defence-in-depth role gate for a dashboard section.
 *
 * The API is the real authority (it returns 403 for a role that isn't allowed
 * to touch an endpoint). This hook just stops a signed-in user from landing on
 * a section they can't use and bounces them to their own home dashboard, so the
 * UI never renders a section that would only show empty/forbidden data.
 *
 * The parent dashboard layout already handles the unauthenticated case, so this
 * only acts once a user is hydrated.
 *
 * @returns true once the current user's role is allowed (so the layout can hold
 *          rendering until the check passes).
 */
export function useRoleGuard(...allowed: Role[]): boolean {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const role = user?.role;
  const isAllowed = !!role && allowed.includes(role);

  React.useEffect(() => {
    if (isLoading || !role) return;
    if (!isAllowed) {
      router.replace(ROLE_HOME[role] ?? "/dashboard");
    }
  }, [isLoading, role, isAllowed, router]);

  return isAllowed;
}
