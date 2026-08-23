# សេចក្តីពន្យល់ Source Code សំខាន់ៗសម្រាប់ Thesis

Project: `Personal School Management System`

ឯកសារនេះសង្ខេប និងពន្យល់ចំណុច source code សំខាន់ៗរបស់ប្រព័ន្ធគ្រប់គ្រងសាលា/សាកលវិទ្យាល័យ។ គោលបំណងគឺប្រើសម្រាប់សរសេរ Thesis ជាភាសាខ្មែរ ជាពិសេសជំពូក System Analysis, System Design, Implementation, Database Design, និង Security។

## 1. ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធ

ប្រព័ន្ធនេះជាប្រព័ន្ធគ្រប់គ្រងសាលា ដែលមានការចូលប្រើតាមតួនាទីអ្នកប្រើ 3 ប្រភេទ៖

- `admin`: គ្រប់គ្រងប្រព័ន្ធទាំងមូល។
- `teacher`: គ្រប់គ្រងទិន្នន័យដែលពាក់ព័ន្ធនឹងថ្នាក់ និងមុខវិជ្ជាដែលខ្លួនបង្រៀន។
- `student`: មើលព័ត៌មានផ្ទាល់ខ្លួន កាលវិភាគ វត្តមាន ពិន្ទុ ការទូទាត់ ការជូនដំណឹង និងវិញ្ញាបនបត្រ។

មុខងារសំខាន់ៗរបស់ប្រព័ន្ធមាន៖

- Login និង authentication សម្រាប់ admin, teacher, student
- Role-based dashboard និង menu access control
- គ្រប់គ្រងសិស្ស និងគណនីសិស្ស
- គ្រប់គ្រងគ្រូ និងគណនីគ្រូ
- គ្រប់គ្រងថ្នាក់រៀន បន្ទប់រៀន មុខវិជ្ជា និងកាលវិភាគ
- កត់ត្រាវត្តមានសិស្ស និងគ្រូ
- គ្រប់គ្រងពិន្ទុប្រឡង និង subject score components
- គ្រប់គ្រងការទូទាត់ និងបោះពុម្ពវិក្កយបត្រ/បង្កាន់ដៃ
- ផ្ញើសេចក្តីជូនដំណឹងជាអត្ថបទ រូបភាព ឬវីដេអូ
- ចេញវិញ្ញាបនបត្រ និង transcript
- របាយការណ៍សម្រាប់ dashboard និងការបោះពុម្ព

## 2. បច្ចេកវិទ្យាដែលប្រើ

ប្រព័ន្ធនេះប្រើ stack ដូចខាងក្រោម៖

| ផ្នែក | បច្ចេកវិទ្យា | ការពន្យល់ |
|---|---|---|
| Frontend | React 19 + TypeScript | បង្កើត UI និង component logic |
| Routing | TanStack Router / TanStack Start | គ្រប់គ្រង route និង layout |
| Data fetching | TanStack Query | Cache និង fetch data ពី Supabase |
| Backend/Data | Supabase | Auth, PostgreSQL database, RLS policies |
| Styling | Tailwind CSS + Radix UI | រចនា UI responsive និង reusable components |
| Charts | Recharts | បង្ហាញ dashboard statistics និង analytics |
| Notifications | Sonner | Toast message សម្រាប់ success/error |
| Icons | Lucide React | Icons សម្រាប់ navigation និង buttons |
| Build tool | Vite | Development server និង production build |

Source files សំខាន់ៗ៖

- `src/routes/__root.tsx`: root layout, provider setup, metadata
- `src/router.tsx`: router configuration និង error boundary
- `src/routes/index.tsx`: public login page
- `src/routes/admin-login.tsx`: admin login page
- `src/routes/app.tsx`: protected app layout និង role guard
- `src/lib/auth.tsx`: authentication context
- `src/lib/role-access.ts`: role-based access control
- `src/integrations/supabase/client.ts`: browser Supabase client
- `src/integrations/supabase/client.server.ts`: server Supabase admin client
- `supabase/generated/full_database_setup.sql`: database schema ចម្បង
- `supabase/migrations/`: database changes និង RLS improvements

## 3. រចនាសម្ព័ន្ធ Architecture

ប្រព័ន្ធនេះប្រើ client-server architecture ដែល frontend ទាក់ទងទៅ Supabase API ដោយផ្ទាល់តាម publishable key សម្រាប់ operation ធម្មតា។ Operation ដែលត្រូវការសិទ្ធិខ្ពស់ ដូចជា create student/teacher auth account និង payment invoice ត្រូវធ្វើតាម server function ដែលប្រើ service role key នៅ server-side ប៉ុណ្ណោះ។

លំហូរទូទៅ៖

1. User បើក browser ហើយចូលទៅ login page។
2. React route បង្ហាញ form ទៅតាម portal: public ឬ admin។
3. Supabase Auth ពិនិត្យ credential។
4. ប្រព័ន្ធពិនិត្យ role ពី `user_roles` table។
5. ប្រសិនបើ role ត្រឹមត្រូវ user ត្រូវបាន redirect ទៅ `/app`។
6. `/app` layout ពិនិត្យថា user មានសិទ្ធិចូល page នោះឬអត់។
7. Page នីមួយៗ fetch data ពី Supabase table តាម role និង RLS policies។

## 4. Root Application Setup

