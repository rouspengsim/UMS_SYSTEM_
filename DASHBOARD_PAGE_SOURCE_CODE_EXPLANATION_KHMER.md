# Dashboard Page Main Source Code Explanation

File source code ពេញ៖ `src/routes/app.index.tsx`

ឯកសារនេះពន្យល់តែ source code សំខាន់ៗរបស់ Dashboard page និងអ្វីដែល user អាចធ្វើ/មើលបានលើ page នេះ។

## 1. Dashboard Page Route

```tsx
export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
  component: Dashboard,
});
```

ការពន្យល់៖

Code នេះកំណត់ route សម្រាប់ Dashboard page នៅ path `/app/`។ ពេល user login ហើយចូល system វានឹងបង្ហាញ Dashboard ជា page ដំបូង។ `pageTitle("Dashboard")` ប្រើសម្រាប់កំណត់ title នៅ browser tab។

## 2. Dashboard Imports

```tsx
import { PageHeader, StatCard, SectionCard, StatusPill, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
```

ការពន្យល់៖

Dashboard ប្រើ components និង libraries សំខាន់ៗ៖

- `PageHeader`, `StatCard`, `SectionCard` សម្រាប់ UI layout។
- `useI18n` សម្រាប់បង្ហាញភាសា Khmer/English។
- `useAuth` សម្រាប់ដឹងថា user ជា admin, teacher ឬ student។
- `useQuery` សម្រាប់ទាញ data និង cache data។
- `supabase` សម្រាប់ទាញ data ពី database។
- `recharts` សម្រាប់បង្ហាញ charts ដូចជា revenue chart, attendance chart និង subject pie chart។

## 3. Dashboard Main Component

```tsx
function Dashboard() {
  const { t } = useI18n();
  const { user, profile, primaryRole, isDemo } = useAuth();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
```

ការពន្យល់៖

`Dashboard` ជា component មេរបស់ page។ វាយក function `t()` សម្រាប់ translate text, យក user/profile/role ពី `useAuth()` ហើយបង្កើត date label សម្រាប់បង្ហាញថ្ងៃបច្ចុប្បន្ននៅ header។

## 4. Load Admin Dashboard Statistics

```tsx
const { data: stats, isLoading } = useQuery({
  queryKey: ["dashboard-stats", isDemo ? "demo" : "remote"],
  enabled: primaryRole !== "student",
  queryFn: async () => {
    const [students, teachers, classes, payments] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("classes").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("amount,status,paid_date,created_at"),
    ]);

    const paidRows = (payments.data ?? []).filter((p) => p.status === "paid");
    const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    return {
      students: students.count ?? 0,
      teachers: teachers.count ?? 0,
      classes: classes.count ?? 0,
      revenue: totalRevenue,
    };
  },
});
```

ការពន្យល់៖

ផ្នែកនេះទាញស្ថិតិសំខាន់ៗសម្រាប់ admin/teacher dashboard។ វាទាញ data ពី tables `students`, `teachers`, `classes`, និង `payments`។ `Promise.all` ធ្វើឲ្យ queries ទាំងអស់រត់ពេលតែមួយ ដើម្បីឲ្យ page load លឿន។ ចំណូលសរុបគិតតែ payment ដែលមាន status `paid`។

អ្វីដែលបង្ហាញលើ Dashboard៖

- Total students
- Total teachers
- Active classes
- Total revenue

## 5. Revenue Trend Chart

```tsx
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
```

ការពន្យល់៖

Code នេះបង្កើត revenue trend សម្រាប់ 6 ខែចុងក្រោយ។ វាបង្កើត list ខែជាមុន ហើយបូកចំណូល payment ដែលបាន paid តាមខែនីមួយៗ។ Data នេះត្រូវបានបង្ហាញជា Area Chart។

អ្វីដែល user អាចមើលបាន៖

- ចំណូលតាមខែ
- ខែណាចំណូលខ្ពស់ ឬទាប
- ទិសដៅចំណូលរបស់សាលា

## 6. Attendance Trend

```tsx
const { data: attendanceTrend = [] } = useQuery({
  queryKey: ["dashboard-attendance", isDemo ? "demo" : "remote"],
  enabled: primaryRole !== "student",
  queryFn: async () => {
    const since = new Date();
    since.setDate(since.getDate() - 6);

    const { data } = await supabase
      .from("attendance")
      .select("date,status")
      .gte("date", since.toISOString().slice(0, 10));

    const days = emptyRecentDays();
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
```

ការពន្យល់៖

