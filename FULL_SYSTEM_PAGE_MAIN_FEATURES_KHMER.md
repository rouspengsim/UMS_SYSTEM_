# Full System Page Main Features

Project: `Personal School Management System`

ឯកសារនេះពន្យល់ **main features របស់ page ទាំងអស់ក្នុងប្រព័ន្ធ** សម្រាប់ប្រើក្នុង thesis book ឬ presentation។ រាល់ page មាន source file, អ្វីដែល user អាចធ្វើបាន, main source code ខ្លីៗ និង explanation។

## 1. Public Login Page

Source file: `src/routes/index.tsx`

### Main Features

- Student និង teacher អាច login ដោយប្រើ ID និង password។
- Admin ត្រូវ login តាម admin portal ដាច់ដោយឡែក។
- User អាចជ្រើស role មុន login។
- ប្រព័ន្ធពិនិត្យ login attempts និង lock បណ្តោះអាសន្នបើព្យាយាមខុសច្រើនដង។
- Login ជោគជ័យនឹង redirect ទៅ `/app`។
- គាំទ្រភាសា Khmer/English និង UI branding របស់សាលា។

### Main Source Code

```tsx
const { data, error } = await signInWithRoleCredentials(
  expectedRole,
  loginId,
  email,
  password,
);

await verifySignedInRole(data.user, expectedRole);
await refresh();
await router.invalidate();
navigate({ to: "/app" });
```

### Explanation

Login page មិនត្រឹមតែពិនិត្យ email/password ទេ។ វាក៏ verify role បន្ទាប់ពី login ដើម្បីធានាថា student មិនអាចចូលជា teacher ឬ admin បាន។

## 2. Admin Login Page

Source file: `src/routes/admin-login.tsx`

### Main Features

- Admin មាន login URL ដាច់ដោយឡែក `/admin-login`។
- Page នេះប្រើ login form ដូច public login ប៉ុន្តែ force role ជា `admin`។
- កំណត់ meta `robots: noindex,nofollow` ដើម្បីមិនឲ្យ search engine index admin login page។

### Main Source Code

```tsx
export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: `Admin sign in - ${UNIVERSITY_SHORT_NAME}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return <LoginPage portal="admin" />;
}
```

### Explanation

Admin login page ជា restricted portal សម្រាប់ administrator ប៉ុណ្ណោះ។ វាជួយបំបែកការចូលប្រើ admin ចេញពី student និង teacher។

## 3. Protected App Layout

Source file: `src/routes/app.tsx`

### Main Features

- ការពារ pages ទាំងអស់ក្រោម `/app`។
- បើ user មិនទាន់ login នឹង redirect ទៅ login page។
- បើ user login រួច ប៉ុន្តែ role មិនមានសិទ្ធិចូល page នោះ នឹង redirect ទៅ dashboard។
- បង្ហាញ sidebar, topbar និង mobile navigation។

### Main Source Code

```tsx
if (!loading && !user) {
  navigate({ to: "/" });
}

if (!loading && user && primaryRole && !canAccessPath(primaryRole, pathname)) {
  navigate({ to: "/app" });
}
```

### Explanation

Layout នេះជាស្រទាប់ការពារ frontend។ វាពិនិត្យ authentication និង role permission មុនអនុញ្ញាតឲ្យ user ចូល page ផ្សេងៗ។

## 4. Dashboard Page

Source file: `src/routes/app.index.tsx`

### Main Features for Admin

- មើលចំនួនសិស្សសរុប។
- មើលចំនួនគ្រូសរុប។
- មើលចំនួនថ្នាក់សកម្ម។
- មើលចំណូលសរុប។
- មើល revenue chart តាមខែ។
- មើល attendance trend ក្នុង 7 ថ្ងៃចុងក្រោយ។
- មើល subject mix chart។
- មើល recent students។
- មើល recent payments។

### Main Features for Teacher

- មើល profile summary របស់គ្រូ។
- មើលថ្នាក់ដែលខ្លួនបង្រៀន។
- មើលចំនួនសិស្សក្នុងថ្នាក់ដែលទទួលបន្ទុក។
- មើល attendance percentage របស់គ្រូ។
- មើល upcoming exams។
- មើល timetable ថ្ងៃនេះ។
- មើល notifications។

### Main Features for Student

- មើល profile summary របស់សិស្ស។
- មើល class និង major។
- មើល total subjects។
- មើល GPA/average score។
- មើល attendance percentage។
- មើល fee status។
- មើល upcoming exams។
- មើល today schedule។
- មើល notifications។
- ចូលទៅ My Information។

### Main Source Code

```tsx
const [students, teachers, classes, payments] = await Promise.all([
  supabase.from("students").select("id", { count: "exact", head: true }),
  supabase.from("teachers").select("id", { count: "exact", head: true }),
  supabase.from("classes").select("id", { count: "exact", head: true }),
  supabase.from("payments").select("amount,status,paid_date,created_at"),
]);

