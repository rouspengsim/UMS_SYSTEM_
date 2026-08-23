# Source Code Part by Part ជាភាសាខ្មែរ

Project: `Personal School Management System`

ឯកសារនេះបំបែក source code សំខាន់ៗជាផ្នែកៗ ដោយមាន code snippet និងសេចក្តីសង្ខេបជាភាសាខ្មែរ។ គោលបំណងគឺជួយពន្យល់ផ្នែក Implementation ក្នុង thesis ឬការធ្វើ presentation។

ចំណាំ៖ snippets ខាងក្រោមជាការដកស្រង់ផ្នែកសំខាន់ៗ មិនមែន source code ទាំងមូលទេ។ សម្រាប់ source code ពេញ សូមមើល file path ដែលបានបញ្ជាក់ក្នុងផ្នែកនីមួយៗ។

## Part 1: Project Configuration

File: `package.json`

```json
{
  "name": "personal-school-management-system",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

សង្ខេប៖

`package.json` ជា configuration មូលដ្ឋានរបស់ project។ វាកំណត់ scripts សម្រាប់ run development server, build production, preview និង lint code។ Project នេះប្រើ Vite ជា build tool ហើយប្រើ TypeScript/React សម្រាប់ frontend។

## Part 2: Root Application Setup

File: `src/routes/__root.tsx`

```tsx
function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );

  return (
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
  );
}
```

សង្ខេប៖

ផ្នែកនេះជាចំណុចចាប់ផ្តើមរបស់ application។ វាដាក់ providers សំខាន់ៗដូចជា `QueryClientProvider` សម្រាប់ data fetching cache, `ThemeProvider` សម្រាប់ theme, `I18nProvider` សម្រាប់ភាសា Khmer/English និង `AuthProvider` សម្រាប់ authentication។ `Outlet` គឺកន្លែងបង្ហាញ page ដែលត្រូវនឹង route បច្ចុប្បន្ន។

## Part 3: Router and Page Metadata

File: `src/routes/__root.tsx`

```tsx
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${UNIVERSITY_SHORT_NAME} — ${UNIVERSITY_SYSTEM_NAME}` },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
```

សង្ខេប៖

TanStack Router ប្រើ `createRootRoute` ដើម្បីកំណត់ root route របស់ប្រព័ន្ធ។ ផ្នែក `head` កំណត់ metadata ដូចជា charset, viewport, title និង stylesheet។ `notFoundComponent` បង្ហាញទំព័រ 404 នៅពេល user បើក route ដែលមិនមាន។

## Part 4: Supabase Client

File: `src/integrations/supabase/client.ts`

```ts
function createSupabaseClient() {
  const SUPABASE_URL = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY = readEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  validateSupabaseKey(SUPABASE_PUBLISHABLE_KEY, projectRef);

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
```

សង្ខេប៖

Code នេះបង្កើត Supabase client សម្រាប់ frontend។ វាអាន environment variables, ពិនិត្យ key, ហើយបើក session persistence ដើម្បីឲ្យ user មិនចាំបាច់ login ម្តងទៀតរាល់ពេល refresh page។ `createClient<Database>` ជួយឲ្យ TypeScript ស្គាល់ table និង column របស់ database។

## Part 5: Supabase Key Validation

File: `src/integrations/supabase/client.ts`

```ts
function validateSupabaseKey(key: string, projectRef: string) {
  if (key.startsWith("sb_publishable_")) return;

  if (key.startsWith("sb_secret_")) {
    throw new Error(
      "Invalid Supabase key. Use a publishable key or legacy anon key in the browser, not a secret key.",
    );
  }

  const keyPayload = decodeJwtPayload(key);
  const keyRole = keyPayload?.role;

  if (keyRole !== "anon") {
    throw new Error("Invalid Supabase legacy anon key role.");
  }
}
```

សង្ខេប៖

ផ្នែកនេះជួយការពារ security ដោយមិនអនុញ្ញាតឲ្យប្រើ secret key នៅ browser។ Browser គួរប្រើ publishable key ឬ anon key ប៉ុណ្ណោះ។ Service role key ត្រូវប្រើតែ server-side ព្រោះវាអាច bypass Row Level Security។

