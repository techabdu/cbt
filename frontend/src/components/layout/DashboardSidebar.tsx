"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  Users,
  FileText,
  CheckSquare,
  BarChart3,
} from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/common.types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  lecturer: [
    { label: "Overview",       href: "/dashboard/lecturer",                   icon: LayoutDashboard },
    { label: "Question Banks", href: "/dashboard/lecturer/question-banks",    icon: BookOpen },
    { label: "My Courses",     href: "/dashboard/lecturer/courses",           icon: ClipboardList },
    { label: "Results",        href: "/dashboard/lecturer/results",           icon: BarChart3 },
  ],
  exam_officer: [
    { label: "Overview",       href: "/dashboard/exam-officer",               icon: LayoutDashboard },
    { label: "Lecturers",      href: "/dashboard/exam-officer/lecturers",     icon: Users },
    { label: "Students",       href: "/dashboard/exam-officer/students",      icon: GraduationCap },
    { label: "Courses",        href: "/dashboard/exam-officer/courses",       icon: ClipboardList },
    { label: "Departments",    href: "/dashboard/exam-officer/departments",   icon: Building2 },
    { label: "Assignments",    href: "/dashboard/exam-officer/assignments",   icon: FileText },
    { label: "Moderation",     href: "/dashboard/exam-officer/moderation",   icon: CheckSquare },
  ],
  cbt_admin: [
    { label: "Overview",       href: "/dashboard/cbt-admin",                  icon: LayoutDashboard },
    { label: "Exams",          href: "/dashboard/cbt-admin/exams",            icon: ClipboardList },
    { label: "Question Banks", href: "/dashboard/cbt-admin/question-banks",   icon: BookOpen },
    { label: "Role Management",href: "/dashboard/cbt-admin/role-management",  icon: Shield },
    { label: "Sync Logs",      href: "/dashboard/cbt-admin/sync-logs",        icon: RefreshCw },
  ],
  super_admin: [
    { label: "Overview",       href: "/dashboard/super-admin",                icon: LayoutDashboard },
    { label: "College",        href: "/dashboard/super-admin/college",        icon: Building2 },
    { label: "Schools",        href: "/dashboard/super-admin/schools",        icon: GraduationCap },
    { label: "CBT Admins",     href: "/dashboard/super-admin/cbt-admins",    icon: Shield },
    { label: "Audit Logs",     href: "/dashboard/super-admin/audit-logs",    icon: FileText },
    { label: "System Health",  href: "/dashboard/super-admin/health",        icon: Settings },
  ],
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      window.location.href = "/login";
    }
  };

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] ?? [];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Logo / branding */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6 dark:border-slate-800">
        <GraduationCap className="h-6 w-6 text-blue-600" aria-hidden="true" />
        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">CBT Portal</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Main navigation">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === `/dashboard/${user.role.replace("_", "-")}`
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