ផ្នែកនេះទាញ attendance រយៈពេល 7 ថ្ងៃចុងក្រោយ។ Status `present` និង `late` ត្រូវបានរាប់ថាមានវត្តមាន។ Status ផ្សេងៗត្រូវបានរាប់ជា absent។ Data នេះត្រូវបានប្រើបង្ហាញ attendance chart។

អ្វីដែល user អាចមើលបាន៖

- ចំនួនសិស្សមានវត្តមានក្នុង 7 ថ្ងៃចុងក្រោយ
- ចំនួន absent
- Attendance trend របស់សាលា

## 7. Subject Mix Chart

```tsx
const { data: subjects = [] } = useQuery({
  queryKey: ["dashboard-subjects", isDemo ? "demo" : "remote"],
  enabled: primaryRole !== "student",
  queryFn: async () => {
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
```

ការពន្យល់៖

ផ្នែកនេះរាប់ចំនួន class តាម subject។ វាបង្ហាញជា Pie Chart ដើម្បីឲ្យ admin ឃើញថា subject ណាមាន class ច្រើនជាងគេ។

អ្វីដែល user អាចមើលបាន៖

- Subject distribution
- Subject ដែលមាន classes ច្រើន
- Overview អំពីការបែងចែកមុខវិជ្ជា

## 8. Recent Students

```tsx
const { data: recentStudents = [] } = useQuery<RecentStudent[]>({
  queryKey: ["dashboard-recent-students", isDemo ? "demo" : "remote"],
  enabled: primaryRole !== "student",
  queryFn: async () => {
    const { data } = await supabase
      .from("students")
      .select("id,full_name,student_code,status,avatar_url")
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  },
});
```

ការពន្យល់៖

Dashboard បង្ហាញសិស្សថ្មីៗ 5 នាក់ចុងក្រោយ។ វាអាចជួយ admin ឃើញការចុះឈ្មោះថ្មីៗ ឬសិស្សដែលទើបបន្ថែម។

អ្វីដែល user អាចមើលបាន៖

- ឈ្មោះសិស្សថ្មី
- Student code
- Status របស់សិស្ស
- Avatar របស់សិស្ស

## 9. Recent Payments

```tsx
const { data: recentPayments = [] } = useQuery({
  queryKey: ["dashboard-recent-payments", isDemo ? "demo" : "remote"],
  enabled: primaryRole !== "student",
  queryFn: async () => {
    const { data } = await supabase
      .from("payments")
      .select("id,amount,status,method,paid_date,created_at,students(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);
    return data ?? [];
  },
});
```

ការពន្យល់៖

Dashboard បង្ហាញ payment ថ្មីៗ 5 records ចុងក្រោយ។ វាជួយ admin ឃើញការទូទាត់ថ្មីៗ និង status របស់ invoice។

អ្វីដែល user អាចមើលបាន៖

- Student name
- Amount
- Payment status
- Payment method
- Paid date ឬ created date

## 10. Role Based Dashboard

```tsx
if (primaryRole === "student") {
  return <StudentDashboard userId={user?.id ?? ""} userEmail={user?.email ?? ""} />;
}

if (primaryRole === "teacher") {
  return <TeacherDashboard userId={user?.id ?? ""} userEmail={user?.email ?? ""} />;
}
```

ការពន្យល់៖

Dashboard មិនបង្ហាញ UI ដូចគ្នាសម្រាប់ user គ្រប់ role ទេ។ ប្រសិនបើ user ជា student វាបង្ហាញ `StudentDashboard`។ ប្រសិនបើ user ជា teacher វាបង្ហាញ `TeacherDashboard`។ Admin នឹងឃើញ dashboard សរុបរបស់សាលា។

## 11. Admin Dashboard UI

```tsx
return (
  <div>
    <PageHeader
      title={
        <>
          {t("good_morning")}, <span className="text-primary">{firstName}</span>
        </>
      }
      subtitle={`${today} · ${t("signed_in_as")} ${primaryRole ? t(primaryRole) : "user"}`}
    />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("total_students")} value={stats?.students ?? 0} />
      <StatCard label={t("total_teachers")} value={stats?.teachers ?? 0} />
      <StatCard label={t("active_classes")} value={stats?.classes ?? 0} />
      <StatCard label={t("revenue")} value={`$${(stats?.revenue ?? 0).toLocaleString()}`} />
    </div>
  </div>
);
```

ការពន្យល់៖

