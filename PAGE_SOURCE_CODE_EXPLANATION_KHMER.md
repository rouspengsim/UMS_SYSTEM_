# Important Page Source Code Explanation ជាភាសាខ្មែរ

Project: `Personal School Management System`

ឯកសារនេះរៀបចំ source code សំខាន់ៗតាម page/module ដើម្បីងាយយកទៅពន្យល់ក្នុង thesis, presentation ឬ viva។ ផ្នែកនីមួយៗមាន file path, source code សំខាន់ និងការពន្យល់ជាខ្មែរ។

## 1. Dashboard Page

File: `src/routes/app.index.tsx`

### 1.1 Dashboard Route

```tsx
export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
  component: DashboardPage,
});
```

ការពន្យល់៖

Code នេះបង្កើត route សម្រាប់ Dashboard នៅ path `/app/`។ Function `pageTitle("Dashboard")` ប្រើសម្រាប់កំណត់ title នៅ browser tab។ `component: DashboardPage` មានន័យថា ពេល user ចូល `/app/` ប្រព័ន្ធនឹងបង្ហាញ component `DashboardPage`។

### 1.2 Dashboard Statistics

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

Dashboard ប្រើ `useQuery` ដើម្បីទាញទិន្នន័យសង្ខេបពី Supabase។ `Promise.all` ធ្វើឲ្យ query ច្រើនរត់ពេលតែមួយ ដូច្នេះ page load លឿន។ វារាប់ចំនួនសិស្ស គ្រូ ថ្នាក់ និងគណនាចំណូលសរុបពី payment ដែលមាន status `paid`។

### 1.3 Revenue Trend

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

ផ្នែកនេះបង្កើត trend ចំណូលរយៈពេល 6 ខែចុងក្រោយ។ វាបង្កើត object `months` ជាមុន ដើម្បីឲ្យខែដែលគ្មានចំណូលបង្ហាញជា 0។ បន្ទាប់មកវាបូក amount របស់ payments ដែលបានបង់រួចទៅតាមខែ។

## 2. Login Page

Files:

- `src/routes/index.tsx`
- `src/lib/login-auth.ts`
- `src/lib/account-ids.ts`

### 2.1 Convert Student/Teacher ID to Login Email

```ts
function schoolAccountEmail(role: Exclude<Role, "admin">, loginId: string, domain: string) {
  return `${role}.${normalizeLoginId(loginId)}@${domain}`;
}

export function accountLoginEmail(role: Exclude<Role, "admin">, loginId: string) {
  return schoolAccountEmail(role, loginId, UNIVERSITY_ACCOUNT_DOMAIN);
}
```

ការពន្យល់៖

Student និង teacher login ដោយប្រើ ID មិនមែន email ពេញទេ។ ប្រព័ន្ធបម្លែង ID ទៅជា internal email ដើម្បីប្រើជាមួយ Supabase Auth។ ឧទាហរណ៍ student ID `RULE26-1234` អាចក្លាយជា `student.rule26.1234@studentsphere.local`។

### 2.2 Sign In by Role

```ts
export async function signInWithRoleCredentials(
  role: LoginRole,
  loginId: string,
  email: string,
  password: string,
) {
  if (role === "admin") {
    return supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  }

  const emails = accountLoginEmailCandidates(role, loginId);
  for (const candidateEmail of emails) {
    const result = await supabase.auth.signInWithPassword({
      email: candidateEmail,
      password,
    });

    if (!result.error) return result;
  }
}
```

ការពន្យល់៖

Admin login ដោយ email/password។ Student និង teacher login ដោយ ID/password ហើយប្រព័ន្ធសាកល្បង email candidates ច្រើន ដើម្បីគាំទ្រ domain ថ្មី និង legacy domain។ នេះធ្វើឲ្យ login មានភាពងាយស្រួលសម្រាប់អ្នកប្រើ។

### 2.3 Verify Role After Login

```ts
export async function verifySignedInRole(user: SupabaseUser, role: LoginRole) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

  if (error) throw error;

  const hasRole = data?.some((row) => row.role === role);
  if (hasRole) return;

  await supabase.auth.signOut();
  throw new Error(`This account is not registered as ${roleDisplayName(role)}.`);
}
```

