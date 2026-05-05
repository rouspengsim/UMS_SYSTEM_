import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, StatCard, SectionCard, StatusPill, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Users, GraduationCap, School, DollarSign, ArrowUpRight, RefreshCw } from "lucide-react";
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

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — RULE" }] }),
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
  const { profile, primaryRole, isDemo } = useAuth();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", isDemo ? "demo" : "remote"],
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
        .select("id,full_name,student_code,status")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["dashboard-recent-payments", isDemo ? "demo" : "remote"],
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

  const firstName = profile?.full_name?.split(" ")[0] ?? "Friend";

  return (
    <div>
      <PageHeader
        title={
          <>
            {t("good_morning")}, <span className="text-primary">{firstName}</span> 👋
          </>
        }
        subtitle={`${today} · Signed in as ${primaryRole ?? "user"}`}
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
              <EmptyChart label="No revenue yet" />
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

        <SectionCard title="Subjects mix">
          <div className="h-64">
            {subjects.length === 0 ? (
              <EmptyChart label="No classes yet" />
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
              <EmptyChart label="No attendance recorded yet" />
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
          title="New students"
          action={
            <a href="/app/students" className="text-xs font-semibold text-primary hover:underline">
              View all
            </a>
          }
        >
          {recentStudents.length === 0 ? (
            <EmptyState label="No students yet. Add one from the Students page." />
          ) : (
            <ul className="space-y-3">
              {recentStudents.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Avatar name={s.full_name} />
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
          title="Latest payments"
          action={
            <a href="/app/payments" className="text-xs font-semibold text-primary hover:underline">
              View all
            </a>
          }
        >
          {recentPayments.length === 0 ? (
            <EmptyState label="No payments recorded yet." />
          ) : (
            <ul className="divide-y divide-border">
              {recentPayments.map((p) => {
                const studentName =
                  (p as { students?: { full_name: string } | null }).students?.full_name ??
                  "Student";
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
        <SectionCard title="Quick start">
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {isDemo ? "Demo mode is active. Test the full workflow:" : "Your database is live. Start by:"}
            </p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                Add{" "}
                <a href="/app/teachers" className="text-primary hover:underline">
                  teachers
                </a>
              </li>
              <li>
                Create{" "}
                <a href="/app/classes" className="text-primary hover:underline">
                  classes
                </a>
              </li>
              <li>
                Enroll{" "}
                <a href="/app/students" className="text-primary hover:underline">
                  students
                </a>
              </li>
              <li>
                Record{" "}
                <a href="/app/attendance" className="text-primary hover:underline">
                  attendance
                </a>{" "}
                &{" "}
                <a href="/app/payments" className="text-primary hover:underline">
                  payments
                </a>
              </li>
            </ol>
          </div>
        </SectionCard>
      </div>
    </div>
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
