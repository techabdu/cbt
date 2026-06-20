"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/AuthProvider";
import { ROLE_HOME } from "@/lib/constants";

export default function DashboardRootPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [user, router]);

  return null;
}