ការពន្យល់៖

ក្រោយ password ត្រឹមត្រូវ ប្រព័ន្ធនៅតែពិនិត្យ role ក្នុង table `user_roles`។ បើ user ព្យាយាម login ជា teacher ប៉ុន្តែ account មិនមាន role teacher ប្រព័ន្ធ sign out ភ្លាម។ នេះជាស្រទាប់ security បន្ថែមលើ Supabase Auth។

## 3. Protected App Layout

File: `src/routes/app.tsx`

```tsx
useEffect(() => {
  if (!loading && !user) {
    navigate({ to: "/" });
  }
}, [loading, user, navigate]);

useEffect(() => {
  if (!loading && user && primaryRole && !canAccessPath(primaryRole, pathname)) {
    navigate({ to: "/app" });
  }
}, [loading, navigate, pathname, primaryRole, user]);
```

ការពន្យល់៖

Layout `/app` ជា protected area។ បើ user មិនទាន់ login វា redirect ទៅ login page។ បើ user login ហើយ ប៉ុន្តែ role មិនអាចចូល path បច្ចុប្បន្ន វា redirect ទៅ dashboard។ នេះជួយការពារ UI level access។

## 4. Students Page

File: `src/routes/app.students.tsx`

### 4.1 Fetch Students by Role

```tsx
const { data: students = [], isLoading } = useQuery({
  queryKey: ["students", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    if (primaryRole === "student") {
      const { data, error } = await supabase.rpc("list_student_classmates");
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    }

    if (primaryRole === "teacher") {
      const scope = await findTeacherClassScope(user);
      const classNames = scope?.classNames ?? [];
      if (classNames.length === 0) return [];

      const { data, error } = await supabase
        .from("students")
        .select("*")
        .in("class_name", classNames)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    }

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as StudentRow[];
  },
});
```

ការពន្យល់៖

Students page ទាញទិន្នន័យខុសគ្នាតាម role។ Student មើល classmates តាម RPC `list_student_classmates`។ Teacher មើលតែសិស្សក្នុង class ដែលខ្លួនបង្រៀន។ Admin មើលសិស្សទាំងអស់។ Pattern នេះបង្ហាញ role-based data access នៅ frontend។

### 4.2 Search and Filter Students

```tsx
const filtered = useMemo(() => {
  return students
    .filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (majorFilter !== "all" && s.major !== majorFilter) return false;
      if (classFilter !== "all" && s.class_name !== classFilter) return false;
      if (
        q &&
        !s.full_name.toLowerCase().includes(q.toLowerCase()) &&
        !s.student_code.toLowerCase().includes(q.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => a.student_code.localeCompare(b.student_code));
}, [students, q, filter, majorFilter, classFilter]);
```

ការពន្យល់៖

`useMemo` ប្រើសម្រាប់គណនា filtered students ដោយមិនគណនាឡើងវិញរាល់ render លុះត្រាតែ data ឬ filter ផ្លាស់ប្តូរ។ User អាចស្វែងរកតាមឈ្មោះ ឬ student code និង filter តាម status, major, class។

### 4.3 Delete Student

```tsx
const deleteMut = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["students", isDemo ? "demo" : "remote"] });
    toast.success("Student deleted");
  },
});
```

ការពន្យល់៖

ការលុប student ប្រើ `useMutation` ព្រោះវាជា write operation។ បន្ទាប់ពី delete ជោគជ័យ វា invalidate query ដើម្បីឲ្យបញ្ជីសិស្ស refresh ពី database ថ្មី។

## 5. Teachers Page

File: `src/routes/app.teachers.tsx`

### 5.1 Load Teachers

```tsx
const { data: teachers = [], isLoading } = useQuery({
  queryKey: ["teachers", isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as TeacherRow[];
  },
});
```

ការពន្យល់៖

Teachers page ទាញបញ្ជីគ្រូពី table `teachers` ហើយ sort តាម `created_at` ថ្មីទៅចាស់។ `isLoading` ប្រើសម្រាប់បង្ហាញ loading state នៅ UI។

### 5.2 Delete Teacher

```tsx
const del = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["teachers", isDemo ? "demo" : "remote"] });
    toast.success(t("teacher_removed"));
  },
});
```

