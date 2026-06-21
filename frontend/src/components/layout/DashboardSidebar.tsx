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
  CalendarDays,
  Layers,
  Eye,
  UserCog,
  Activity,
  X,
} from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/types/common.types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Officers are lecturers-with-privilege, so they get their administration nav
 * plus this Teaching group, which reuses the ordinary lecturer pages.
 */
const TEACHING_SECTION: NavSection = {
  title: "Teaching",
  items: [
    { label: "My Question Banks", href: "/dashboard/lecturer/question-banks", icon: BookOpen },
    { label: "My Courses",        href: "/dashboard/lecturer/courses",         icon: ClipboardList },
    { label: "My Students",       href: "/dashboard/lecturer/students",        icon: GraduationCap },
    { label: "My Results",        href: "/dashboard/lecturer/results",         icon: BarChart3 },
  ],
};

interface DashboardSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS: Record<Role, NavSection[]> = {
  lecturer: [
    { items: [
      { label: "Overview",       href: "/dashboard/lecturer",                   icon: LayoutDashboard },
      { label: "Question Banks", href: "/dashboard/lecturer/question-banks",    icon: BookOpen },
      { label: "My Courses",     href: "/dashboard/lecturer/courses",           icon: ClipboardList },
      { label: "Students",       href: "/dashboard/lecturer/students",          icon: GraduationCap },
      { label: "Results",        href: "/dashboard/lecturer/results",           icon: BarChart3 },
    ] },
  ],
  department_exam_officer: [
    { title: "Administration", items: [
      { label: "Overview",          href: "/dashboard/department-officer",                   icon: LayoutDashboard },
      { label: "Courses",           href: "/dashboard/department-officer/courses",           icon: ClipboardList },
      { label: "Lecturers",         href: "/dashboard/department-officer/lecturers",          icon: Users },
      { label: "Assignments",       href: "/dashboard/department-officer/assignments",        icon: FileText },
      { label: "Students",          href: "/dashboard/department-officer/students",           icon: GraduationCap },
      { label: "Lecturer Activity", href: "/dashboard/department-officer/lecturer-activity",  icon: Activity },
    ] },
    TEACHING_SECTION,
  ],
  exam_officer: [
    { title: "Administration", items: [
      { label: "Overview",            href: "/dashboard/exam-officer",                      icon: LayoutDashboard },
      { label: "Departments",         href: "/dashboard/exam-officer/departments",          icon: Building2 },
      { label: "Combinations",        href: "/dashboard/exam-officer/combinations",         icon: Layers },
      { label: "Students",            href: "/dashboard/exam-officer/students",             icon: GraduationCap },
      { label: "Department Officers", href: "/dashboard/exam-officer/department-officers",  icon: UserCog },
      { label: "Academic Calendar",   href: "/dashboard/exam-officer/academic-calendar",    icon: CalendarDays },
      { label: "Oversight",           href: "/dashboard/exam-officer/oversight",            icon: Eye },
      { label: "Moderation",          href: "/dashboard/exam-officer/moderation",           icon: CheckSquare },
    ] },
    TEACHING_SECTION,
  ],
  cbt_admin: [
    { items: [
      { label: "Overview",       href: "/dashboard/cbt-admin",                  icon: LayoutDashboard },
      { label: "Exam Officers",  href: "/dashboard/cbt-admin/exam-officers",    icon: Users },
      { label: "Exams",          href: "/dashboard/cbt-admin/exams",            icon: ClipboardList },
      { label: "Question Banks", href: "/dashboard/cbt-admin/question-banks",   icon: BookOpen },
      { label: "Role Management",href: "/dashboard/cbt-admin/role-management",  icon: Shield },
      { label: "Sync Logs",      href: "/dashboard/cbt-admin/sync-logs",        icon: RefreshCw },
    ] },
  ],
  super_admin: [
    { items: [
      { label: "Overview",       href: "/dashboard/super-admin",                icon: LayoutDashboard },
      { label: "College",        href: "/dashboard/super-admin/college",        icon: Building2 },
      { label: "Schools",        href: "/dashboard/super-admin/schools",        icon: GraduationCap },
      { label: "CBT Admins",     href: "/dashboard/super-admin/cbt-admins",    icon: Shield },
      { label: "Audit Logs",     href: "/dashboard/super-admin/audit-logs",    icon: FileText },
      { label: "System Health",  href: "/dashboard/super-admin/health",        icon: Settings },
    ] },
  ],
};

export function DashboardSidebar({ open = false, onClose }: DashboardSidebarProps) {
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

  const navSections = NAV_ITEMS[user.role] ?? [];
  const home = ROLE_HOME[user.role];

  const sidebarContent = (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Logo / branding */}
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-600" aria-hidden="true" />
          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">CBT Portal</span>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-600" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3" aria-label="Main navigation">
        {navSections.map((section, idx) => (
          <div key={section.title ?? idx} className={cn(idx > 0 && "mt-4")}>
            {section.title && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.href === home
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
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
          </div>
        ))}
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

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60">
        {sidebarContent}
      </div>

      {/* Mobile: off-canvas drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-hidden="true"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
