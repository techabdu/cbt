import { Users, GraduationCap, ClipboardList, CheckSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExamOfficerDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Exam Officer Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your school's staff, students, and question bank moderation.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Lecturers", icon: Users, phase: 4 },
          { label: "Students", icon: GraduationCap, phase: 4 },
          { label: "Courses", icon: ClipboardList, phase: 4 },
          { label: "Pending Moderation", icon: CheckSquare, phase: 6 },
        ].map(({ label, icon: Icon, phase }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</CardTitle>
              <Icon className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-slate-500 mt-1">Available in Phase {phase}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