ការពន្យល់៖

Mutation នេះលុប teacher record តាម id។ បន្ទាប់ពីលុប វា refresh query `teachers` និងបង្ហាញ toast message ជាភាសាដែល user ជ្រើស។

## 6. Classes Page

File: `src/routes/app.classes.tsx`

### 6.1 Load Classes by Role

```tsx
const { data: classes = [], isLoading } = useQuery({
  queryKey: ["classes", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    if (isStudent) {
      const { data: student } = await supabase
        .from("students")
        .select("class_name")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();

      if (!student?.class_name) return [];

      const { data, error } = await supabase
        .from("classes")
        .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)")
        .eq("name", student.class_name);
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    }

    if (isTeacher) {
      const scope = await findTeacherClassScope(user);
      return (scope?.classes ?? []) as unknown as ClassRow[];
    }

    const { data, error } = await supabase.from("classes").select("*");
    if (error) throw error;
    return (data ?? []) as unknown as ClassRow[];
  },
});
```

ការពន្យល់៖

Classes page ក៏គោរព role ដូច Students page។ Student មើលតែ class របស់ខ្លួន។ Teacher មើលតែ class ដែល assign ឲ្យខ្លួន។ Admin មើល classes ទាំងអស់។

### 6.2 Count Enrollments

```tsx
const { data: enrollCounts = {} } = useQuery({
  queryKey: ["class-enrollment-counts", isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data } = await supabase.from("enrollments").select("class_id");
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r) => {
      counts[r.class_id] = (counts[r.class_id] ?? 0) + 1;
    });
    return counts;
  },
});
```

ការពន្យល់៖

Code នេះរាប់ចំនួនសិស្សក្នុង class នីមួយៗពី table `enrollments`។ Result ត្រូវបានរក្សាជា object ដែល key គឺ `class_id` និង value គឺចំនួនសិស្ស។

## 7. Attendance Page

File: `src/routes/app.attendance.tsx`

### 7.1 Load Existing Attendance

```tsx
const { data: existing = [] } = useQuery({
  queryKey: ["attendance-day", classId, semester, weekNumber, subjectCode, date],
  enabled: !!classId && !!subjectCode,
  queryFn: async () => {
    const { data } = await supabase
      .from("attendance")
      .select("student_id,status,week_number,day_of_week")
      .eq("class_id", classId)
      .eq("semester", semester)
      .gte("week_number", weekNumber)
      .lte("week_number", visibleWeeks.at(-1) ?? weekNumber)
      .eq("subject_code", subjectCode);
    return data ?? [];
  },
});
```

ការពន្យល់៖

Attendance page ទាញ attendance ដែលមានរួចតាម class, semester, week និង subject។ `enabled` ធានាថា query រត់តែពេលមាន `classId` និង `subjectCode`។

### 7.2 Find Attendance Cell

```tsx
const attendanceFor = (studentId: string, week: number, day: number): Status | undefined => {
  const r = existing.find(
    (e) => e.student_id === studentId && e.week_number === week && e.day_of_week === day,
  );
  return r?.status as Status | undefined;
};
```

ការពន្យល់៖

Function នេះស្វែងរក status វត្តមានរបស់សិស្សម្នាក់នៅ week និង day ជាក់លាក់។ វាត្រូវបានប្រើក្នុង table/grid ដើម្បីបង្ហាញថាសិស្ស present, absent, late ឬ excused។

### 7.3 Save Attendance with Upsert

```tsx
const { error } = await supabase.from("attendance").upsert(
  {
    student_id: sid,
    class_id: classId,
    date: recordDate,
    semester,
    week_number: week,
    day_of_week: day,
    subject_code: subjectCode,
    status,
  },
  { onConflict: "student_id,class_id,semester,week_number,day_of_week,subject_code" },
);
```

ការពន្យល់៖

`upsert` មានន័យថា បើ attendance record មានរួច វា update; បើមិនទាន់មាន វា insert ថ្មី។ `onConflict` កំណត់ unique key ដើម្បីការពារ attendance ស្ទួនសម្រាប់ student/class/week/day/subject ដូចគ្នា។

## 8. Exams and Scores Page

File: `src/routes/app.exams.tsx`