Admin dashboard បង្ហាញ header និង statistic cards។ Card ទាំងនេះជួយឲ្យ admin ឃើញស្ថានភាពសាលាដោយសង្ខេបភ្លាមៗ។

អ្វីដែល admin អាចធ្វើ/មើលលើ Dashboard៖

- មើលចំនួនសិស្សសរុប
- មើលចំនួនគ្រូសរុប
- មើលចំនួនថ្នាក់សកម្ម
- មើលចំណូលសរុប
- មើល chart ចំណូល
- មើល attendance trend
- មើល subject distribution
- មើល recent students
- មើល recent payments

## 12. Teacher Dashboard Data

```tsx
function TeacherDashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { t } = useI18n();
  const { profile, isDemo, user } = useAuth();
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-dashboard", userId, userEmail, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      const scope = await findTeacherClassScope(user);
      const currentTeacher = scope?.teacher ?? null;
      // load teacher, classes, attendance, exams, timetable, notifications
    },
  });
}
```

ការពន្យល់៖

Teacher dashboard ទាញ class scope របស់ teacher តាម `findTeacherClassScope(user)`។ បន្ទាប់មកវាទាញ classes, students, teacher attendance, upcoming exams, today schedule និង notifications។

អ្វីដែល teacher អាចធ្វើ/មើលលើ Dashboard៖

- មើល profile summary របស់ខ្លួន
- មើល classes ដែលខ្លួនបង្រៀន
- មើលចំនួនសិស្សដែលខ្លួនទទួលបន្ទុក
- មើល attendance percentage របស់គ្រូ
- មើល exams ខាងមុខ
- មើល timetable សម្រាប់ថ្ងៃនេះ
- មើល notifications សម្រាប់ teacher

## 13. Teacher Dashboard Queries

```tsx
const [classesResult, attendanceResult, notificationsResult] = await Promise.all([
  teacher && (scope?.classIds.length ?? 0) > 0
    ? supabase.from("classes").select("id,name,subject_code,room,semester").in("id", scope?.classIds ?? [])
    : Promise.resolve({ data: [] }),
  teacher
    ? supabase.from("teacher_attendance").select("status").eq("teacher_id", teacher.id)
    : Promise.resolve({ data: [] }),
  supabase
    .from("notifications")
    .select("id,title,body,created_at,target_role,target_user_id")
    .order("created_at", { ascending: false })
    .limit(20),
]);
```

ការពន្យល់៖

Code នេះទាញ data 3 ផ្នែកសម្រាប់ teacher dashboard ពេលតែមួយ៖ classes, attendance និង notifications។ វាប្រើ `Promise.all` ដើម្បីឲ្យលឿន។

## 14. Student Dashboard Data

```tsx
function StudentDashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", userId, userEmail, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      const studentQuery = supabase
        .from("students")
        .select("id,student_code,full_name,email,class_name,major,status,avatar_url")
        .limit(1);

      const { data: studentRows } = userEmail
        ? await studentQuery.or(`user_id.eq.${userId},email.eq.${userEmail}`)
        : await studentQuery.eq("user_id", userId);

      const student = ((studentRows ?? [])[0] ?? null) as StudentProfileSummary | null;
      const className = student?.class_name ?? "";
    },
  });
}
```

ការពន្យល់៖

Student dashboard ចាប់ផ្តើមដោយរក student record របស់ user ដែល login។ វាព្យាយាម match តាម `user_id` ឬ email។ បន្ទាប់មកវាយក class name របស់សិស្ស ដើម្បីទាញ timetable, exams និង subjects ដែលពាក់ព័ន្ធ។

## 15. Student Dashboard Summary Data

```tsx
const [classesResult, attendanceResult, scoresResult, paymentsResult, notificationsResult] =
  await Promise.all([
    supabase.from("classes").select("id,name,subject_code").eq("name", className),
    student
      ? supabase.from("attendance").select("status").eq("student_id", student.id)
      : Promise.resolve({ data: [] }),
    student
      ? supabase.from("subject_scores").select("subject_code,score").eq("student_id", student.id)
      : Promise.resolve({ data: [] }),
    student
      ? supabase.from("payments").select("status,amount,due_date,paid_date").eq("student_id", student.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("notifications")
      .select("id,title,body,created_at,target_role,target_user_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
```

ការពន្យល់៖

Student dashboard ទាញ data សំខាន់ៗរបស់សិស្សក្នុង query group មួយ៖ classes, attendance, scores, payments និង notifications។ Data ទាំងនេះប្រើសម្រាប់បង្ហាញ portal summary របស់សិស្ស។

