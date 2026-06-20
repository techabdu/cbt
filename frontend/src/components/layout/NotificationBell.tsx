"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, XCircle, BarChart3, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  approved: CheckCircle2,
  rejected: XCircle,
  results: BarChart3,
  info: Info,
};

const CATEGORY_COLOR: Record<string, string> = {
  approved: "text-green-600 dark:text-green-400",
  rejected: "text-red-500 dark:text-red-400",
  results: "text-blue-600 dark:text-blue-400",
  info: "text-slate-500",
};

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const handleClick = (id: string, link?: string) => {
    markRead(id);
    if (link) router.push(link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`} className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No notifications yet</p>
          ) : (
            notifications.slice(0, 10).map((n) => {
              const category = n.data.category ?? "info";
              const Icon = CATEGORY_ICON[category] ?? Info;
              const unread = !n.read_at;

              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.data.link)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/50 last:border-0",
                    unread && "border-l-2 border-l-blue-500"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", CATEGORY_COLOR[category])} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm truncate", unread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>
                      {n.data.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.data.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="px-4 py-2">
          <Link href="/dashboard/notifications" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