### 8.1 Score Breakdown

```tsx
const scoreBreakdownFor = (studentId: string, subject: string) => {
  const record = scoreRecordFor(studentId, subject);
  const attendance = attendanceScoreFor(studentId, subject);
  const assignment = scoreComponentNumber(studentId, subject, "assignment_score", record?.assignment_score);
  const midterm = scoreComponentNumber(studentId, subject, "midterm_score", record?.midterm_score);
  const final = scoreComponentNumber(studentId, subject, "final_score", record?.final_score);
  const total = totalSubjectScore({ attendance, assignment, midterm, final });
  const average = total / 4;

  return { attendance, assignment, midterm, final, total, average };
};
```

ការពន្យល់៖

Scores ត្រូវបានបំបែកជា components គឺ attendance, assignment, midterm និង final។ Function នេះគណនាពិន្ទុសរុប និង average សម្រាប់សិស្សម្នាក់ក្នុង subject មួយ។

### 8.2 Validate and Save Score

```tsx
if (componentScore !== null && (componentScore < 0 || componentScore > component.max)) {
  toast.error(`${component.label} must be between 0 and ${component.max}`);
  return;
}

const payload = {
  student_id: studentId,
  class_id: classId,
  semester,
  week_number: weekNumber,
  subject_code: subject,
  attendance_score: attendanceScore,
  assignment_score: nextAssignment,
  midterm_score: nextMidterm,
  final_score: nextFinal,
  score,
  max_score: SCORE_MAX,
  recorded_by: user?.id ?? null,
};

supabase
  .from("subject_scores")
  .upsert(payload, { onConflict: "student_id,class_id,semester,week_number,subject_code" });
```

ការពន្យល់៖

មុនរក្សាទុកពិន្ទុ ប្រព័ន្ធពិនិត្យថាពិន្ទុមិនតិចជាង 0 និងមិនលើស max score។ បន្ទាប់មកវា upsert ទៅ table `subject_scores`។ Unique conflict key ការពារកុំឲ្យស្ទួន record សម្រាប់ subject/week ដូចគ្នា។

## 9. Timetable Page

File: `src/routes/app.timetable.tsx`

### 9.1 Time Overlap Function

```ts
function timeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}
```

ការពន្យល់៖

Function នេះពិនិត្យថា time range ពីរប៉ះគ្នាឬអត់។ វាជា logic សំខាន់សម្រាប់រក conflict រវាង teacher, room និង class schedule។

### 9.2 Save Schedule Slots

```ts
const slotRows = rows.flatMap((row) =>
  days.flatMap((day) => {
    const cell = row.cells[day];
    const hasContent =
      cleanOptional(cell.teacherId) ||
      cleanOptional(cell.teacher) ||
      cleanOptional(cell.subjectCode) ||
      cleanOptional(cell.subject) ||
      cleanOptional(cell.room);
    if (!hasContent) return [];

    return [
      {
        class_id: classId,
        day,
        start_time: row.start,
        end_time: row.end,
        room: cleanOptional(cell.room),
        teacher_id: cleanOptional(cell.teacherId),
        subject_code: cleanOptional(cell.subjectCode),
      },
    ];
  }),
);
```

ការពន្យល់៖

Schedule builder មាន rows និង days។ Code នេះបម្លែង schedule grid ទៅជា rows សម្រាប់ insert ទៅ table `timetable_slots`។ វាបញ្ចូលតែ cell ដែលមាន content ដូចជា teacher, subject ឬ room។

### 9.3 Conflict Detection

```ts
if (first.day !== second.day) continue;
if (!timeOverlaps(first.start, first.end, second.start, second.end)) continue;

if (first.teacherKey && first.teacherKey === second.teacherKey) {
  return `Teacher ${first.teacherName || second.teacherName} is busy.`;
}

if (first.roomKey && first.roomKey === second.roomKey) {
  return `Room ${first.room || second.room} is busy.`;
}
```

ការពន្យល់៖

ផ្នែកនេះពិនិត្យ schedule conflicts។ ប្រសិនបើ slot ពីរនៅថ្ងៃដូចគ្នា និងម៉ោង overlap គ្នា ប្រព័ន្ធពិនិត្យថាគ្រូឬបន្ទប់ដូចគ្នាឬអត់។ បើដូចគ្នា វាបង្ហាញ error មុន save។