File: `src/routes/__root.tsx`

Root route ជាកន្លែងដែលប្រព័ន្ធដាក់ provider សំខាន់ៗសម្រាប់ app ទាំងមូល៖

```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <I18nProvider>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </I18nProvider>
  </ThemeProvider>
</QueryClientProvider>
```

ការពន្យល់៖

- `QueryClientProvider`: គ្រប់គ្រង data fetching និង cache។
- `ThemeProvider`: គ្រប់គ្រង light/dark mode។
- `I18nProvider`: គ្រប់គ្រងភាសា English/Khmer។
- `AuthProvider`: គ្រប់គ្រង session, user, profile, roles។
- `Outlet`: បង្ហាញ child route។
- `Toaster`: បង្ហាញ notification message។

ចំណុច thesis: Root provider design ធ្វើឱ្យ business modules ទាំងអស់អាចប្រើ auth, language, theme និង data cache ដូចគ្នា។

## 5. Router និង Error Handling

File: `src/router.tsx`

```tsx
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
```

ការពន្យល់៖

- `routeTree`: generated route tree ពី TanStack Router។
- `scrollRestoration`: រក្សា scroll behavior ឱ្យល្អពេលប្តូរ page។
- `defaultErrorComponent`: បង្ហាញ UI ពេលមាន runtime error។

ចំណុច thesis: Router មាន centralized error boundary ដើម្បីកុំឱ្យ error នៅ module មួយធ្វើឱ្យ UI ទាំងមូល blank។

## 6. Authentication Context

File: `src/lib/auth.tsx`

Authentication state ត្រូវបានរក្សាទុកក្នុង React context។ Code សំខាន់៖

```tsx
const ROLE_PRIORITY: Role[] = ["admin", "teacher", "student"];

const primaryRole =
  (requestedRole && roles.includes(requestedRole) ? requestedRole : null) ??
  ROLE_PRIORITY.find((r) => roles.includes(r)) ??
  null;
```

ការពន្យល់៖

- User អាចមាន role ច្រើនក្នុង table `user_roles`។
- `primaryRole` ជា role សំខាន់ដែលប្រើសម្រាប់ navigation និង access control។
- ប្រសិនបើ user metadata មាន role ហើយ role នោះមានក្នុង database ប្រព័ន្ធយក role នោះជាចម្បង។
- បើមិនដូច្នោះទេ ប្រព័ន្ធយក role តាម priority: admin > teacher > student។

ការទាញ profile និង role៖

```tsx
const [profileResult, rolesResult] = await Promise.all([
  supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
  supabase.from("user_roles").select("role").eq("user_id", uid),
]);
```

ការពន្យល់៖

- `profiles`: រក្សាព័ត៌មានអ្នកប្រើដូចជា ឈ្មោះ email avatar phone។
- `user_roles`: រក្សាតួនាទីរបស់ user។
- `Promise.all` ប្រើដើម្បី fetch data ពីរ queries ពេលតែមួយ ធ្វើឱ្យលឿនជាង fetch ម្តងមួយ។

## 7. Login Flow

Files:

- `src/routes/index.tsx`
- `src/routes/admin-login.tsx`
- `src/lib/login-auth.ts`
- `src/lib/account-ids.ts`

ប្រព័ន្ធមាន login 2 ប្រភេទ៖

- Public login `/`: សម្រាប់ student និង teacher។
- Admin login `/admin-login`: សម្រាប់ administrator។

សម្រាប់ student/teacher ប្រព័ន្ធមិនបង្ខំឱ្យ user ចាំ email ពេញទេ។ វាបង្កើត internal login email ពី ID៖

```ts
export function accountLoginEmail(role: Exclude<Role, "admin">, loginId: string) {
  return schoolAccountEmail(role, loginId, UNIVERSITY_ACCOUNT_DOMAIN);
}
```

ឧទាហរណ៍៖

- Student ID: `RULE26-1234`
- Internal email: `student.rule26.1234@studentsphere.local`

ការពិនិត្យ role ក្រោយ login៖

```ts
const { data, error } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id);

const hasRole = data?.some((row) => row.role === role);
```

ការពន្យល់៖

- ក្រោយ sign in សម្រេច ប្រព័ន្ធមិនទុកចិត្តតែ password ទេ។
- វាពិនិត្យថា account នោះមាន role ត្រឹមត្រូវក្នុង database។
- បើ user ព្យាយាម login ជា teacher តែ role គឺ student ប្រព័ន្ធ sign out និងបង្ហាញ error។

ចំណុច security សម្រាប់ thesis: Authentication មានពីរជំហានគឺ credential validation និង role validation។

## 8. Protected App Layout និង Role Guard

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

- បើ user មិនទាន់ login ត្រូវ redirect ទៅ login page។
- បើ user login រួច ប៉ុន្តែ role មិនមានសិទ្ធិចូល route នោះ ត្រូវ redirect ទៅ dashboard។
- វាជា client-side protection។ Security ពិតប្រាកដនៅ database level ត្រូវបានបន្ថែមដោយ Supabase RLS។

## 9. Role-Based Access Control

File: `src/lib/role-access.ts`

```ts
const rolePaths: Record<Role, string[]> = {
  admin: ["/app", "/app/students", "/app/teachers", "..."],
  teacher: ["/app", "/app/students", "/app/classes", "..."],
  student: ["/app", "/app/students", "/app/classes", "..."],
};
```