const paidRows = (payments.data ?? []).filter((p) => p.status === "paid");
const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
```

### Explanation

Dashboard ជា summary page សម្រាប់មើលស្ថានភាពប្រព័ន្ធយ៉ាងឆាប់រហ័ស។ Content នៅលើ dashboard ប្រែប្រួលតាម role របស់ user។

## 5. Students Page

Source file: `src/routes/app.students.tsx`

### Main Features

- Admin អាចមើលបញ្ជីសិស្សទាំងអស់។
- Teacher អាចមើលតែសិស្សក្នុងថ្នាក់ដែលខ្លួនបង្រៀន។
- Student អាចមើលព័ត៌មានផ្ទាល់ខ្លួន និង classmates ដែលអនុញ្ញាត។
- ស្វែងរកសិស្សតាមឈ្មោះ student code major ឬ class។
- Filter តាម status, major និង class។
- Add student និងបង្កើត login account។
- Edit student information។
- Upload student avatar។
- Delete student record។
- Print student list report។

### Main Source Code

```tsx
if (primaryRole === "teacher") {
  const scope = await findTeacherClassScope(user);
  const classNames = scope?.classNames ?? [];

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .in("class_name", classNames)
    .order("created_at", { ascending: false });
}
```

### Explanation

Students page ប្រើ role-based filtering។ Teacher មិនមើលឃើញសិស្សទាំងអស់ទេ គឺមើលតែសិស្សដែលស្ថិតក្នុង class ដែលខ្លួនទទួលបន្ទុក។

## 6. Teachers Page

Source file: `src/routes/app.teachers.tsx`

### Main Features

- មើលបញ្ជីគ្រូទាំងអស់។
- Add teacher account។
- Edit teacher information។
- Delete teacher record។
- មើល teacher staff code, subject, faculty, department និង contact។
- មើល schedule របស់គ្រូ។
- Filter/search teacher តាមព័ត៌មានសំខាន់ៗ។

### Main Source Code

```tsx
const { data: teachers = [], isLoading } = useQuery({
  queryKey: ["teachers", isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});
```

### Explanation

Teachers page គ្រប់គ្រងទិន្នន័យគ្រូ និង account គ្រូ។ Admin អាចបន្ថែម កែប្រែ ឬលុបគ្រូបាន។

## 7. Classes Page

Source file: `src/routes/app.classes.tsx`

### Main Features

- មើលបញ្ជីថ្នាក់។
- Add class ថ្មី។
- Assign teacher ទៅ class។
- កំណត់ subject, room, semester, academic year និង capacity។
- មើលចំនួនសិស្សក្នុង class។
- មើលសិស្សក្នុង class។
- Delete class។
- Print class student list។
- Student មើល class របស់ខ្លួន។
- Teacher មើល class ដែលខ្លួនបង្រៀន។

### Main Source Code

```tsx
const { data: classes = [], isLoading } = useQuery({
  queryKey: ["classes", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    if (isTeacher) {
      const scope = await findTeacherClassScope(user);
      return scope?.classes ?? [];
    }

    const { data, error } = await supabase
      .from("classes")
      .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)");
    if (error) throw error;
    return data ?? [];
  },
});
```

### Explanation

Classes page គ្រប់គ្រងទំនាក់ទំនងរវាង class, subject, teacher, room និង students។ វាជា core page សម្រាប់ academic management។

## 8. Classrooms Page

Source file: `src/routes/app.classrooms.tsx`

### Main Features

- មើលបញ្ជីបន្ទប់រៀន។
- មើល building និង room number។
- មើល device និង condition របស់បន្ទប់។
- Search room។
- Filter តាម building។
- Filter តាម room status។
- ពិនិត្យ free/busy room តាមថ្ងៃ និងម៉ោង។
- មើល schedule conflict របស់បន្ទប់ពី timetable។

### Main Source Code

```tsx
function overlapsTimeRange(
  slotStart: string | null | undefined,
  slotEnd: string | null | undefined,
  queryStart: string,
  queryEnd: string,
) {
  const start = formatTime(slotStart);
  const end = formatTime(slotEnd);
  return !!start && !!end && start < queryEnd && end > queryStart;
}
```

### Explanation

Classrooms page ប្រើ timetable slots ដើម្បីពិនិត្យថាបន្ទប់មួយ free ឬ busy ក្នុងម៉ោងដែល user ជ្រើស។ Logic សំខាន់គឺ time overlap checking។

## 9. Subjects Page

Source file: `src/routes/app.subjects.tsx`

### Main Features

- មើលបញ្ជីមុខវិជ្ជា។
- Search subject តាម subject id, subject name ឬ description។
- Admin អាច add subject។
- Admin អាច edit subject។
- Admin អាច delete subject។
- Teacher មើលតែ subject ដែលពាក់ព័ន្ធនឹង class ខ្លួន។

### Main Source Code

```tsx
const { data: subjects = [], isLoading } = useQuery({
  queryKey: ["subjects", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    if (isTeacher) {
      const scope = await findTeacherClassScope(user);
      const subjectCodes = scope?.subjectCodes ?? [];
      return supabase.from("subjects").select("*").in("subject_id", subjectCodes);
    }

    const { data, error } = await supabase
      .from("subjects")
      .select("id,subject_id,subject_name,description,created_at,updated_at")
      .order("subject_id", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});
```

### Explanation

Subjects page គ្រប់គ្រង catalog មុខវិជ្ជា។ Admin មានសិទ្ធិ CRUD ពេញលេញ ខណៈ teacher មើលតែ subject ដែលខ្លួនបង្រៀន។

## 10. Attendance Page

Source file: `src/routes/app.attendance.tsx`

### Main Features

- Teacher/Admin អាចកត់ attendance សិស្ស។
- Student អាចមើល attendance របស់ខ្លួន។
- កំណត់ semester, week, day, class និង subject។
- Status មាន present, absent, late និង excused។
- មើល attendance grid តាម week/day។
- Update attendance cell ម្តងមួយ។
- Delete/clear attendance record។
- Print attendance report។

### Main Source Code

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

### Explanation

Attendance page ប្រើ `upsert` ដើម្បី insert ឬ update attendance។ Unique conflict key ការពារកុំឲ្យ record ស្ទួនក្នុង student/class/week/day/subject ដូចគ្នា។

## 11. Exams and Scores Page

Source file: `src/routes/app.exams.tsx`

### Main Features

- មើល exam list។
- បញ្ចូលពិន្ទុតាម subject។
- ពិន្ទុបែងចែកជា attendance, assignment, midterm និង final។
- គណនាពិន្ទុសរុប។
- គណនា average score។
- Teacher អាចបញ្ចូលពិន្ទុតែ subject/class ដែលខ្លួនបង្រៀន។
- Student អាចមើលពិន្ទុរបស់ខ្លួន។
- Print score report។

### Main Source Code

```tsx
const total = totalSubjectScore({
  attendance,
  assignment,
  midterm,
  final,
});

await supabase.from("subject_scores").upsert(payload, {
  onConflict: "student_id,class_id,semester,week_number,subject_code",
});
```

### Explanation

Exams page គ្រប់គ្រងពិន្ទុសិស្សតាម subject។ ពិន្ទុត្រូវបានបែងចែកជា components ដើម្បីងាយគណនា និងបង្ហាញលទ្ធផលលម្អិត។

## 12. Timetable Page

Source file: `src/routes/app.timetable.tsx`

### Main Features

- Admin អាចបង្កើតកាលវិភាគ។
- កំណត់ class, teacher, subject, room, day និង time។
- ពិនិត្យ conflict រវាង teacher និង room។
- Save timetable slots។
- Delete latest schedule។
- Print schedule។
- Teacher មើល timetable បង្រៀនរបស់ខ្លួន។
- Student មើល timetable របស់ class ខ្លួន។

### Main Source Code

```tsx
function timeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

if (first.teacherKey && first.teacherKey === second.teacherKey) {
  return `Teacher ${first.teacherName || second.teacherName} is busy.`;
}

if (first.roomKey && first.roomKey === second.roomKey) {
  return `Room ${first.room || second.room} is busy.`;
}
```

### Explanation

Timetable page មាន conflict detection។ ប្រសិនបើគ្រូ ឬបន្ទប់ត្រូវបានប្រើនៅថ្ងៃ និងម៉ោងជាន់គ្នា ប្រព័ន្ធបង្ហាញ error មុន save។

## 13. Payments Page

Source file: `src/routes/app.payments.tsx`

### Main Features

- មើលបញ្ជី payments/invoices។
- មើល paid, pending និង overdue amount។
- Admin អាចបង្កើត invoice សម្រាប់សិស្ស។
- Student អាចមើល invoice របស់ខ្លួន។
- Mark payment as paid។
- ជ្រើស payment method ដូចជា cash/mobile។
- បង្ហាញ QR payment modal។
- Print receipt ជាភាសាខ្មែរ។
- មើល balance តាមឆ្នាំសិក្សា។

### Main Source Code

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

### Explanation

Payments page គ្រប់គ្រង invoice និង receipt។ Summary cards បង្ហាញចំនួនប្រាក់ paid, pending និង overdue ដើម្បីជួយគ្រប់គ្រងហិរញ្ញវត្ថុ។

## 14. Notifications Page

Source file: `src/routes/app.notifications.tsx`

### Main Features

- មើលសេចក្តីជូនដំណឹង។
- Admin/teacher អាចបង្កើត announcement។
- កំណត់ target audience: all, student ឬ teacher។
- Support body text។
- Support image/video media។
- Student/teacher មើលតែ notification ដែលពាក់ព័ន្ធនឹង role ខ្លួន។

### Main Source Code

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

### Explanation

Notifications page អនុញ្ញាតឲ្យបង្កើត announcement ទៅ audience ជាក់លាក់។ `target_role` បញ្ជាក់ថា notification នោះផ្ញើទៅ role ណា។

## 15. Reports Page

Source file: `src/routes/app.reports.tsx`

### Main Features

- មើល total students។
- មើល total classes។
- មើល revenue summary។
- មើល attendance rate។
- មើល student register report។
- Print report។
- ប្រើសម្រាប់ management summary។

### Main Source Code

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
```

### Explanation

Reports page សង្ខេប data ពី modules ច្រើន ដើម្បីបង្ហាញរបាយការណ៍សម្រាប់អ្នកគ្រប់គ្រង។ វាជួយធ្វើ decision-making។

## 16. Roles Page

Source file: `src/routes/app.roles.tsx`

### Main Features

- មើល user role assignments។
- Assign role ទៅ user។
- Remove role។
- មើល user profile ជាមួយ role។
- Update/reset password តាម modal។
- ការពារ admin role មិនឲ្យលុបងាយៗ។

### Main Source Code

```tsx
const { data: roles } = await supabase
  .from("user_roles")
  .select("id,user_id,role")
  .order("created_at", { ascending: false });

const { error } = await supabase
  .from("user_roles")
  .insert({ user_id: f.user_id, role: f.role });
```

### Explanation

Roles page គ្រប់គ្រង authorization របស់ប្រព័ន្ធ។ Admin អាច assign role ដូចជា teacher ឬ student ទៅ user បាន។

## 17. Certificates Page

Source file: `src/routes/app.certificates.tsx`

### Main Features

- មើលបញ្ជី certificates។
- Issue certificate សម្រាប់សិស្ស។
- ជ្រើស student, title និង certificate kind។
- Generate verification code។
- Print certificate។
- Load transcript rows ពី subject scores។
- Student អាចមើល certificate របស់ខ្លួន។

### Main Source Code

```tsx
const { data } = await supabase
  .from("certificates")
  .select(
    "id,student_id,kind,title,issue_date,verification_code,status,students(id,student_code,full_name,major,class_name)",
  )
  .order("created_at", { ascending: false });

await supabase
  .from("certificates")
  .insert({ student_id: f.student_id, title: f.title, kind: f.kind });
```

### Explanation

Certificates page ប្រើសម្រាប់ចេញវិញ្ញាបនបត្រ និង transcript។ Certificate អាច print ជាឯកសារផ្លូវការ ហើយមាន verification code សម្រាប់ពិនិត្យភាពត្រឹមត្រូវ។

## 18. Sidebar and Navigation

Source file: `src/components/app/sidebar.tsx`

### Main Features

- បង្ហាញ menu modules ក្នុងប្រព័ន្ធ។
- Filter menu តាម role។
- Admin ឃើញ menu គ្រប់ module។
- Teacher ឃើញតែ menu ពាក់ព័ន្ធនឹងការបង្រៀន។
- Student ឃើញតែ menu សម្រាប់ student portal។
- មាន desktop sidebar និង mobile navigation។

### Main Source Code

```tsx
function navItemsForRole(role: ReturnType<typeof useAuth>["primaryRole"]) {
  const allowed = allowedPathSet(role);
  return navItems.filter((item) => allowed.has(item.to));
}
```

### Explanation

Navigation ត្រូវបានគ្រប់គ្រងតាម role។ User មិនឃើញ menu ដែលខ្លួនមិនមានសិទ្ធិប្រើ។

## 19. Full System Summary

ប្រព័ន្ធនេះមាន pages សំខាន់ៗគ្រប់គ្រាន់សម្រាប់ school management system។ Admin អាចគ្រប់គ្រងទិន្នន័យសាលាទាំងមូល។ Teacher អាចគ្រប់គ្រងការងារបង្រៀនរបស់ខ្លួន ដូចជា class, attendance និង scores។ Student អាចមើលព័ត៌មានសិក្សារបស់ខ្លួន ដូចជា profile, attendance, scores, timetable, payments និង certificates។

### Short Thesis Paragraph

ប្រព័ន្ធគ្រប់គ្រងសាលារៀននេះត្រូវបានបែងចែកជា pages ឬ modules ដាច់ដោយឡែក ដើម្បីឲ្យការគ្រប់គ្រងមានភាពងាយស្រួល។ Dashboard បង្ហាញព័ត៌មានសង្ខេបរបស់ប្រព័ន្ធ។ Students និង Teachers pages ប្រើសម្រាប់គ្រប់គ្រងទិន្នន័យអ្នកសិក្សា និងបុគ្គលិកបង្រៀន។ Classes, Subjects, Classrooms និង Timetable pages គ្រប់គ្រងផ្នែកសិក្សា និងកាលវិភាគ។ Attendance និង Exams pages គ្រប់គ្រងវត្តមាន និងលទ្ធផលសិក្សា។ Payments page គ្រប់គ្រងការទូទាត់។ Notifications page ផ្ញើសេចក្តីជូនដំណឹង។ Reports និង Certificates pages ប្រើសម្រាប់បង្កើតឯកសារផ្លូវការ។ ប្រព័ន្ធទាំងមូលដំណើរការតាម role-based access control ដើម្បីធានាសុវត្ថិភាព និងភាពត្រឹមត្រូវនៃទិន្នន័យ។