## 10. Payments Page

File: `src/routes/app.payments.tsx`

### 10.1 Load Payments

```tsx
const { data: payments = [], isLoading } = useQuery({
  queryKey: ["payments", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("payments")
      .select(PAYMENT_ROW_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PaymentRow[];
  },
});
```

ការពន្យល់៖

Payments page ទាញ invoice/payment records ពី table `payments` ជាមួយព័ត៌មានសិស្ស។ `PAYMENT_ROW_SELECT` ជា select string ដែលភ្ជាប់ payment ជាមួយ student detail សម្រាប់បង្ហាញ table និង receipt។

### 10.2 Payment Summary

```tsx
const stats = useMemo(() => {
  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pending = payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount), 0);
  const overdue = payments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + Number(p.amount), 0);
  return { paid, pending, overdue };
}, [payments]);
```

ការពន្យល់៖

ផ្នែកនេះគណនាចំនួនប្រាក់ទៅតាម status: paid, pending និង overdue។ វាប្រើ `useMemo` ដើម្បីកាត់បន្ថយការគណនាឡើងវិញ ពេល `payments` មិនផ្លាស់ប្តូរ។

### 10.3 Mark Payment Paid

```tsx
const data = await markPaymentPaid({
  data: {
    accessToken,
    paymentId: id,
    method: method ?? "cash",
  },
});
```

ការពន្យល់៖

ការប្តូរ payment ទៅ `paid` ប្រើ server function `markPaymentPaid` ព្រោះវាត្រូវពិនិត្យ session និងសិទ្ធិ user។ បន្ទាប់ពី update ជោគជ័យ ប្រព័ន្ធអាចបោះពុម្ព receipt បាន។

## 11. Notifications Page

File: `src/routes/app.notifications.tsx`

### 11.1 Load and Filter Notifications

```tsx
const { data: items = [], isLoading } = useQuery({
  queryKey: ["notifications-list", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  },
});

const visibleItems = useMemo(
  () => items.filter((item) => isNotificationVisibleForRole(item, primaryRole, user?.id)),
  [items, primaryRole, user?.id],
);
```

ការពន្យល់៖

Notifications page ទាញ announcements ទាំងអស់ដែល RLS អនុញ្ញាត។ បន្ទាប់មក frontend filter ម្តងទៀតតាម role ឬ user id ដើម្បីបង្ហាញតែ notification ដែលពាក់ព័ន្ធ។

### 11.2 Insert Notification

```tsx
const richPayload = {
  title: f.title,
  body: f.body || null,
  kind: f.kind,
  target_user_id: null,
  target_role: targetRole,
  media_url: mediaUrl,
  media_type: uploadedMediaType,
  created_by: session.user.id,
};

const { error } = await supabase.from("notifications").insert(richPayload);
```

ការពន្យល់៖

Admin ឬ teacher អាចបង្កើត notification ដោយបញ្ជាក់ title, body, kind, target role និង media។ `created_by` ប្រើសម្រាប់ដឹងថា user ណាបានបង្កើត announcement។

## 12. Reports Page

File: `src/routes/app.reports.tsx`

```tsx
const [students, classes, payments, attendance] = await Promise.all([
  supabase.from("students").select("id", { count: "exact", head: true }),
  supabase.from("classes").select("id", { count: "exact", head: true }),
  supabase.from("payments").select("amount,status"),
  supabase.from("attendance").select("status"),
]);

const revenue = (payments.data ?? [])
  .filter((p) => p.status === "paid")
  .reduce((s, p) => s + Number(p.amount), 0);

const totalAtt = (attendance.data ?? []).length;
const present = (attendance.data ?? []).filter(
  (a) => a.status === "present" || a.status === "late",
).length;
const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;
```

ការពន្យល់៖

Reports page ទាញទិន្នន័យសង្ខេបសម្រាប់ report: ចំនួនសិស្ស ចំនួនថ្នាក់ ចំណូល និងវត្តមាន។ Attendance rate គិតដោយយក present និង late ជាការមានវត្តមាន។ Result ត្រូវបានបង្ហាញជា cards និងអាចបោះពុម្ព report បាន។