ការពន្យល់៖

| Role | អាចចូលបាន |
|---|---|
| Admin | គ្រប់ module រួមទាំង roles, reports, payments, teachers |
| Teacher | Dashboard, students, classes, subjects, attendance, exams, timetable, notifications |
| Student | Dashboard, own profile, classes, attendance, exams, timetable, payments, notifications, certificates |

Function សំខាន់៖

```ts
export function canAccessPath(role: Role | null, pathname: string) {
  if (!role) return false;
  const allowed = rolePaths[role];
  return allowed.some((path) => {
    if (path === "/app") return pathname === "/app" || pathname === "/app/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
```

ចំណុច thesis: Access control ត្រូវបានបែងចែកច្បាស់តាម role ដើម្បីការពារទិន្នន័យ និងកាត់បន្ថយ menu ដែលមិនពាក់ព័ន្ធ។

## 10. Sidebar Navigation

File: `src/components/app/sidebar.tsx`

Navigation items៖

```ts
export const navItems = [
  { to: "/app", key: "dashboard" },
  { to: "/app/students", key: "students" },
  { to: "/app/teachers", key: "teachers" },
  { to: "/app/classes", key: "classes" },
  { to: "/app/attendance", key: "attendance" },
  { to: "/app/exams", key: "exams" },
  { to: "/app/timetable", key: "timetable" },
  { to: "/app/payments", key: "payments" },
  { to: "/app/reports", key: "reports" },
  { to: "/app/notifications", key: "notifications" },
  { to: "/app/roles", key: "roles" },
  { to: "/app/certificates", key: "certificates" },
];
```

Sidebar filter តាម role៖

```ts
function navItemsForRole(role) {
  const allowed = allowedPathSet(role);
  return navItems.filter((item) => allowed.has(item.to));
}
```

ការពន្យល់៖

- Admin ឃើញ menu គ្រប់ module។
- Teacher ឃើញតែ module ដែលពាក់ព័ន្ធនឹងការបង្រៀន។
- Student ឃើញ student portal menu។

## 11. Supabase Client

File: `src/integrations/supabase/client.ts`

Client-side Supabase key validation៖

```ts
if (key.startsWith("sb_secret_")) {
  throw new Error(
    "Invalid Supabase key. Use a publishable key or legacy anon key in the browser, not a secret key.",
  );
}
```

ការពន្យល់៖

- Browser ត្រូវប្រើ `VITE_SUPABASE_PUBLISHABLE_KEY` ឬ anon key ប៉ុណ្ណោះ។
- Secret/service role key មិនត្រូវ expose ទៅ browser។
- Code នេះជួយចាប់ configuration error មុន deploy។

Supabase client setup៖

```ts
return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

ការពន្យល់៖

- `persistSession`: user login session ត្រូវបានរក្សាទុក។
- `autoRefreshToken`: token refresh ដោយស្វ័យប្រវត្តិ។
- `Database` type ជួយ TypeScript validate table/column names។

## 12. Server Supabase Admin Client

File: `src/integrations/supabase/client.server.ts`

```ts
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
```

ការពន្យល់៖

- Service role key ប្រើសម្រាប់ trusted server operations។
- វា bypass RLS ដូច្នេះត្រូវប្រើតែ server-side។
- File នេះមិនគួរ import នៅ client UI component ឡើយ។

ចំណុច thesis: ប្រព័ន្ធបែងចែក public client និង admin server client ដើម្បីរក្សា security boundary។

## 13. Student Account Creation

File: `src/lib/student-accounts.ts`

Admin អាចបង្កើត student account តាម server function៖

```ts
export const createStudentAccount = createServerFn({ method: "POST" })
  .inputValidator((input: CreateStudentInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const password = requireString(data.student.password, "Password");
    const fullName = requireString(data.student.full_name, "Student name");
  });
```

ការពិនិត្យ admin៖

```ts
const { data: adminRole } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", authData.user.id)
  .eq("role", "admin")
  .maybeSingle();