## Part 6: Authentication Context

File: `src/lib/auth.tsx`

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
  };
}
```

សង្ខេប៖

`AuthProvider` គ្រប់គ្រងស្ថានភាព login របស់ user ទូទាំង application។ វារក្សាទុក session, user, profile, roles និង loading state។ Component ណាដែលនៅក្រោម provider នេះអាចប្រើ `useAuth()` ដើម្បីយកព័ត៌មាន user និង role បាន។

## Part 7: Load Profile and Roles

File: `src/lib/auth.tsx`

```tsx
const loadAuxData = async (uid: string, fallbackRole: Role | null = null) => {
  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
  ]);

  const loadedRoles =
    rolesResult.error || !rolesResult.data
      ? []
      : ((rolesResult.data ?? []) as { role: Role }[]).map((r) => r.role);

  setProfile(profileResult.error ? null : ((profileResult.data as Profile | null) ?? null));
  setRoles(loadedRoles.length > 0 ? loadedRoles : fallbackRole ? [fallbackRole] : []);
};
```

សង្ខេប៖

ក្រោយ login ប្រព័ន្ធទាញ profile ពី table `profiles` និង role ពី table `user_roles`។ ការប្រើ `Promise.all` ធ្វើឲ្យ query ទាំងពីររត់ស្របគ្នា ដូច្នេះលឿនជាង query ម្តងមួយ។ Role ដែលបានទាញនេះប្រើសម្រាប់គ្រប់គ្រង menu និង access control។

## Part 8: Primary Role Selection

File: `src/lib/auth.tsx`

```tsx
const ROLE_PRIORITY: Role[] = ["admin", "teacher", "student"];

const requestedRole = metadataRole(user);
const primaryRole =
  (requestedRole && roles.includes(requestedRole) ? requestedRole : null) ??
  ROLE_PRIORITY.find((r) => roles.includes(r)) ??
  null;