អ្វីដែល student អាចធ្វើ/មើលលើ Dashboard៖

- មើលព័ត៌មានខ្លួន និង class/major
- មើលចំនួន subjects
- មើល average score/GPA
- មើល attendance percentage
- មើល fee/payment status
- មើល exams ខាងមុខ
- មើល schedule សម្រាប់ថ្ងៃនេះ
- មើល notifications
- ចុចទៅ `My Information` ដើម្បីមើល profile លម្អិត

## 16. Student GPA and Attendance Calculation

```tsx
const attendance = attendanceResult.data ?? [];
const present = attendance.filter(
  (row) => row.status === "present" || row.status === "late",
).length;

const numericScores = (scoresResult.data ?? [])
  .map((row) => row.score)
  .filter((score): score is number => typeof score === "number");

return {
  totalSubjects: new Set((scoresResult.data ?? []).map((row) => row.subject_code)).size,
  gpa:
    numericScores.length === 0
      ? null
      : numericScores.reduce((sum, score) => sum + scoreToGpa(score), 0) / numericScores.length,
  attendancePercentage:
    attendance.length === 0 ? null : Math.round((present / attendance.length) * 100),
};
```

ការពន្យល់៖

ផ្នែកនេះគណនា total subjects, GPA និង attendance percentage សម្រាប់ student។ Attendance រាប់ `present` និង `late` ជាការមានវត្តមាន។ GPA គណនាពី scores ដែលមានតម្លៃជាលេខ។

## 17. Read Today Timetable

```tsx
async function readTodayTimetableSlots(
  classIds: string[],
  dayKey: string,
): Promise<TodayTimetableSlot[]> {
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id,day,start_time,end_time,room,teacher_name,subject_code,subject_name,classes(name)")
    .in("class_id", classIds)
    .eq("day", dayKey as "sun")
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TodayTimetableSlot[];
}
```

ការពន្យល់៖

Function នេះទាញ timetable slots សម្រាប់ថ្ងៃបច្ចុប្បន្ន។ Teacher dashboard ប្រើវាដើម្បីមើល schedule ថ្ងៃនេះរបស់គ្រូ។ Student dashboard ប្រើវាដើម្បីមើល schedule ថ្ងៃនេះរបស់ class ខ្លួន។

## 18. Dashboard Page Summary

Dashboard page គឺជា page សំខាន់សម្រាប់បង្ហាញស្ថានភាពប្រព័ន្ធដោយសង្ខេប។ វាប្តូរមាតិកាតាម role របស់ user។

Admin dashboard អាចមើល៖

- Total students
- Total teachers
- Active classes
- Revenue
- Revenue chart
- Attendance trend
- Subject mix
- Recent students
- Recent payments

Teacher dashboard អាចមើល៖

- Teacher profile summary
- Assigned classes
- Assigned student count
- Teacher attendance percentage
- Upcoming exams
- Today schedule
- Notifications

Student dashboard អាចមើល៖

- Student profile summary
- Class and major
- Total subjects
- GPA/average score
- Attendance percentage
- Fee status
- Upcoming exams
- Today schedule
- Notifications
- Link to My Information

## 19. Thesis Explanation Paragraph

អាចសរសេរក្នុង thesis ដូចនេះ៖

Dashboard page ត្រូវបានរចនាឡើងដើម្បីបង្ហាញព័ត៌មានសង្ខេបតាមតួនាទីអ្នកប្រើ។ សម្រាប់ admin ប្រព័ន្ធបង្ហាញចំនួនសិស្ស គ្រូ ថ្នាក់ ចំណូល ក្រាហ្វចំណូល វត្តមាន និងការទូទាត់ថ្មីៗ។ សម្រាប់ teacher ប្រព័ន្ធបង្ហាញថ្នាក់ដែលបាន assign, ចំនួនសិស្ស, វត្តមានគ្រូ, កាលវិភាគថ្ងៃនេះ និងសេចក្តីជូនដំណឹង។ សម្រាប់ student ប្រព័ន្ធបង្ហាញព័ត៌មានផ្ទាល់ខ្លួន ចំនួនមុខវិជ្ជា GPA វត្តមាន ស្ថានភាពការទូទាត់ ការប្រឡងខាងមុខ និងកាលវិភាគថ្ងៃនេះ។ ការទាញទិន្នន័យត្រូវបានអនុវត្តដោយ `useQuery` និង Supabase queries ហើយ chart ត្រូវបានបង្ហាញដោយ Recharts។