if (!adminRole) {
  throw new Error("Only admins can create student accounts.");
}
```

ការបង្កើត Auth user៖

```ts
const { data: createdUser } = await supabaseAdmin.auth.admin.createUser({
  email: loginEmail,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    role: "student",
    login_code: studentCode,
  },
});
```

ការពន្យល់៖

- Admin session ត្រូវត្រឹមត្រូវ។
- Password ត្រូវមានយ៉ាងតិច 6 characters។
- Student ID ត្រូវ unique។
- ប្រព័ន្ធបង្កើត Auth user, profile, user role, និង student row។
- ប្រសិនបើ insert student row បរាជ័យ ប្រព័ន្ធ delete Auth user ដែលបានបង្កើត ដើម្បីកុំឱ្យមាន orphan account។

ចំណុច thesis: Server function ផ្តល់ transaction-like behavior និងការពារការបង្កើត account ដោយ unauthorized user។

## 14. Teacher Account Creation and Update

File: `src/lib/teacher-accounts.ts`

Teacher account creation មានលំហូរដូច student ប៉ុន្តែប្រើ `staff_code` ជា teacher ID។

Code ពិនិត្យ staff code មិនស្ទួន៖

```ts
async function requireUniqueTeacherCode(value?: string | null, excludeTeacherId?: string) {
  const code = requireString(value, "Teacher ID").toUpperCase();
  let query = supabaseAdmin.from("teachers").select("id").eq("staff_code", code).limit(1);
  if (excludeTeacherId) query = query.neq("id", excludeTeacherId);
}
```

ការពន្យល់៖

- ពេលបង្កើត teacher ថ្មី ត្រូវពិនិត្យ `staff_code` មិនស្ទួន។
- ពេល update teacher អាច exclude teacher id បច្ចុប្បន្ន ដើម្បីអនុញ្ញាតឱ្យរក្សា code ដដែល។
- ប្រព័ន្ធ update Auth email និង metadata ប្រសិនបើ staff code ឬ name ផ្លាស់ប្តូរ។

## 15. Dashboard Module

File: `src/routes/app.index.tsx`

Dashboard ទាញទិន្នន័យសរុប៖

```ts
const [students, teachers, classes, payments] = await Promise.all([
  supabase.from("students").select("id", { count: "exact", head: true }),
  supabase.from("teachers").select("id", { count: "exact", head: true }),
  supabase.from("classes").select("id", { count: "exact", head: true }),
  supabase.from("payments").select("amount,status,paid_date,created_at"),
]);
```

ការពន្យល់៖

- រាប់ចំនួនសិស្ស គ្រូ និងថ្នាក់។
- គណនាចំណូលពី payments ដែល status = `paid`។
- ប្រើ Recharts សម្រាប់ revenue trend, attendance trend, subject distribution។
- Student dashboard បង្ហាញទិន្នន័យផ្ទាល់ខ្លួន ដូចជា timetable, notifications, attendance summary, scores។

ចំណុច thesis: Dashboard ជា central summary page សម្រាប់ management decision-making។

## 16. Students Module

File: `src/routes/app.students.tsx`

មុខងារសំខាន់៖

- បង្ហាញបញ្ជីសិស្ស
- ស្វែងរកតាម ID, name, major, class
- បន្ថែមសិស្ស និងបង្កើត login account
- កែព័ត៌មានសិស្ស
- Upload avatar
- បោះពុម្ពបញ្ជីសិស្ស
- Student អាចមើលព័ត៌មានផ្ទាល់ខ្លួន

ការកំណត់ class ដោយ capacity៖

```ts
function nextAvailableClassName({ classRows, classCounts, major, shift }) {
  return classRows.find((classRow) => {
    const used = classCounts.get(classRow.name) ?? 0;
    return used < (classRow.capacity ?? 0);
  })?.name ?? "";
}
```

ការពន្យល់៖

- ពេលបន្ថែមសិស្ស ប្រព័ន្ធអាចជ្រើស class ដែលនៅមានសមត្ថភាពទទួល។
- វាជួយកាត់បន្ថយការបញ្ចូល class ដោយដៃខុស។

Upload avatar៖

- File រូបភាពត្រូវបាន compress។
- ប្រព័ន្ធព្យាយាម update avatar តាម RPC `set_student_avatar`។
- បើ RPC មិនបាន ប្រព័ន្ធ fallback ទៅ update table។

## 17. Teachers Module

File: `src/routes/app.teachers.tsx`

មុខងារសំខាន់៖

- បង្ហាញបញ្ជីគ្រូ
- បន្ថែម teacher account
- កែព័ត៌មានគ្រូ
- លុប teacher record
- បង្ហាញ schedule របស់គ្រូ
- Filter teacher តាម faculty/subject

Teacher schedule matching ប្រើ `teacher_id`, teacher name, និង encoded timetable cell ដើម្បីស្វែងរក slot ដែលពាក់ព័ន្ធនឹងគ្រូ។

ចំណុច thesis: Teachers module ភ្ជាប់ human resource management ជាមួយ academic scheduling។

## 18. Classes Module

File: `src/routes/app.classes.tsx`

មុខងារសំខាន់៖

- បង្កើតថ្នាក់
- Assign teacher ទៅ class
- កំណត់ subject, room, semester, academic year, capacity
- មើលសិស្សក្នុងថ្នាក់
- បោះពុម្ព class student list
- Upsert subject ពេលបង្កើត class ដែលមាន subject ថ្មី

Code insert class៖

```ts
const { error } = await supabase.from("classes").insert({
  name,
  subject_code,
  teacher_id,
  room,
  semester,
  academic_year,
  capacity,
});
```

ការពន្យល់៖

- `classes` ជា core academic entity។
- It connects teacher, subject, room, timetable, attendance, exams, and scores។

## 19. Classrooms Module

File: `src/routes/app.classrooms.tsx`

មុខងារសំខាន់៖

- បង្ហាញបន្ទប់រៀន
- ពិនិត្យ free/busy តាមថ្ងៃ និងម៉ោង
- គណនា availability ពី timetable slots
- Filter តាម building, room, condition, time

Logic សំខាន់៖

```ts
function overlapsTimeRange(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}
```

ការពន្យល់៖

- បន្ទប់ត្រូវបានចាត់ទុកថា busy ប្រសិនបើ slot time overlap ជាមួយ selected time។
- Module នេះជួយ administrator កំណត់ schedule ដោយមិនប៉ះទង្គិចបន្ទប់។

## 20. Subjects Module

File: `src/routes/app.subjects.tsx`

មុខងារសំខាន់៖

- បង្ហាញមុខវិជ្ជា
- បន្ថែម subject
- កែ subject
- លុប subject
- Search តាម subject id, name, description

Normalize subject id៖

```ts
function normalizeSubjectId(value: string) {
  return value.trim().replace(/\s+/g, "_");
}
```

ការពន្យល់៖

- Subject ID ត្រូវបានធ្វើឱ្យមាន format ស្ថេរភាព។
- ឧទាហរណ៍ `C Programming` អាចក្លាយជា `C_Programming`។

## 21. Attendance Module

File: `src/routes/app.attendance.tsx`

មុខងារសំខាន់៖

- កត់ត្រាវត្តមានសិស្សតាម semester, week, day, subject
- Status មាន `present`, `absent`, `late`, `excused`
- Teacher អាចគ្រប់គ្រងតែ class/subject ដែលពាក់ព័ន្ធ
- Student អាចមើល attendance របស់ខ្លួន
- បោះពុម្ព attendance report

ការរក attendance cell៖

```ts
const attendanceFor = (studentId: string, week: number, day: number) => {
  return attendanceRows.find(
    (row) =>
      row.student_id === studentId &&
      row.week_number === week &&
      row.day_of_week === day,
  )?.status;
};
```

ការរក្សាទុក attendance៖

```ts
await supabase.from("attendance").upsert(rows, {
  onConflict: "student_id,class_id,semester,week_number,day_of_week,subject_code",
});
```

ការពន្យល់៖

- `upsert` ធ្វើឱ្យប្រព័ន្ធ update បើ record មានរួច ឬ insert បើមិនទាន់មាន។
- Unique key ការពារកុំឱ្យមាន attendance record ស្ទួន។

## 22. Exams and Scores Module

File: `src/routes/app.exams.tsx`

មុខងារសំខាន់៖

- បញ្ចូលពិន្ទុតាមមុខវិជ្ជា
- Score components រួមមាន attendance, assignment, midterm, final
- គណនាពិន្ទុសរុប
- បង្ហាញ ranking និង average
- បោះពុម្ព score report

ការគណនាពិន្ទុសរុប៖

```ts
function totalSubjectScore({
  attendance_score,
  assignment_score,
  midterm_score,
  final_score,
}) {
  return (
    Number(attendance_score ?? 0) +
    Number(assignment_score ?? 0) +
    Number(midterm_score ?? 0) +
    Number(final_score ?? 0)
  );
}
```

ការពន្យល់៖

- ពិន្ទុត្រូវបានបំបែកជាផ្នែក ដើម្បីឱ្យប្រព័ន្ធអាចគណនាលទ្ធផលយ៉ាងច្បាស់។
- Database មាន constraints កំណត់ max score សម្រាប់ component នីមួយៗ។

## 23. Timetable Module

File: `src/routes/app.timetable.tsx`

មុខងារសំខាន់៖

- បង្កើតកាលវិភាគតាម class
- កំណត់ថ្ងៃ ម៉ោង គ្រូ មុខវិជ្ជា បន្ទប់
- ពិនិត្យ conflict រវាង teacher, room, class និង time
- បោះពុម្ព schedule report
- Teacher និង student មើល schedule ដែលពាក់ព័ន្ធនឹងខ្លួន

Function ពិនិត្យ time overlap៖

```ts
function timeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}
```

Encoded timetable cell៖

File: `src/lib/timetable-cell.ts`

```ts
export const TIMETABLE_CELL_PREFIX = "__STUDENTSPHERE_TIMETABLE_CELL__:";

