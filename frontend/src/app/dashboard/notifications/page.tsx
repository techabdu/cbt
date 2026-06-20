"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, XCircle, BarChart3, Info } from "lucide-react";

import { useNotifications } from "@/hooks/useNotifications";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All caught up"}
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <Card className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You'll receive notifications here when your question banks are moderated or results become available." />
        ) : (
          notifications.map((n) => {
            const category = n.data.category ?? "info";
            const Icon = CATEGORY_ICON[category] ?? Info;
            const unread = !n.read_at;

            const inner = (
              <div
                className={cn(
                  "flex items-start gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  unread && "border-l-2 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10"
                )}
                onClick={() => !n.read_at && markRead(n.id)}
              >
                <div className={cn("mt-0.5 shrink-0", CATEGORY_COLOR[category])}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", unread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>
                    {n.data.title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{n.data.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </div>
                {unread && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />}
              </div>
            );

            return n.data.link ? (
              <Link key={n.id} href={n.data.link} className="block cursor-pointer">{inner}</Link>
            ) : (
              <div key={n.id} className="cursor-default">{inner}</div>
            );
          })
        )}
      </Card>
    </div>
  );
}
