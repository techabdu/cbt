"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardTopbarProps {
  /** Page title shown in the topbar. Each page passes its own title. */
  title?: string;
}

export function DashboardTopbar({ title }: DashboardTopbarProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  return (
    <header className="fixed top-0 right-0 left-60 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
        {title ?? "Dashboard"}
      </h1>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notification bell — Phase 10 will add the unread badge + dropdown */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User info */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
              {user.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.file_number}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>
      </div>
    </header>
  );
}