export function encodeTimetableCell(payload: TimetableCellPayload) {
  return `${TIMETABLE_CELL_PREFIX}${JSON.stringify(payload)}`;
}
```

ការពន្យល់៖

- Timetable cell អាចរក្សាទុកព័ត៌មានលម្អិតដូចជា room, teacher, subject, note។
- ប្រព័ន្ធ encode payload ជា JSON string ក្នុង field `room` ដើម្បីរក្សា backward compatibility ជាមួយ schema ចាស់។

## 24. Payments Module

Files:

- `src/routes/app.payments.tsx`
- `src/lib/payment-invoices.ts`

មុខងារសំខាន់៖

- បង្កើត invoice
- Mark payment as paid
- គណនា balance តាមឆ្នាំ/ឆមាស
- បង្ហាញ QR payment modal
- បោះពុម្ព receipt ជាភាសាខ្មែរ
- បម្លែងចំនួនទឹកប្រាក់ទៅពាក្យខ្មែរ

Server function បង្កើត invoice៖

```ts
export const createPaymentInvoice = createServerFn({ method: "POST" })
  .handler(async ({ data }) => {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
  });
```

Mark paid៖

```ts
await supabaseAdmin
  .from("payments")
  .update({
    status: "paid",
    method: data.method ?? "mobile",
    paid_date: new Date().toISOString().slice(0, 10),
  })
  .eq("id", paymentId);