## 13. Roles Page

File: `src/routes/app.roles.tsx`

### 13.1 Load Roles with Profiles

```tsx
const { data: roles } = await supabase
  .from("user_roles")
  .select("id,user_id,role")
  .order("created_at", { ascending: false });

const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
const { data: profs } = userIds.length
  ? await supabase.from("profiles").select("user_id,full_name,email").in("user_id", userIds)
  : { data: [] };

const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
```

ការពន្យល់៖

Roles page ទាញ role assignments ពី table `user_roles` ហើយទាញ profile របស់ users ពាក់ព័ន្ធពី table `profiles`។ វាប្រើ `Map` ដើម្បីភ្ជាប់ role ជាមួយឈ្មោះ និង email របស់ user។

### 13.2 Assign Role

```tsx
const mut = useMutation({
  mutationFn: async () => {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: f.user_id, role: f.role });
    if (error) throw error;
  },
  onSuccess: () => {
    toast.success(t("role_assigned"));
  },
});
```

ការពន្យល់៖

Admin អាច assign role ថ្មីទៅ user តាម table `user_roles`។ Database unique constraint គួរតែការពារកុំឲ្យ user មាន role ដូចគ្នាស្ទួន។

## 14. Certificates Page

File: `src/routes/app.certificates.tsx`

### 14.1 Load Certificates

```tsx
const { data: certs = [], isLoading } = useQuery({
  queryKey: ["certificates", isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data } = await supabase
      .from("certificates")
      .select(
        "id,student_id,kind,title,issue_date,verification_code,status,students(id,student_code,full_name,full_name_km,avatar_url,date_of_birth,gender,major,class_name)",
      )
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as CertificateRow[];
  },
});
```

ការពន្យល់៖

Certificates page ទាញ certificate records ព្រមទាំង student information។ Data នេះប្រើសម្រាប់បង្ហាញ certificate list និងបោះពុម្ព certificate/transcript។

### 14.2 Issue Certificate

```tsx
const { error } = await supabase
  .from("certificates")
  .insert({ student_id: f.student_id, title: f.title, kind: f.kind });

if (error) throw error;
```

ការពន្យល់៖

ពេលចេញ certificate ប្រព័ន្ធ insert row ថ្មីទៅ table `certificates`។ `verification_code` និង `issue_date` អាចត្រូវបានកំណត់ដោយ database default ឬ logic នៅ backend។

## 15. Shared Page Pattern

Pages សំខាន់ៗភាគច្រើនប្រើ pattern ដូចខាងក្រោម៖

```tsx
const { data, isLoading } = useQuery({
  queryKey: ["module-name", role, userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("table_name").select("*");
    if (error) throw error;
    return data ?? [];
  },
});

const mutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase.from("table_name").insert(payload);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["module-name"] });
    toast.success("Saved");
  },
});
```

ការពន្យល់៖

នេះជា pattern សំខាន់ក្នុង project៖

- `useQuery` សម្រាប់ read data។
- `useMutation` សម្រាប់ create/update/delete data។
- `queryKey` សម្រាប់ cache identity។
- `invalidateQueries` សម្រាប់ refresh data បន្ទាប់ពី save/delete។
- `toast` សម្រាប់បង្ហាញ success/error message។

## 16. Summary for Presentation

ចំណុចដែលគួរនិយាយពេលពន្យល់ source code៖

- Dashboard ប្រើ parallel queries ដើម្បីបង្ហាញ statistics និង charts។
- Login flow មាន authentication និង role verification។
- `/app` layout ការពារ page ដោយពិនិត្យ user និង role។
- Students, Classes, Attendance និង Exams បង្ហាញ role-based data filtering។
- Timetable មាន conflict detection ដើម្បីការពារគ្រូ ឬបន្ទប់ជាន់ម៉ោង។
- Payments ប្រើ server function សម្រាប់ operation សំខាន់ៗដូចជា mark paid។
- Notifications គាំទ្រ target role និង media content។
- Reports និង Certificates មាន print/export pattern សម្រាប់ឯកសារផ្លូវការ។
- RLS នៅ Supabase ជា security layer សំខាន់នៅ database level។