```

សង្ខេប៖

User ម្នាក់អាចមាន role ច្រើន។ Code នេះជ្រើស role សំខាន់មួយសម្រាប់ប្រើក្នុង UI និង route guard។ ប្រសិនបើ metadata មាន role ហើយ role នោះមានក្នុង database វានឹងយក role នោះ។ បើមិនដូច្នោះទេ វាជ្រើសតាម priority គឺ admin, teacher, student។

## Part 9: Login Email from Student or Teacher ID

File: `src/lib/account-ids.ts`

```ts
function normalizeLoginId(loginId: string) {
  return loginId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function schoolAccountEmail(role: Exclude<Role, "admin">, loginId: string, domain: string) {
  return `${role}.${normalizeLoginId(loginId)}@${domain}`;
}

export function accountLoginEmail(role: Exclude<Role, "admin">, loginId: string) {
  return schoolAccountEmail(role, loginId, UNIVERSITY_ACCOUNT_DOMAIN);
}
```

សង្ខេប៖

សិស្ស និងគ្រូមិនចាំបាច់ចាំ email ពេញទេ។ ប្រព័ន្ធយក student ID ឬ teacher ID មកបម្លែងជា internal email ដូចជា `student.rule26.1234@studentsphere.local`។ វាជួយឲ្យ login form សាមញ្ញសម្រាប់អ្នកប្រើ។

## Part 10: Login and Role Verification

File: `src/lib/login-auth.ts`

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

សង្ខេប៖

Admin login ដោយ email និង password។ Student/teacher login ដោយ ID និង password ហើយប្រព័ន្ធបម្លែង ID ទៅជា email candidates។ វាក៏អាចគាំទ្រ legacy domain ដើម្បីឲ្យ account ចាស់នៅតែ login បាន។

## Part 11: Verify Signed In Role

File: `src/lib/login-auth.ts`

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

សង្ខេប៖

ក្រោយ Supabase Auth ពិនិត្យ password បានត្រឹមត្រូវ ប្រព័ន្ធនៅតែពិនិត្យ role ម្តងទៀត។ ប្រសិនបើ user login ជា teacher ប៉ុន្តែ database មិនមាន role teacher វានឹង sign out ហើយបង្ហាញ error។ នេះជួយការពារការចូលប្រើខុស portal។

## Part 12: Protected App Layout

File: `src/routes/app.tsx`

```tsx
function AppLayout() {
  const { user, loading, primaryRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
}
```

សង្ខេប៖

`AppLayout` ជា protected layout សម្រាប់ pages នៅក្រោម `/app`។ បើ user មិនទាន់ login វា redirect ទៅ login page។ បើ user មាន role ប៉ុន្តែមិនមានសិទ្ធិចូល route នោះ វា redirect ទៅ dashboard។

## Part 13: Role Based Access Control

File: `src/lib/role-access.ts`

```ts
const rolePaths: Record<Role, string[]> = {
  admin: ["/app", "/app/students", "/app/teachers", "/app/classes"],
  teacher: ["/app", "/app/students", "/app/classes", "/app/attendance"],
  student: ["/app", "/app/students", "/app/classes", "/app/payments"],
};

export function canAccessPath(role: Role | null, pathname: string) {
  if (!role) return false;
  const allowed = rolePaths[role];
  return allowed.some((path) => {
    if (path === "/app") return pathname === "/app" || pathname === "/app/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
```

សង្ខេប៖

ផ្នែកនេះកំណត់ថា role នីមួយៗអាចចូល page ណាខ្លះ។ Admin អាចចូល module ច្រើនជាងគេ។ Teacher អាចចូល module ដែលពាក់ព័ន្ធនឹងការបង្រៀន។ Student អាចចូល module សម្រាប់មើលព័ត៌មានផ្ទាល់ខ្លួន។

## Part 14: Sidebar Navigation by Role

File: `src/components/app/sidebar.tsx`

```tsx
export const navItems: NavItem[] = [
  { to: "/app", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/app/students", icon: Users, key: "students" },
  { to: "/app/teachers", icon: GraduationCap, key: "teachers" },
  { to: "/app/classes", icon: School, key: "classes" },
  { to: "/app/attendance", icon: CalendarCheck, key: "attendance" },
  { to: "/app/payments", icon: Wallet, key: "payments" },
];

function navItemsForRole(role: ReturnType<typeof useAuth>["primaryRole"]) {
  const allowed = allowedPathSet(role);
  return navItems.filter((item) => allowed.has(item.to));
}
```

សង្ខេប៖

Sidebar មាន menu items សម្រាប់ modules ទាំងអស់ ប៉ុន្តែ `navItemsForRole` filter menu តាម role។ ដូច្នេះ user មើលឃើញតែ menu ដែលខ្លួនមានសិទ្ធិប្រើ។ វាជួយឲ្យ UI ស្អាត និងកាត់បន្ថយការច្រឡំ។

## Part 15: Student Account Creation

File: `src/lib/student-accounts.ts`

```ts
export const createStudentAccount = createServerFn({ method: "POST" })
  .inputValidator((input: CreateStudentInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const password = requireString(data.student.password, "Password");
    const fullName = requireString(data.student.full_name, "Student name");
  });
```

សង្ខេប៖

ការបង្កើត account សិស្សធ្វើនៅ server function ព្រោះត្រូវប្រើសិទ្ធិខ្ពស់ក្នុង Supabase Auth។ Admin បញ្ចូលព័ត៌មានសិស្ស និង password បន្ទាប់មក server function បង្កើត Auth user, profile, role និង student record។

## Part 16: Payment Invoice Server Function

File: `src/lib/payment-invoices.ts`

```ts
export const createPaymentInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePaymentInvoiceInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Session");
    const studentId = requireString(data.studentId, "Student");
    const invoiceNumber = requireString(data.invoiceNumber, "Invoice number");
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
  });
```

សង្ខេប៖

Payment invoice ត្រូវបានបង្កើតតាម server function ដើម្បីគ្រប់គ្រងសិទ្ធិ និងការពារទិន្នន័យ។ Code ពិនិត្យ session, student id, invoice number និង amount។ ប្រសិនបើ amount មិនត្រឹមត្រូវ វាបញ្ឈប់ operation មុន insert ទៅ database។

## Part 17: Mark Payment as Paid

File: `src/lib/payment-invoices.ts`

```ts
const { data: paidPayment, error: updateError } = await supabaseAdmin
  .from("payments")
  .update({
    status: "paid",
    method: data.method ?? "mobile",
    paid_date: new Date().toISOString().slice(0, 10),
  })
  .eq("id", paymentId)
  .select(PAYMENT_ROW_SELECT)
  .single();
```

សង្ខេប៖

ពេល user ឬ admin បញ្ជាក់ថាបានទូទាត់រួច ប្រព័ន្ធ update status ទៅ `paid`, កំណត់ payment method និងកាលបរិច្ឆេទ paid date។ `PAYMENT_ROW_SELECT` ទាញព័ត៌មាន payment ជាមួយព័ត៌មានសិស្ស ដើម្បីប្រើបង្ហាញ receipt ឬ UI។

## Part 18: Teacher Scope

File: `src/lib/teacher-scope.ts`

```ts
export async function findTeacherClassScope(user: SupabaseUser | null | undefined) {
  const localTeacher = await findCurrentTeacher(user);

  let rpcClasses: CurrentTeacherClassRow[] = [];
  try {
    const { data, error } = await (supabase as unknown as CurrentTeacherClassesRpcClient).rpc(
      "current_teacher_classes",
    );
    if (error) throw error;
    rpcClasses = ((data ?? []) as CurrentTeacherClassRow[]).map(normalizeClassRow);
  } catch {
    rpcClasses = [];
  }
}
```

សង្ខេប៖

Teacher scope កំណត់ថា teacher ម្នាក់អាចមើល class និង subject ណាខ្លះ។ វាស្វែងរក teacher record បច្ចុប្បន្ន ហើយហៅ RPC `current_teacher_classes` ដើម្បីយក classes ដែល teacher មានសិទ្ធិគ្រប់គ្រង។ ប្រសិនបើ RPC មានបញ្ហា វាមាន fallback logic ដើម្បីកុំឲ្យ UI ខូច។

## Part 19: Classes Module

File: `src/routes/app.classes.tsx`

```ts
function readDemoClasses(): ClassRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_CLASSES_KEY);
    return raw ? (JSON.parse(raw) as ClassRow[]) : [];
  } catch {
    return [];
  }
}
```

សង្ខេប៖

Classes module គ្រប់គ្រងថ្នាក់រៀន, subject, teacher, room, semester និង capacity។ Code ខាងលើបង្ហាញ pattern សម្រាប់ demo data ដោយរក្សាទុកក្នុង browser `localStorage`។ Pattern នេះជួយ test UI បាន ទោះ Supabase មិនទាន់មាន data គ្រប់គ្រាន់ក៏ដោយ។

## Part 20: Print Report Pattern

File: `src/routes/app.classes.tsx`

```ts
function printDocument(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    toast.error("Allow pop-ups to print this report.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}
```

សង្ខេប៖

Modules មួយចំនួនប្រើ pattern ដូចគ្នាសម្រាប់ print report។ ប្រព័ន្ធបង្កើត HTML report, បើក window ថ្មី, សរសេរ document ចូល ហើយហៅ browser print។ វាត្រូវបានប្រើសម្រាប់បោះពុម្ព class list, attendance report, score report, receipt និង certificate។

## Part 21: Attendance Status

File: `src/routes/app.attendance.tsx`

```ts
type Status = "present" | "absent" | "late" | "excused";

const STATUS_LABELS: Record<Status, string> = {
  present: "P",
  absent: "A",
  late: "L",
  excused: "E",
};
```

សង្ខេប៖

Attendance module កំណត់ status 4 ប្រភេទគឺ present, absent, late និង excused។ វាបង្ហាញជា shortcut letters ដូចជា P, A, L, E ដើម្បីឲ្យ teacher កត់វត្តមានបានលឿន។

## Part 22: Attendance Class Filtering

File: `src/routes/app.attendance.tsx`

```ts
function uniqueAttendanceClasses(classes: AttendanceClass[]) {
  const byId = new Map<string, AttendanceClass>();
  classes.forEach((classRow) => {
    if (!classRow.id || !classRow.name) return;
    const existing = byId.get(classRow.id);
    byId.set(classRow.id, {
      ...classRow,
      majors: Array.from(new Set([...(existing?.majors ?? []), ...classRow.majors])),
    });
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
```

សង្ខេប៖

Code នេះជួយបំបាត់ class ស្ទួនក្នុង attendance page។ វាប្រើ `Map` ដើម្បីរក្សា class តែមួយតាម id ហើយបញ្ចូល majors ជា unique set។ នេះមានប្រយោជន៍ពេល data មកពីប្រភពច្រើន ដូចជា classes table, enrollments និង timetable។

## Part 23: Timetable Cell Encoding

File: `src/lib/timetable-cell.ts`

```ts
export const TIMETABLE_CELL_PREFIX = "__STUDENTSPHERE_TIMETABLE_CELL__:";

export function encodeTimetableCell(payload: TimetableCellPayload) {
  return `${TIMETABLE_CELL_PREFIX}${JSON.stringify(payload)}`;
}
```

សង្ខេប៖

Timetable cell អាចរក្សាទុកព័ត៌មានបន្ថែមដូចជា teacher, subject, room និង note។ Code នេះ encode payload ទៅជា JSON string ដែលមាន prefix ពិសេស។ វាអនុញ្ញាតឲ្យប្រព័ន្ធបន្ថែមទិន្នន័យថ្មីដោយនៅតែសម្របជាមួយ schema ចាស់។

## Part 24: Khmer and English Translation

File: `src/lib/i18n.tsx`

```tsx
export type Lang = "en" | "km";

const dict = {
  dashboard: { en: "Dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
  students: { en: "Students", km: "សិស្ស" },
  teachers: { en: "Teachers", km: "គ្រូបង្រៀន" },
};
```

សង្ខេប៖

ប្រព័ន្ធគាំទ្រភាសា English និង Khmer ដោយប្រើ dictionary។ UI components អាចហៅ function `t("students")` ដើម្បីបង្ហាញពាក្យតាមភាសាដែល user ជ្រើស។ នេះធ្វើឲ្យប្រព័ន្ធសមស្របសម្រាប់អ្នកប្រើនៅកម្ពុជា។

## Part 25: Database and Migrations

Folder: `supabase/migrations/`

```sql
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
```

សង្ខេប៖

Supabase database ប្រើ migrations ដើម្បីកំណត់ schema និង security rules។ Row Level Security ជួយការពារទិន្នន័យនៅកម្រិត database។ ទោះ user ព្យាយាមហៅ API ដោយផ្ទាល់ ក៏ database policies នៅតែពិនិត្យថា user មានសិទ្ធិឬអត់។

## Part 26: Summary for Thesis

ប្រព័ន្ធនេះត្រូវបានរចនាជា modular school management system។ Frontend ប្រើ React, TypeScript, TanStack Router និង TanStack Query។ Backend និង database ប្រើ Supabase Auth, PostgreSQL និង Row Level Security។ មុខងារសំខាន់ៗរួមមាន login តាម role, dashboard, students, teachers, classes, attendance, exams, timetable, payments, notifications, reports និង certificates។

ចំណុចសំខាន់សម្រាប់សរសេរ thesis៖

- Authentication ប្រើ Supabase Auth ហើយបន្ថែម role verification។
- Authorization គ្រប់គ្រងដោយ `user_roles`, route guard និង RLS policies។
- UI ត្រូវបានបំបែកជា route modules និង reusable components។
- Data fetching ប្រើ Supabase client និង TanStack Query។
- Admin operations ដែលត្រូវការ service role key ត្រូវបានដាក់នៅ server functions។
- System គាំទ្រភាសាខ្មែរ និងអង់គ្លេស។
- Reports និង certificates អាច print បានពី browser។