```

ការពន្យល់៖

- Admin អាចគ្រប់គ្រង payment សិស្សផ្សេងៗ។
- Student អាចបង្កើត invoice ឬ mark payment របស់ខ្លួនតាម logic ដែល server function អនុញ្ញាត។
- Payment status មាន `pending`, `paid`, `overdue`, `cancelled`។

## 25. Notifications Module

File: `src/routes/app.notifications.tsx`

មុខងារសំខាន់៖

- Admin/teacher អាចផ្ញើ announcement
- Target អាចជា all, student, teacher, admin ឬ user ជាក់លាក់
- Support media: image/video
- Student និង teacher ឃើញតែ notification ដែលពាក់ព័ន្ធ

Insert notification៖

```ts
await supabase.from("notifications").insert({
  target_role,
  title,
  body,
  kind,
  media_url,
  media_type,
  created_by: user.id,
});
```

ការពន្យល់៖

- `target_role` ប្រើសម្រាប់ broadcast ទៅ role មួយ។
- `target_user_id` ប្រើសម្រាប់ផ្ញើទៅ user ម្នាក់។
- `media_url` និង `media_type` ប្រើសម្រាប់ announcement មានរូបភាព/វីដេអូ។

## 26. Reports Module

File: `src/routes/app.reports.tsx`

មុខងារសំខាន់៖

- បង្ហាញ total students, total classes, revenue, attendance rate
- បង្កើត student register report
- បោះពុម្ព report

ការគណនា attendance rate៖

```ts
const totalAtt = attendance.length;
const present = attendance.filter(
  (row) => row.status === "present" || row.status === "late",
).length;
const attendanceRate = totalAtt ? Math.round((present / totalAtt) * 100) : 0;
```

ការពន្យល់៖

- `present` និង `late` ត្រូវបានរាប់ថាមានវត្តមាន។
- Attendance rate ជួយវាស់ participation របស់សិស្ស។

## 27. Roles Module

File: `src/routes/app.roles.tsx`

មុខងារសំខាន់៖

- មើលបញ្ជី user roles
- Assign role
- Delete role
- Reset/update password modal

Delete role៖

```ts
await supabase.from("user_roles").delete().eq("id", id);
```

Assign role៖

```ts
await supabase.from("user_roles").insert({
  user_id: f.user_id,
  role: f.role,
});
```

ការពន្យល់៖

- `user_roles` ជា table សំខាន់សម្រាប់ authorization។
- Unique constraint `(user_id, role)` ការពារកុំឱ្យ role ស្ទួន។

## 28. Certificates Module

File: `src/routes/app.certificates.tsx`

មុខងារសំខាន់៖

- ចេញវិញ្ញាបនបត្រ
- បង្កើត verification code
- Print certificate
- Load transcript rows ពី `subject_scores`
- បង្ហាញលទ្ធផលតាម semester

Insert certificate៖

```ts
await supabase.from("certificates").insert({
  student_id: f.student_id,
  title: f.title,
  kind: f.kind,
});
```

ការពន្យល់៖

- Certificate row ភ្ជាប់ទៅ student។
- `verification_code` បង្កើតដោយ database default។
- Transcript ទាញពិន្ទុពី `subject_scores` ដើម្បីបោះពុម្ពជាឯកសារផ្លូវការ។

## 29. Internationalization Khmer/English

File: `src/lib/i18n.tsx`

ប្រព័ន្ធមាន dictionary 2 ភាសា៖

```ts
export type Lang = "en" | "km";

const dict = {
  dashboard: { en: "Dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
  students: { en: "Students", km: "សិស្ស" },
  teachers: { en: "Teachers", km: "គ្រូបង្រៀន" },
};
```

ការពន្យល់៖

- Key តែមួយមាន translation ជា English និង Khmer។
- UI components ហៅ `t("students")` ដើម្បីបង្ហាញ label តាមភាសាដែល user ជ្រើស។
- ប្រព័ន្ធប្រើ font `Noto Sans Khmer` ដើម្បីបង្ហាញអក្សរខ្មែរបានត្រឹមត្រូវ។

ចំណុច thesis: I18n design ធ្វើឱ្យប្រព័ន្ធសមរម្យសម្រាប់បរិបទកម្ពុជា។

## 30. Database Design

Database ចម្បងស្ថិតនៅ `supabase/generated/full_database_setup.sql` និង migrations ក្នុង `supabase/migrations/`។

### 30.1 Tables សំខាន់ៗ

| Table | គោលបំណង |
|---|---|
| `profiles` | ព័ត៌មានមូលដ្ឋានរបស់ auth user |
| `user_roles` | កំណត់ role របស់ user |
| `students` | ព័ត៌មានសិស្ស |
| `teachers` | ព័ត៌មានគ្រូ |
| `classes` | ព័ត៌មានថ្នាក់ |
| `enrollments` | ទំនាក់ទំនង student-class |
| `attendance` | វត្តមានសិស្ស |
| `teacher_attendance` | វត្តមានគ្រូ |
| `exams` | ព័ត៌មានការប្រឡង |
| `scores` | ពិន្ទុតាម exam ចាស់ |
| `subject_scores` | ពិន្ទុតាម subject/week/semester |
| `subjects` | មុខវិជ្ជា |
| `timetable_slots` | កាលវិភាគ |
| `payments` | ការទូទាត់ |
| `notifications` | សេចក្តីជូនដំណឹង |
| `certificates` | វិញ្ញាបនបត្រ |

### 30.2 Relationships សំខាន់ៗ

- `profiles.user_id` references `auth.users.id`
- `user_roles.user_id` references `auth.users.id`
- `students.user_id` references `auth.users.id`
- `teachers.user_id` references `auth.users.id`
- `classes.teacher_id` references `teachers.id`
- `enrollments.student_id` references `students.id`
- `enrollments.class_id` references `classes.id`
- `attendance.student_id` references `students.id`
- `attendance.class_id` references `classes.id`
- `subject_scores.student_id` references `students.id`
- `subject_scores.class_id` references `classes.id`
- `timetable_slots.class_id` references `classes.id`
- `payments.student_id` references `students.id`
- `certificates.student_id` references `students.id`

### 30.3 Example Table: Students

```sql
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  enrollment_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status public.student_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

ការពន្យល់៖

- `id`: primary key។
- `user_id`: link ទៅ Supabase Auth user។
- `student_code`: លេខសម្គាល់សិស្ស unique។
- `status`: ស្ថានភាពសិស្ស active/inactive/graduated/suspended។
- `created_at`, `updated_at`: សម្រាប់ audit trail។

### 30.4 Example Table: Attendance

```sql
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migrations បន្ថែម fields៖

- `semester`
- `week_number`
- `subject_code`
- `day_of_week`

ការពន្យល់៖

- Attendance ត្រូវបានកត់ត្រាតាម student, class, semester, week, day, subject។
- Unique constraint ការពារ duplicated attendance cell។

### 30.5 Example Table: Subject Scores

```sql
CREATE TABLE public.subject_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  semester TEXT NOT NULL DEFAULT 'Semester 1',
  week_number INTEGER NOT NULL DEFAULT 1,
  subject_code TEXT NOT NULL DEFAULT 'Subject 1',
  attendance_score NUMERIC(6,2),
  assignment_score NUMERIC(6,2),
  midterm_score NUMERIC(6,2),
  final_score NUMERIC(6,2),
  score NUMERIC(6,2),
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100
);
```

ការពន្យល់៖

- ពិន្ទុត្រូវបានបំបែកជា components។
- `score` ជាពិន្ទុសរុប។
- Constraints កំណត់ range ដើម្បីរក្សាគុណភាពទិន្នន័យ។

## 31. Row Level Security (RLS)

Tables សំខាន់ៗត្រូវបាន enable RLS៖

```sql
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
```

Function ពិនិត្យ role៖

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
```

