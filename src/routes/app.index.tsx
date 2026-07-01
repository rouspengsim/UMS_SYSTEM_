import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader, StatCard, SectionCard, StatusPill, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  Users,
  GraduationCap,
  School,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  BookOpen,
  Percent,
  ClipboardList,
  Wallet,
  Bell,
  CalendarDays,
  UserCheck,
  ArrowRight,
  Clock3,
  MapPin,
  CircleCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pageTitle } from "@/lib/brand";
import { decodeNotificationContent } from "@/lib/notification-content";
import { decodeTimetableCell } from "@/lib/timetable-cell";
import { findTeacherClassScope } from "@/lib/teacher-scope";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
  component: Dashboard,
});

const pieColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function emptyRecentDays() {
  const days: Record<string, { day: string; present: number; absent: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days[key] = {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      present: 0,
      absent: 0,
    };
  }
  return days;
}

function Dashboard() {
  const { t } = useI18n();
  const { user, profile, primaryRole, isDemo } = useAuth();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", isDemo ? "demo" : "remote"],
    enabled: primaryRole !== "student",
    queryFn: async () => {
      if (isDemo) {
        const students = readDemoList<{ id: string }>("studentsphere.demo.students");
        const teachers = readDemoList<{ id: string }>("studentsphere.demo.teachers");
        const classes = readDemoList<{ id: string }>("studentsphere.demo.classes");
        const payments = readDemoList<{
          amount: number;
          status: string;
          paid_date: string | null;
          due_date: string | null;
        }>("studentsphere.demo.payments");
        const paidRows = payments.filter((p) => p.status === "paid");
        const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
        const months: Record<string, number> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months[d.toLocaleString(undefined, { month: "short" })] = 0;
        }
        paidRows.forEach((p) => {
          const d = new Date(p.paid_date ?? p.due_date ?? new Date());
          const key = d.toLocaleString(undefined, { month: "short" });
          if (key in months) months[key] += Number(p.amount ?? 0);
        });
        return {
          students: students.length,
          teachers: teachers.length,
          classes: classes.length,
          revenue: totalRevenue,
          revenueTrend: Object.entries(months).map(([month, revenue]) => ({ month, revenue })),
        };
      }

      const [students, teachers, classes, payments] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount,status,paid_date,created_at"),
      ]);

      const paidRows = (payments.data ?? []).filter((p) => p.status === "paid");
      const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

      // 6-month revenue trend
      const months: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString(undefined, { month: "short" });
        months[key] = 0;
      }
      paidRows.forEach((p) => {
        const d = p.paid_date ? new Date(p.paid_date) : new Date(p.created_at);
        const key = d.toLocaleString(undefined, { month: "short" });
        if (key in months) months[key] += Number(p.amount ?? 0);
      });
      const revenueTrend = Object.entries(months).map(([month, revenue]) => ({ month, revenue }));

      return {
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        revenue: totalRevenue,
        revenueTrend,
      };
    },
  });

  const { data: attendanceTrend = [] } = useQuery({
    queryKey: ["dashboard-attendance", isDemo ? "demo" : "remote"],
    enabled: primaryRole !== "student",
    queryFn: async () => {
      if (isDemo) {
        const days = emptyRecentDays();
        readDemoList<{ date: string; status: string }>("studentsphere.demo.attendance").forEach(
          (r) => {
            if (days[r.date]) {
              if (r.status === "present" || r.status === "late") days[r.date].present += 1;
              else days[r.date].absent += 1;
            }
          },
        );
        return Object.values(days);
      }

      const since = new Date();
      since.setDate(since.getDate() - 6);
      const { data } = await supabase
        .from("attendance")
        .select("date,status")
        .gte("date", since.toISOString().slice(0, 10));
      const days: Record<string, { day: string; present: number; absent: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days[key] = {
          day: d.toLocaleDateString(undefined, { weekday: "short" }),
          present: 0,
          absent: 0,
        };
      }
      (data ?? []).forEach((r) => {
        const k = r.date;
        if (days[k]) {
          if (r.status === "present" || r.status === "late") days[k].present += 1;
          else days[k].absent += 1;
        }
      });
      return Object.values(days);
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["dashboard-subjects", isDemo ? "demo" : "remote"],
    enabled: primaryRole !== "student",
    queryFn: async () => {
      if (isDemo) {
        const counts: Record<string, number> = {};
        readDemoList<{ subject_code: string }>("studentsphere.demo.classes").forEach((c) => {
          counts[c.subject_code] = (counts[c.subject_code] ?? 0) + 1;
        });
        return Object.entries(counts)
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }));
      }

      const { data } = await supabase.from("classes").select("subject_code");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((c) => {
        counts[c.subject_code] = (counts[c.subject_code] ?? 0) + 1;
      });
      return Object.entries(counts)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));
    },
  });

  const { data: recentStudents = [] } = useQuery({
    queryKey: ["dashboard-recent-students", isDemo ? "demo" : "remote"],
    enabled: primaryRole !== "student",
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<{
          id: string;
          full_name: string;
          full_name_en?: string | null;
          student_code: string;
          status: "active" | "inactive" | "graduated" | "suspended";
        }>("studentsphere.demo.students")
          .slice(0, 5)
          .map((s) => ({ ...s, full_name: s.full_name_en || s.full_name }));
      }

      const { data } = await supabase
        .from("students")
        .select("id,full_name,student_code,status,avatar_url")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["dashboard-recent-payments", isDemo ? "demo" : "remote"],
    enabled: primaryRole !== "student",
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<{
          id: string;
          amount: number;
          status: "pending" | "paid" | "overdue" | "cancelled";
          method: string | null;
          paid_date: string | null;
          due_date: string | null;
          students: { full_name: string } | null;
        }>("studentsphere.demo.payments")
          .slice(0, 5)
          .map((p) => ({ ...p, created_at: p.due_date ?? new Date().toISOString() }));
      }

      const { data } = await supabase
        .from("payments")
        .select("id,amount,status,method,paid_date,created_at,students(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (primaryRole === "student") {
    return <StudentDashboard userId={user?.id ?? ""} userEmail={user?.email ?? ""} />;
  }

  if (primaryRole === "teacher") {
    return <TeacherDashboard userId={user?.id ?? ""} userEmail={user?.email ?? ""} />;
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Friend";

  return (
    <div>
      <PageHeader
        title={
          <>
            {t("good_morning")}, <span className="text-primary">{firstName}</span> 👋
          </>
        }
        subtitle={`${today} · ${t("signed_in_as")} ${primaryRole ? t(primaryRole) : "user"}`}
        actions={
          <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted">
            <ArrowUpRight className="h-4 w-4" /> {t("export")}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("total_students")}
          value={isLoading ? "…" : (stats?.students ?? 0)}
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label={t("total_teachers")}
          value={isLoading ? "…" : (stats?.teachers ?? 0)}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label={t("active_classes")}
          value={isLoading ? "…" : (stats?.classes ?? 0)}
          icon={<School className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t("revenue")}
          value={isLoading ? "…" : `$${(stats?.revenue ?? 0).toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title={t("revenue")} className="lg:col-span-2">
          <div className="h-64">
            {(stats?.revenueTrend?.length ?? 0) === 0 ? (
              <EmptyChart label={t("no_revenue_yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.revenueTrend ?? []}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t("subjects_mix")}>
          <div className="h-64">
            {subjects.length === 0 ? (
              <EmptyChart label={t("no_classes_yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjects}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {subjects.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title={t("attendance_today")} className="lg:col-span-2">
          <div className="h-56">
            {attendanceTrend.every((d) => d.present === 0 && d.absent === 0) ? (
              <EmptyChart label={t("no_attendance_recorded_yet")} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceTrend} barCategoryGap={20}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="present" stackId="a" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="absent" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={t("new_students")}
          action={
            <a href="/app/students" className="text-xs font-semibold text-primary hover:underline">
              {t("view_all")}
            </a>
          }
        >
          {recentStudents.length === 0 ? (
            <EmptyState label={t("no_student_records")} />
          ) : (
            <ul className="space-y-3">
              {recentStudents.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Avatar name={s.full_name} src={s.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.student_code}</p>
                  </div>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("latest_payments")}
          action={
            <a href="/app/payments" className="text-xs font-semibold text-primary hover:underline">
              {t("view_all")}
            </a>
          }
        >
          {recentPayments.length === 0 ? (
            <EmptyState label={t("no_payments_recorded")} />
          ) : (
            <ul className="divide-y divide-border">
              {recentPayments.map((p) => {
                const studentName =
                  (p as { students?: { full_name: string } | null }).students?.full_name ??
                  t("student");
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-semibold">{studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.method ?? "—"} · {(p.paid_date ?? p.created_at).slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${Number(p.amount).toFixed(2)}</p>
                      <StatusPill status={p.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={t("quick_start")}>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {isDemo ? t("demo_mode_active") : t("database_live_start")}
            </p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                <a href="/app/teachers" className="text-primary hover:underline">
                  {t("add_teachers_step")}
                </a>
              </li>
              <li>
                <a href="/app/classes" className="text-primary hover:underline">
                  {t("create_classes_step")}
                </a>
              </li>
              <li>
                <a href="/app/students" className="text-primary hover:underline">
                  {t("enroll_students_step")}
                </a>
              </li>
              <li>
                <a href="/app/attendance" className="text-primary hover:underline">
                  {t("record_attendance_payments_step")}
                </a>{" "}
              </li>
            </ol>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

type StudentProfileSummary = {
  id: string;
  student_code: string;
  full_name: string;
  full_name_en?: string | null;
  full_name_km?: string | null;
  email?: string | null;
  class_name?: string | null;
  major?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};

type TeacherProfileSummary = {
  id: string;
  staff_code: string;
  full_name: string;
  full_name_en?: string | null;
  full_name_km?: string | null;
  email?: string | null;
  faculty?: string | null;
  department?: string | null;
  specialization?: string | null;
};

async function readTodayTimetableSlots(classIds: string[], dayKey: string) {
  if (classIds.length === 0) return [];

  let { data, error } = await supabase
    .from("timetable_slots")
    .select(
      "id,day,start_time,end_time,room,teacher_name,subject_code,subject_name,classes(name,subject_code,teachers(full_name))",
    )
    .in("class_id", classIds)
    .eq("day", dayKey as "sun")
    .order("start_time", { ascending: true });

  if (error && error.message.includes("schema cache")) {
    const fallback = await supabase
      .from("timetable_slots")
      .select("id,day,start_time,end_time,room,classes(name,subject_code,teachers(full_name))")
      .in("class_id", classIds)
      .eq("day", dayKey as "sun")
      .order("start_time", { ascending: true });
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    start_time: string;
    end_time: string;
    room: string | null;
    teacher_name?: string | null;
    subject_code?: string | null;
    subject_name?: string | null;
    classes?: { name?: string | null; subject_code?: string | null; teachers?: { full_name?: string | null } | null } | null;
  }>;
}

function TeacherDashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { t } = useI18n();
  const { profile, isDemo, user } = useAuth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-dashboard", userId, userEmail, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const teachers = readDemoList<TeacherProfileSummary>("studentsphere.demo.teachers");
        const teacher = teachers[0] ?? null;
        const classes = readDemoList<{
          id: string;
          name: string;
          subject_code: string;
          teacher_id?: string | null;
          room?: string | null;
        }>("studentsphere.demo.classes").filter((row) => !teacher || row.teacher_id === teacher.id);
        const students = readDemoList<{ id: string; class_name?: string | null }>(
          "studentsphere.demo.students",
        );
        const classNames = new Set(classes.map((row) => row.name));
        const assignedStudents = students.filter((row) => classNames.has(row.class_name ?? ""));
        const attendanceRows = readDemoList<{ status: string }>(
          "studentsphere.demo.teacher_attendance",
        );
        const present = attendanceRows.filter(
          (row) => row.status === "present" || row.status === "late",
        ).length;
        const schedules = readDemoList<{
          className: string;
          rows: Array<{
            start: string;
            end: string;
            cells: Record<string, { teacher: string; subject: string; room: string }>;
          }>;
        }>("studentsphere.manual.schedules");
        const todaySchedule = schedules
          .filter((schedule) => classNames.has(schedule.className))
          .flatMap((schedule) =>
            schedule.rows
              .map((row) => ({
                className: schedule.className,
                time: `${row.start} - ${row.end}`,
                ...row.cells[dayKey],
              }))
              .filter((slot) => slot.subject || slot.room),
          );

        return {
          teacher,
          classes,
          assignedStudents: assignedStudents.length,
          attendancePercentage:
            attendanceRows.length === 0 ? null : Math.round((present / attendanceRows.length) * 100),
          upcomingExams: [],
          todaySchedule,
          notifications: readDemoList<{
            id: string;
            title: string;
            body?: string | null;
            created_at: string;
          }>("studentsphere.demo.notifications").slice(0, 4),
        };
      }

      const scope = await findTeacherClassScope(user);
      const currentTeacher = scope?.teacher ?? null;
      const { data: teacherRows } = currentTeacher
        ? await supabase
            .from("teachers")
            .select(
              "id,staff_code,full_name,full_name_en,full_name_km,email,faculty,department,specialization",
            )
            .eq("id", currentTeacher.id)
            .limit(1)
        : { data: [] };
      const teacher = ((teacherRows ?? [])[0] ?? null) as TeacherProfileSummary | null;

      const [classesResult, attendanceResult, notificationsResult] = await Promise.all([
        teacher && (scope?.classIds.length ?? 0) > 0
          ? supabase
              .from("classes")
              .select("id,name,subject_code,room,semester")
              .in("id", scope?.classIds ?? [])
          : Promise.resolve({ data: [] }),
        teacher
          ? supabase.from("teacher_attendance").select("status").eq("teacher_id", teacher.id)
          : Promise.resolve({ data: [] }),
        supabase
          .from("notifications")
          .select("id,title,body,created_at")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      const classes = classesResult.data ?? [];
      const classIds = classes.map((row) => row.id);
      const classNames = classes.map((row) => row.name);

      const [studentsResult, examsResult, timetableResult] = await Promise.all([
        classNames.length > 0
          ? supabase.from("students").select("id").in("class_name", classNames)
          : Promise.resolve({ data: [] }),
        classIds.length > 0
          ? supabase
              .from("exams")
              .select("id,name,exam_type,exam_date,classes(name)")
              .in("class_id", classIds)
              .gte("exam_date", todayIso)
              .order("exam_date", { ascending: true })
              .limit(4)
          : Promise.resolve({ data: [] }),
        readTodayTimetableSlots(classIds, dayKey),
      ]);

      const attendanceRows = attendanceResult.data ?? [];
      const present = attendanceRows.filter(
        (row) => row.status === "present" || row.status === "late",
      ).length;

      return {
        teacher,
        classes,
        assignedStudents: studentsResult.data?.length ?? 0,
        attendancePercentage:
          attendanceRows.length === 0 ? null : Math.round((present / attendanceRows.length) * 100),
        upcomingExams: examsResult.data ?? [],
        todaySchedule: ((Array.isArray(timetableResult) ? timetableResult : timetableResult.data) ?? []).map((slot) => {
          const payload = decodeTimetableCell(slot.room);
          return {
            className: slot.classes?.name ?? "Class",
            time: `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`,
            subject:
              slot.subject_name ??
              payload.subject ??
              payload.subjectCode ??
              slot.subject_code ??
              slot.classes?.subject_code ??
              "Subject",
            room: payload.room ?? slot.room ?? "",
          };
        }),
        notifications: notificationsResult.data ?? [],
      };
    },
  });

  const teacherName =
    data?.teacher?.full_name_en || data?.teacher?.full_name || profile?.full_name || "Teacher";

  return (
    <div>
      <PageHeader
        title={
          <>
            {t("welcome")}, <span className="text-primary">{teacherName}</span>
          </>
        }
        subtitle={`${data?.teacher?.staff_code ?? t("teacher_portal")} · ${t("focused_teaching_workspace")}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("assigned_classes")}
          value={isLoading ? "…" : (data?.classes.length ?? 0)}
          icon={<School className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label={t("students")}
          value={isLoading ? "…" : (data?.assignedStudents ?? 0)}
          icon={<Users className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label={t("attendance")}
          value={
            isLoading
              ? "…"
              : data?.attendancePercentage == null
                ? "—"
                : `${data.attendancePercentage}%`
          }
          icon={<UserCheck className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t("upcoming_exams")}
          value={isLoading ? "…" : (data?.upcomingExams.length ?? 0)}
          icon={<ClipboardList className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title={t("todays_teaching_schedule")} className="lg:col-span-2">
          {(data?.todaySchedule.length ?? 0) === 0 ? (
            <EmptyState label={t("no_classes_today")} />
          ) : (
            <ul className="divide-y divide-border">
              {data?.todaySchedule.map((slot, index) => (
                <li
                  key={`${slot.className}-${slot.time}-${index}`}
                  className="grid gap-2 py-3 sm:grid-cols-[120px_1fr_120px]"
                >
                  <p className="font-mono text-xs font-semibold">{slot.time}</p>
                  <div>
                    <p className="text-sm font-semibold">{slot.subject}</p>
                    <p className="text-xs text-muted-foreground">{slot.className}</p>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {slot.room || t("room_tba")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("my_classes")}>
          {(data?.classes.length ?? 0) === 0 ? (
            <EmptyState label={t("no_assigned_classes")} />
          ) : (
            <ul className="space-y-3">
              {data?.classes.slice(0, 5).map((classRow) => (
                <li key={classRow.id} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-sm font-semibold">{classRow.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {classRow.subject_code} · {classRow.room || t("room_tba")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title={t("upcoming_exams")} className="lg:col-span-2">
          {(data?.upcomingExams.length ?? 0) === 0 ? (
            <EmptyState label={t("no_upcoming_exams")} />
          ) : (
            <ul className="divide-y divide-border">
              {data?.upcomingExams.map((exam) => (
                <li key={exam.id} className="flex items-start gap-3 py-3">
                  <ClipboardList className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{exam.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {exam.exam_type} · {exam.exam_date ?? t("date_tba")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("teacher_actions")}>
          <div className="grid gap-2 text-sm">
            <StudentLink href="/app/classes" label={t("view_assigned_classes")} />
            <StudentLink href="/app/attendance" label={t("record_attendance")} />
            <StudentLink href="/app/exams" label={t("manage_exams_scores")} />
            <StudentLink href="/app/timetable" label={t("view_timetable")} />
            <StudentLink href="/app/notifications" label={t("announcements")} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function scoreToGpa(score: number) {
  return Math.min(4, Math.max(0, score / 25));
}

function StudentDashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { t } = useI18n();
  const { profile, isDemo } = useAuth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];

  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", userId, userEmail, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const students = readDemoList<StudentProfileSummary>("studentsphere.demo.students");
        const student = students[0] ?? null;
        const className = student?.class_name ?? "";
        const attendance = readDemoList<{ student_id: string; status: string }>(
          "studentsphere.demo.attendance",
        ).filter((row) => !student || row.student_id === student.id);
        const present = attendance.filter(
          (row) => row.status === "present" || row.status === "late",
        ).length;
        const scores = readDemoList<{ student_id: string; score: number | null }>(
          "studentsphere.demo.subject_scores",
        ).filter((row) => !student || row.student_id === student.id);
        const numericScores = scores
          .map((row) => row.score)
          .filter((score): score is number => typeof score === "number");
        const payments = readDemoList<{ status: string; amount: number }>(
          "studentsphere.demo.payments",
        );
        const notifications = readDemoList<{
          id: string;
          title: string;
          body?: string | null;
          created_at: string;
        }>("studentsphere.demo.notifications").slice(0, 4);
        const schedules = readDemoList<{
          className: string;
          rows: Array<{
            start: string;
            end: string;
            cells: Record<string, { teacher: string; subject: string; room: string }>;
          }>;
        }>("studentsphere.manual.schedules");
        const todaySchedule =
          schedules
            .find((schedule) => schedule.className === className)
            ?.rows.map((row) => ({
              time: `${row.start} - ${row.end}`,
              ...row.cells[dayKey],
            }))
            .filter((slot) => slot.subject || slot.teacher || slot.room) ?? [];

        return {
          student,
          className,
          totalSubjects: new Set(
            scores.map((row) => (row as { subject_code?: string }).subject_code),
          ).size,
          gpa:
            numericScores.length === 0
              ? null
              : numericScores.reduce((sum, score) => sum + scoreToGpa(score), 0) /
                numericScores.length,
          attendancePercentage:
            attendance.length === 0 ? null : Math.round((present / attendance.length) * 100),
          upcomingExams: [],
          feeStatus: payments.some((payment) => payment.status === "overdue")
            ? "overdue"
            : payments.some((payment) => payment.status === "pending")
              ? "pending"
              : payments.length > 0
                ? "paid"
                : "no_invoice",
          notifications,
          todaySchedule,
        };
      }

      const studentQuery = supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_en,full_name_km,email,class_name,major,status,avatar_url",
        )
        .limit(1);
      const { data: studentRows } = userEmail
        ? await studentQuery.or(`user_id.eq.${userId},email.eq.${userEmail}`)
        : await studentQuery.eq("user_id", userId);
      const student = ((studentRows ?? [])[0] ?? null) as StudentProfileSummary | null;
      const className = student?.class_name ?? "";

      const [classesResult, attendanceResult, scoresResult, paymentsResult, notificationsResult] =
        await Promise.all([
          supabase.from("classes").select("id,name,subject_code").eq("name", className),
          student
            ? supabase.from("attendance").select("status").eq("student_id", student.id)
            : Promise.resolve({ data: [] }),
          student
            ? supabase
                .from("subject_scores")
                .select("subject_code,score")
                .eq("student_id", student.id)
            : Promise.resolve({ data: [] }),
          supabase.from("payments").select("status,amount,due_date,paid_date").order("created_at", {
            ascending: false,
          }),
          supabase
            .from("notifications")
            .select("id,title,body,created_at")
            .order("created_at", { ascending: false })
            .limit(4),
        ]);

      const classIds = (classesResult.data ?? []).map((row) => row.id);
      const [examsResult, timetableResult] = await Promise.all([
        classIds.length > 0
          ? supabase
              .from("exams")
              .select("id,name,exam_type,exam_date,classes(name)")
              .in("class_id", classIds)
              .gte("exam_date", todayIso)
              .order("exam_date", { ascending: true })
              .limit(4)
          : Promise.resolve({ data: [] }),
        readTodayTimetableSlots(classIds, dayKey),
      ]);

      const attendance = attendanceResult.data ?? [];
      const present = attendance.filter(
        (row) => row.status === "present" || row.status === "late",
      ).length;
      const numericScores = (scoresResult.data ?? [])
        .map((row) => row.score)
        .filter((score): score is number => typeof score === "number");
      const payments = paymentsResult.data ?? [];

      return {
        student,
        className,
        totalSubjects: new Set((scoresResult.data ?? []).map((row) => row.subject_code)).size,
        gpa:
          numericScores.length === 0
            ? null
            : numericScores.reduce((sum, score) => sum + scoreToGpa(score), 0) /
              numericScores.length,
        attendancePercentage:
          attendance.length === 0 ? null : Math.round((present / attendance.length) * 100),
        upcomingExams: examsResult.data ?? [],
        feeStatus: payments.some((payment) => payment.status === "overdue")
          ? "overdue"
          : payments.some((payment) => payment.status === "pending")
            ? "pending"
            : payments.length > 0
              ? "paid"
              : "no_invoice",
        notifications: notificationsResult.data ?? [],
        todaySchedule: ((Array.isArray(timetableResult) ? timetableResult : timetableResult.data) ?? []).map((slot) => {
          const payload = decodeTimetableCell(slot.room);
          return {
            time: `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`,
            subject:
              slot.subject_name ??
              payload.subject ??
              payload.subjectCode ??
              slot.subject_code ??
              slot.classes?.subject_code ??
              "Subject",
            teacher: slot.teacher_name ?? payload.teacher ?? slot.classes?.teachers?.full_name ?? "",
            room: payload.room ?? slot.room ?? "",
          };
        }),
      };
    },
  });

  const studentName =
    data?.student?.full_name_en || data?.student?.full_name || profile?.full_name || "Student";
  const studentFirstName = studentName.split(" ")[0];
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const feeTone =
    data?.feeStatus === "paid"
      ? "border-success/25 bg-success/8 text-success"
      : data?.feeStatus === "overdue"
        ? "border-destructive/25 bg-destructive/8 text-destructive"
        : "border-warning/30 bg-warning/10 text-warning-foreground";

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          {data?.student?.avatar_url || profile?.avatar_url ? (
            <img
              src={data?.student?.avatar_url || profile?.avatar_url || ""}
              alt={studentName}
              className="h-12 w-12 rounded-lg object-cover ring-1 ring-border sm:h-14 sm:w-14"
            />
          ) : (
            <Avatar name={studentName} className="h-12 w-12 rounded-lg sm:h-14 sm:w-14" />
          )}
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">{todayLabel}</p>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {t("hello")} <span className="text-primary">{studentFirstName}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.className || t("class")} · {data?.student?.major || t("student_portal")}
            </p>
          </div>
        </div>
        <a
          href="/app/students"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold hover:bg-muted"
        >
          {t("my_information")} <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StudentMetric
          label={t("subjects")}
          value={isLoading ? "…" : String(data?.totalSubjects ?? 0)}
          note={t("total_subjects")}
          icon={<BookOpen className="h-4 w-4" />}
          tone="primary"
        />
        <StudentMetric
          label={t("average_score")}
          value={isLoading ? "…" : data?.gpa == null ? "—" : data.gpa.toFixed(2)}
          note={t("gpa_out_of_4")}
          icon={<GraduationCap className="h-4 w-4" />}
          tone="success"
        />
        <StudentMetric
          label={t("attendance")}
          value={
            isLoading
              ? "…"
              : data?.attendancePercentage == null
                ? "—"
                : `${data.attendancePercentage}%`
          }
          note={t("attendance_rate")}
          icon={<Percent className="h-4 w-4" />}
          tone="info"
        />
        <StudentMetric
          label={t("payments")}
          value={isLoading ? "…" : data?.feeStatus ? t(data.feeStatus) : "—"}
          note={t("current_fee_status")}
          icon={<Wallet className="h-4 w-4" />}
          tone="warning"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <section className="border-y border-border bg-card sm:rounded-lg sm:border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-display text-base font-semibold">{t("today_schedule")}</h2>
              <p className="text-xs text-muted-foreground">{t("todays_classes_rooms")}</p>
            </div>
            <a href="/app/timetable" className="text-xs font-semibold text-primary hover:underline">
              {t("view_all")}
            </a>
          </div>
          {(data?.todaySchedule.length ?? 0) === 0 ? (
            <EmptyState label={t("no_schedule_today")} />
          ) : (
            <ul className="divide-y divide-border px-4 sm:px-5">
              {data?.todaySchedule.map((slot, index) => (
                <li
                  key={`${slot.time}-${index}`}
                  className="grid gap-3 py-4 sm:grid-cols-[118px_minmax(0,1fr)_150px] sm:items-center"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Clock3 className="h-4 w-4 text-primary" />
                    <span className="font-mono">{slot.time}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{slot.subject || t("subject")}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {slot.teacher || t("lecturer_tba")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {slot.room || t("room_tba")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="font-display text-base font-semibold">{t("academic_status")}</h2>
            <p className="text-xs text-muted-foreground">{t("current_semester_overview")}</p>
          </div>
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>{t("attendance")}</span>
                <span>{data?.attendancePercentage == null ? "—" : `${data.attendancePercentage}%`}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${data?.attendancePercentage ?? 0}%` }}
                />
              </div>
            </div>
            <div className={`flex items-center justify-between rounded-md border p-3 ${feeTone}`}>
              <div className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4" />
                <span className="text-xs font-semibold">{t("payments")}</span>
              </div>
              <span className="text-xs font-bold">{data?.feeStatus ? t(data.feeStatus) : "—"}</span>
            </div>
            <StudentLink href="/app/attendance" label={t("view_attendance_history")} />
            <StudentLink href="/app/payments" label={t("view_payments")} />
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <h2 className="font-display text-base font-semibold">{t("upcoming_exams")}</h2>
              <p className="text-xs text-muted-foreground">{t("upcoming_exams")}</p>
            </div>
            <a href="/app/exams" className="text-xs font-semibold text-primary hover:underline">
              {t("exams")}
            </a>
          </div>
          {(data?.upcomingExams.length ?? 0) === 0 ? (
            <EmptyState label={t("no_upcoming_exams")} />
          ) : (
            <ul className="divide-y divide-border px-4">
              {data?.upcomingExams.map((exam) => (
                <li key={exam.id} className="flex items-center gap-3 py-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{exam.name}</p>
                    <p className="text-xs text-muted-foreground">{exam.exam_type}</p>
                  </div>
                  <span className="text-xs font-semibold">{exam.exam_date ?? t("tba")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <h2 className="font-display text-base font-semibold">{t("notifications")}</h2>
              <p className="text-xs text-muted-foreground">{t("recent_school_announcements")}</p>
            </div>
            <a
              href="/app/notifications"
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("view_all")}
            </a>
          </div>
          {(data?.notifications.length ?? 0) === 0 ? (
            <EmptyState label={t("no_notifications_yet")} />
          ) : (
            <ul className="divide-y divide-border px-4">
              {data?.notifications.map((item) => (
                <li key={item.id} className="flex gap-3 py-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-info/10 text-info">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    {item.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {decodeNotificationContent(item.body).description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StudentMetric({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  tone: "primary" | "success" | "warning" | "info";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    info: "bg-info/10 text-info",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">{value}</p>
          <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{note}</p>
        </div>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tones[tone]}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function StudentLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-muted"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <RefreshCw className="h-5 w-5 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{label}</p>;
}
