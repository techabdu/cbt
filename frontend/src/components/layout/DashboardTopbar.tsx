"use client";

import { Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface DashboardTopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export function DashboardTopbar({ title, onMenuClick }: DashboardTopbarProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-60 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
          {title ?? "Dashboard"}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        <NotificationBell />

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 ml-1">
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