ការពន្យល់៖

- RLS ការពារទិន្នន័យនៅ database level។
- `has_role` ប្រើ `SECURITY DEFINER` ដើម្បីជៀសវាង RLS recursion ពេលពិនិត្យ role។
- Even if user bypasses frontend, database policies នៅតែការពារទិន្នន័យ។

## 32. Teacher Scope

File: `src/lib/teacher-scope.ts`

Teacher scope កំណត់ថា teacher ម្នាក់អាចមើល/គ្រប់គ្រង class និង subject ណាខ្លះ។

```ts
export async function findTeacherClassScope(user) {
  const localTeacher = await findCurrentTeacher(user);
  const { data } = await supabase.rpc("current_teacher_classes");
  return {
    teacher,
    classes,
    classIds,
    classNames,
    subjectCodes,
  };
}
```

ការពន្យល់៖

- ប្រព័ន្ធស្វែងរក teacher record តាម `user_id`, `staff_code`, ឬ email។
- បន្ទាប់មកវាស្វែងរក classes ដែល teacher បាន assign។
- វាក៏អាច match timetable slot ដើម្បីរក class/subject បន្ថែម។

ចំណុច thesis: Teacher scope ជួយអនុវត្ត principle of least privilege។

## 33. Demo/Offline Data Pattern

Route files មួយចំនួនមាន functions ដូចជា៖

```ts
function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}
```

ការពន្យល់៖

- ប្រព័ន្ធអាចរក្សា demo data ក្នុង browser `localStorage`។
- វាមានប្រយោជន៍សម្រាប់ testing UI ពេលមិនទាន់ភ្ជាប់ Supabase។
- Production data នៅតែប្រើ Supabase។

## 34. Print/Export Pattern

Modules ដូចជា Students, Classes, Attendance, Exams, Payments, Certificates មាន function `printDocument` ឬ `printReceipt`។

Pattern ទូទៅ៖

1. Generate HTML string។
2. Open print window។
3. Write HTML/CSS។
4. Call browser print។

ចំណុច thesis: ប្រព័ន្ធអាចបង្កើត report ផ្លូវការ ដោយមិនចាំបាច់ export តាម external reporting tool។

## 35. Database Diagrams និង Thesis Assets

Project មាន diagram assets រួចហើយក្នុង folder `supabase/`៖

- `supabase/er-diagram.svg`: ER diagram
- `supabase/use-case-diagram.svg`: Use case diagram
- `supabase/context-diagram.svg`: Context diagram
- `supabase/context-flow-diagram.svg`: Context/data flow
- `supabase/dfd-level-0.svg`: DFD level 0
- `supabase/process-diagram.svg`: Process diagram
- `supabase/database-schema.svg`: Database schema diagram
- `supabase/table-images/`: រូបភាព table សម្រាប់ presentation/thesis

Scripts សម្រាប់ generate diagram៖

- `scripts/generate-er-diagram-svg.mjs`
- `scripts/generate-database-schema-svg.mjs`
- `scripts/generate-context-flow-diagram-svg.mjs`
- `scripts/generate-process-diagram-svg.mjs`
- `scripts/generate-presentation-table-images.mjs`

ចំណុច thesis: អាចយក diagrams ទាំងនេះទៅដាក់ក្នុង chapter System Design និង Database Design។

## 36. Module Summary សម្រាប់ Thesis

| Module | File | ពន្យល់ខ្លី |
|---|---|---|
| Login | `src/routes/index.tsx`, `src/routes/admin-login.tsx` | ចូលប្រើតាម role |
| Dashboard | `src/routes/app.index.tsx` | Summary និង analytics |
| Students | `src/routes/app.students.tsx` | គ្រប់គ្រង student profile/account |
| Teachers | `src/routes/app.teachers.tsx` | គ្រប់គ្រង teacher profile/account |
| Classes | `src/routes/app.classes.tsx` | គ្រប់គ្រង class និង assignment |
| Classrooms | `src/routes/app.classrooms.tsx` | ពិនិត្យ free/busy rooms |
| Subjects | `src/routes/app.subjects.tsx` | គ្រប់គ្រង subject catalog |
| Attendance | `src/routes/app.attendance.tsx` | កត់ត្រាវត្តមានតាម week/day/subject |
| Exams | `src/routes/app.exams.tsx` | គ្រប់គ្រងពិន្ទុ និង ranking |
| Timetable | `src/routes/app.timetable.tsx` | បង្កើត schedule និង conflict detection |
| Payments | `src/routes/app.payments.tsx` | Invoice, receipt, QR payment |
| Reports | `src/routes/app.reports.tsx` | Summary report និង print |
| Notifications | `src/routes/app.notifications.tsx` | Announcement text/media |
| Roles | `src/routes/app.roles.tsx` | Role assignment |
| Certificates | `src/routes/app.certificates.tsx` | Certificate និង transcript |

## 37. Security Summary

ប្រព័ន្ធមាន security layers ដូចខាងក្រោម៖

1. Supabase Auth សម្រាប់ username/password authentication។
2. Role verification បន្ទាប់ពី sign in។
3. Client-side route guard ក្នុង `/app` layout។
4. Role-based navigation ដើម្បីបង្ហាញតែ menu ដែលអាចប្រើបាន។
5. Supabase RLS policies ដើម្បីការពារទិន្នន័យនៅ database level។
6. Server functions សម្រាប់ admin operations ដែលត្រូវការ service role key។
7. Client key validation ដើម្បីការពារកុំឱ្យប្រើ secret key នៅ browser។
8. Unique constraints និង check constraints ដើម្បីរក្សា data integrity។

## 38. Data Integrity Summary

Database ប្រើ constraints សំខាន់ៗ៖

- Unique student code: `students.student_code`
- Unique teacher code: `teachers.staff_code`
- Unique user role: `(user_id, role)`
- Unique enrollment: `(student_id, class_id)`
- Unique attendance cell: `(student_id, class_id, semester, week_number, day_of_week, subject_code)`
- Unique subject score: `(student_id, class_id, semester, week_number, subject_code)`
- Foreign keys with cascade/set null ដើម្បីរក្សា relationship integrity
- Score range checks សម្រាប់ attendance, assignment, midterm, final, total score

## 39. Suggested Thesis Wording

អាចសរសេរនៅក្នុង Thesis ដូចនេះ៖

> ប្រព័ន្ធគ្រប់គ្រងសាលានេះត្រូវបានអភិវឌ្ឍដោយប្រើ React, TypeScript និង Supabase។ ប្រព័ន្ធត្រូវបានរចនាឡើងជាម៉ូឌុល ដោយមានម៉ូឌុលសម្រាប់គ្រប់គ្រងសិស្ស គ្រូ ថ្នាក់រៀន មុខវិជ្ជា វត្តមាន ពិន្ទុ កាលវិភាគ ការទូទាត់ សេចក្តីជូនដំណឹង និងវិញ្ញាបនបត្រ។ ការចូលប្រើប្រព័ន្ធត្រូវបានគ្រប់គ្រងតាមតួនាទីអ្នកប្រើ ដូចជា admin, teacher និង student។ ប្រព័ន្ធបានប្រើ Row Level Security របស់ Supabase ដើម្បីការពារទិន្នន័យនៅកម្រិត database ហើយប្រើ server functions សម្រាប់ប្រតិបត្តិការដែលត្រូវការសិទ្ធិខ្ពស់។

> ផ្នែក frontend ប្រើ TanStack Router សម្រាប់ route management និង TanStack Query សម្រាប់ data fetching។ Root layout បានផ្តល់ providers សំខាន់ៗដូចជា authentication, language, theme និង query cache។ Backend ប្រើ Supabase Auth សម្រាប់ login និង PostgreSQL tables សម្រាប់រក្សាទុកទិន្នន័យ។ Database schema ត្រូវបានរចនាជា relational model ដែលមាន foreign key និង constraints ដើម្បីធានាគុណភាពទិន្នន័យ។

## 40. របៀប Run Project

Install dependencies៖

```sh
npm install
```

Run development server៖

```sh
npm run dev
```

Build production៖

```sh
npm run build
```

Environment variables សំខាន់ៗ៖

```sh
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

ចំណាំ៖ `SUPABASE_SERVICE_ROLE_KEY` ត្រូវរក្សាទុក server-side ប៉ុណ្ណោះ មិនត្រូវដាក់ជាមួយ prefix `VITE_` ទេ។

