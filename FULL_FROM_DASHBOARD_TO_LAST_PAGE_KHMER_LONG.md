# ការពន្យល់ Source Code ពី Dashboard រហូតដល់ទំព័រចុងក្រោយ

Project: `StudentSphere Pro`

ឯកសារនេះពន្យល់ពីមុខងារសំខាន់ៗរបស់ទំព័រនីមួយៗក្នុងប្រព័ន្ធ ចាប់ពី Dashboard រហូតដល់ Certificates។ ការពន្យល់ត្រូវបានរៀបចំជាភាសាខ្មែរ ដោយមាន source code ខ្លីៗ និងពន្យល់តាម style សម្រាប់ដាក់ក្នុង thesis book ឬ presentation។

## ១. Dashboard Page

Dashboard Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.index.tsx`។ ទំព័រនេះជាទំព័រដំបូងបន្ទាប់ពីអ្នកប្រើ Login ចូលទៅក្នុងប្រព័ន្ធ។ វាមានតួនាទីបង្ហាញព័ត៌មានសង្ខេបរបស់ប្រព័ន្ធ ដូចជា ចំនួនសិស្ស ចំនួនគ្រូ ចំនួនថ្នាក់ ចំណូល ការចូលរៀន កាលវិភាគថ្ងៃនេះ និងសេចក្តីជូនដំណឹង។

```tsx
export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: pageTitle("Dashboard") }] }),
  component: Dashboard,
});
```

កូដនេះប្រើ `createFileRoute` ដើម្បីកំណត់ route សម្រាប់ Dashboard Page នៅលើ path `/app/`។ ប្រព័ន្ធក៏កំណត់ page title ជា `Dashboard` ដោយប្រើ `pageTitle` ដើម្បីឱ្យ browser tab បង្ហាញឈ្មោះទំព័របានត្រឹមត្រូវ។

```tsx
const [students, teachers, classes, payments] = await Promise.all([
  supabase.from("students").select("id", { count: "exact", head: true }),
  supabase.from("teachers").select("id", { count: "exact", head: true }),
  supabase.from("classes").select("id", { count: "exact", head: true }),
  supabase.from("payments").select("amount,status,paid_date,created_at"),
]);
```

កូដនេះប្រើ `Promise.all` ដើម្បីទាញទិន្នន័យច្រើនប្រភេទក្នុងពេលតែមួយពី Supabase។ វាទាញចំនួនសិស្សពីតារាង `students` ចំនួនគ្រូពីតារាង `teachers` ចំនួនថ្នាក់ពីតារាង `classes` និងទិន្នន័យបង់ប្រាក់ពីតារាង `payments`។ ការប្រើ `Promise.all` ជួយឱ្យការទាញទិន្នន័យលឿនជាងការទាញម្តងមួយៗ។

```tsx
const paidRows = (payments.data ?? []).filter((p) => p.status === "paid");
const totalRevenue = paidRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
```

កូដនេះគណនាចំណូលសរុបដោយយកតែ payment ដែលមាន status ជា `paid`។ បន្ទាប់មកប្រើ `reduce` ដើម្បីបូកចំនួនប្រាក់ទាំងអស់ចូលគ្នា។ លទ្ធផលនេះត្រូវបានបង្ហាញនៅលើ Dashboard ជា total revenue។

Dashboard ក៏បង្ហាញ content ខុសគ្នាតាម role របស់អ្នកប្រើ។ Admin អាចមើលស្ថិតិទូទៅរបស់សាលា។ Teacher អាចមើលថ្នាក់ដែលខ្លួនបង្រៀន កាលវិភាគ និង notifications។ Student អាចមើលព័ត៌មានផ្ទាល់ខ្លួន កាលវិភាគ ប្រឡង វត្តមាន និងស្ថានភាពបង់ថ្លៃ។

## ២. Students Page

Students Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.students.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រងព័ត៌មានសិស្សទាំងអស់ក្នុងប្រព័ន្ធ។ Admin អាចបន្ថែម កែប្រែ លុប មើលព័ត៌មានលម្អិត Upload រូបភាព និងបង្កើត account សម្រាប់សិស្ស។ Teacher អាចមើលសិស្សតាមថ្នាក់ដែលខ្លួនបង្រៀន។ Student អាចមើលព័ត៌មានផ្ទាល់ខ្លួន។

```tsx
export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: pageTitle("Students") }] }),
  component: StudentsPage,
});
```

កូដនេះបង្កើត route សម្រាប់ Students Page នៅ path `/app/students`។ នៅពេលអ្នកប្រើចុច menu Students នៅ sidebar ប្រព័ន្ធនឹងបង្ហាញ component `StudentsPage`។

```tsx
type StudentRow = {
  id: string;
  user_id?: string | null;
  student_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  major: string | null;
  class_name: string | null;
  status: "active" | "inactive" | "graduated" | "suspended";
};
```

កូដនេះកំណត់ទម្រង់ទិន្នន័យរបស់សិស្សម្នាក់។ វាជួយឱ្យ TypeScript ដឹងថា student record មាន fields អ្វីខ្លះ ដូចជា `student_code`, `full_name`, `major`, `class_name` និង `status`។ ការកំណត់ type បែបនេះធ្វើឱ្យការសរសេរកូដមានសុវត្ថិភាព និងកាត់បន្ថយកំហុសពេលប្រើទិន្នន័យ។

```tsx
const className = generateClassName(major, studyYear, shift, classNumber);
const enrolled = students.filter((student) => student.class_name === className).length;
if (enrolled < capacity) return className;
```

កូដនេះប្រើសម្រាប់កំណត់ថ្នាក់ឱ្យសិស្សដោយស្វ័យប្រវត្តិ។ ប្រព័ន្ធបង្កើតឈ្មោះថ្នាក់តាម major, study year, shift និងលេខថ្នាក់។ បន្ទាប់មកវាពិនិត្យចំនួនសិស្សដែលមានក្នុងថ្នាក់នោះ។ ប្រសិនបើថ្នាក់នៅមានកន្លែងទំនេរ ប្រព័ន្ធនឹង assign សិស្សទៅថ្នាក់នោះ។

```tsx
function compressAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    reject(new Error("Please choose an image file."));
    return;
  }
}
```

កូដនេះប្រើសម្រាប់ពិនិត្យ និងបង្រួមរូបភាពសិស្សមុន upload។ ប្រព័ន្ធពិនិត្យថា file ដែលជ្រើសរើសជា image ឬអត់។ បន្ទាប់មកវាបង្រួមទំហំរូបភាព ដើម្បីកាត់បន្ថយទំហំ file និងធ្វើឱ្យការបង្ហាញ avatar លើប្រព័ន្ធលឿនជាងមុន។

Students Page មានសារៈសំខាន់ណាស់ ព្រោះវារក្សាទុកព័ត៌មានផ្ទាល់ខ្លួន និងព័ត៌មានសិក្សារបស់សិស្ស។ ទិន្នន័យពី page នេះត្រូវបានប្រើបន្តនៅក្នុង Attendance, Exams, Payments, Reports និង Certificates។

## ៣. Teachers Page

Teachers Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.teachers.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រងព័ត៌មានគ្រូ និង account របស់គ្រូ។ Admin អាចបន្ថែមគ្រូថ្មី កែប្រែព័ត៌មានគ្រូ លុបគ្រូ មើលកាលវិភាគគ្រូ និង reset password របស់គ្រូបាន។

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

កូដនេះប្រើ `useQuery` ដើម្បីទាញបញ្ជីគ្រូពីតារាង `teachers`។ `queryKey` ត្រូវបានប្រើសម្រាប់ cache និង refresh ទិន្នន័យ។ ប្រព័ន្ធតម្រៀបគ្រូតាម `created_at` ដោយឱ្យគ្រូដែលបង្កើតថ្មីបង្ហាញនៅខាងលើ។

```tsx
function slotMatchesTeacher(slot: TeacherScheduleSlot, teacher: TeacherRow) {
  const values = teacherMatchValues(teacher);
  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeMatchValue(value)),
  );
}
```

កូដនេះប្រើសម្រាប់រកថាកាលវិភាគមួយពាក់ព័ន្ធនឹងគ្រូណា។ វាពិនិត្យតាម `teacher_id`, `teacher_name` និងទិន្នន័យដែល decode ចេញពី timetable cell។ វាធ្វើឱ្យ Teachers Page អាចបង្ហាញ schedule របស់គ្រូម្នាក់ៗបានត្រឹមត្រូវ។

```tsx
const { error } = await supabase
  .from("teachers")
  .update(payload)
  .eq("id", teacher.id);
```

កូដនេះប្រើសម្រាប់កែប្រែព័ត៌មានគ្រូនៅក្នុង Supabase។ `.update(payload)` ផ្ញើទិន្នន័យថ្មីទៅ Database ហើយ `.eq("id", teacher.id)` បញ្ជាក់ថាត្រូវកែប្រែគ្រូណា។ ការប្រើ `id` ជាលក្ខខណ្ឌធ្វើឱ្យការកែប្រែមានភាពជាក់លាក់ និងមិនប៉ះពាល់ដល់គ្រូផ្សេងទៀត។

```tsx
const { error } = await supabase
  .from("teachers")
  .delete()
  .eq("id", id);
```

កូដនេះប្រើសម្រាប់លុបទិន្នន័យគ្រូចេញពីតារាង `teachers`។ មុនលុប ប្រព័ន្ធអាចបង្ហាញសារបញ្ជាក់ ដើម្បីការពារការលុបដោយចៃដន្យ។ បន្ទាប់ពីលុបបានជោគជ័យ ប្រព័ន្ធនឹង refresh បញ្ជីគ្រូឡើងវិញ។

## ៤. Classes Page

Classes Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.classes.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រងថ្នាក់រៀន។ Admin អាចបង្កើតថ្នាក់ថ្មី កំណត់មុខវិជ្ជា គ្រូ បន្ទប់ សមត្ថភាពថ្នាក់ ឆមាស និងឆ្នាំសិក្សា។ Teacher អាចមើលថ្នាក់ដែលខ្លួនទទួលបន្ទុក។ Student អាចមើលថ្នាក់ដែលខ្លួនស្ថិតនៅ។

```tsx
const { data: classes = [], isLoading } = useQuery({
  queryKey: ["classes", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    if (isTeacher) {
      const scope = await findTeacherClassScope(user);
      return scope?.classes ?? [];
    }
  },
});
```

កូដនេះបង្ហាញពីការទាញទិន្នន័យថ្នាក់តាម role។ ប្រសិនបើអ្នកប្រើជា Teacher ប្រព័ន្ធនឹងប្រើ `findTeacherClassScope` ដើម្បីរកថាគ្រូនោះមានសិទ្ធិមើលថ្នាក់ណាខ្លះ។ ដូច្នេះ Teacher មិនអាចមើលថ្នាក់ក្រៅការទទួលបន្ទុករបស់ខ្លួនបានទេ។

```tsx
const className = generateClassName(major, studyYear, shift, classNumber);
```

កូដនេះប្រើសម្រាប់បង្កើតឈ្មោះថ្នាក់ដោយស្វ័យប្រវត្តិ។ ឈ្មោះថ្នាក់អាចផ្អែកលើ major, year, shift និងលេខថ្នាក់។ វាជួយឱ្យការបង្កើតថ្នាក់មាន format ដូចគ្នា និងងាយស្រួលគ្រប់គ្រង។

```tsx
const { error } = await supabase
  .from("classes")
  .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)");
```

កូដនេះទាញទិន្នន័យថ្នាក់រួមជាមួយឈ្មោះគ្រូពី relation `teachers(full_name)`។ វាធ្វើឱ្យ table ថ្នាក់អាចបង្ហាញឈ្មោះគ្រូដែលបាន assign ទៅថ្នាក់នីមួយៗ។

Classes Page គឺជា page សំខាន់សម្រាប់ភ្ជាប់ទិន្នន័យរវាង students, teachers, subjects និង rooms។ ប្រសិនបើទិន្នន័យ class មិនត្រឹមត្រូវ វាអាចប៉ះពាល់ទៅ Attendance, Exams និង Timetable។

## ៥. Classrooms Page

Classrooms Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.classrooms.tsx`។ ទំព័រនេះប្រើសម្រាប់បង្ហាញបញ្ជីបន្ទប់រៀន និងពិនិត្យស្ថានភាពបន្ទប់ថា free ឬ busy តាមថ្ងៃ និងម៉ោងដែលបានជ្រើស។

```tsx
const CLASSROOMS: Classroom[] = [
  { no: 1, building: "អាគារ A", room: "A11", device: "Panasonic", status: "ល្អ" },
  { no: 2, building: "អាគារ A", room: "A21", device: "Panasonic", status: "ល្អ" },
];
```

កូដនេះកំណត់បញ្ជីបន្ទប់រៀនជាទិន្នន័យ static។ បន្ទប់នីមួយៗមានលេខរៀង អាគារ លេខបន្ទប់ ឧបករណ៍ និងស្ថានភាព។ វាជួយឱ្យប្រព័ន្ធអាចបង្ហាញ inventory បន្ទប់រៀនបានដោយមិនចាំបាច់ទាញពី database សម្រាប់បញ្ជីបន្ទប់មូលដ្ឋាន។

```tsx
function normalizeRoom(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").trim().toUpperCase();
}
```

កូដនេះប្រើសម្រាប់ normalize ឈ្មោះបន្ទប់មុនយកទៅប្រៀបធៀប។ វាលុប space បំប្លែងអក្សរឱ្យទៅជា uppercase និងធ្វើឱ្យទិន្នន័យមាន format ដូចគ្នា។ ការធ្វើបែបនេះជួយឱ្យការស្វែងរក និងការពិនិត្យបន្ទប់មិនខុសដោយសារ space ឬអក្សរតូចធំ។

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

កូដនេះប្រើសម្រាប់ពិនិត្យថាម៉ោងក្នុង timetable ជាន់គ្នាជាមួយម៉ោងដែលអ្នកប្រើជ្រើសឬអត់។ ប្រសិនបើ `start < queryEnd` និង `end > queryStart` នោះមានន័យថាបន្ទប់កំពុង busy នៅក្នុងចន្លោះម៉ោងនោះ។

Classrooms Page មានប្រយោជន៍សម្រាប់អ្នកគ្រប់គ្រងពេលរៀបចំកាលវិភាគ។ វាជួយបង្ហាញថាបន្ទប់ណាមានស្ថានភាពល្អ បន្ទប់ណាមធ្យម និងបន្ទប់ណាទំនេរឬកំពុងប្រើប្រាស់។

## ៦. Subjects Page

Subjects Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.subjects.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រងមុខវិជ្ជា។ Admin អាចបន្ថែម កែប្រែ និងលុបមុខវិជ្ជា។ Teacher អាចមើលតែមុខវិជ្ជាដែលពាក់ព័ន្ធនឹងថ្នាក់ដែលខ្លួនបង្រៀន។

```tsx
const queryKey = ["subjects", primaryRole, user?.id, isDemo ? "demo" : "remote"];
const { data: subjects = [], isLoading } = useQuery({
  queryKey,
  queryFn: async () => {
    if (isTeacher) {
      const scope = await findTeacherClassScope(user);
      const subjectCodes = scope?.subjectCodes ?? [];
      if (subjectCodes.length === 0) return [];
    }
  },
});
```

កូដនេះទាញទិន្នន័យមុខវិជ្ជាតាម role។ ប្រសិនបើ role ជា Teacher ប្រព័ន្ធនឹងរក subject code ដែលគ្រូនោះបង្រៀនជាមុន។ បើគ្រូមិនមាន subject ទេ វានឹង return empty array ដើម្បីមិនបង្ហាញទិន្នន័យមិនពាក់ព័ន្ធ។

```tsx
function normalizeSubjectId(value: string) {
  return value.trim().replace(/\s+/g, "_");
}
```

កូដនេះប្រើសម្រាប់រៀបចំ subject id មុនរក្សាទុក។ វាលុប space ខាងមុខ និងខាងក្រោយ ហើយប្តូរ space ច្រើនទៅជា underscore។ ឧទាហរណ៍ `Web Design` អាចក្លាយជា `Web_Design`។ វាជួយរក្សា subject id ឱ្យមាន format ល្អ និងងាយប្រើ។

```tsx
const filteredSubjects = useMemo(() => {
  const term = query.trim().toLowerCase();
  if (!term) return subjects;
  return subjects.filter((subject) =>
    [subject.subject_id, subject.subject_name, subject.description ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(term),
  );
}, [query, subjects]);
```

កូដនេះប្រើសម្រាប់ search មុខវិជ្ជា។ ប្រព័ន្ធយក keyword ដែលអ្នកប្រើវាយ ហើយប្រៀបធៀបជាមួយ subject id, subject name និង description។ ការប្រើ `useMemo` ជួយឱ្យ filter មិនគណនាឡើងវិញដោយមិនចាំបាច់។

Subjects Page ជា catalog មុខវិជ្ជាសម្រាប់ប្រព័ន្ធទាំងមូល។ ទិន្នន័យនៅទីនេះត្រូវបានយកទៅប្រើនៅ Classes, Attendance, Exams និង Timetable។

## ៧. Attendance Page

Attendance Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.attendance.tsx`។ ទំព័រនេះប្រើសម្រាប់កត់ត្រាវត្តមានសិស្ស។ Admin និង Teacher អាចកត់វត្តមានតាមថ្នាក់ មុខវិជ្ជា ឆមាស សប្តាហ៍ និងថ្ងៃ។ Student អាចមើលប្រវត្តិវត្តមានរបស់ខ្លួន។

```tsx
type Status = "present" | "absent" | "late" | "excused";
const STATUS_LABELS: Record<Status, string> = {
  present: "P",
  absent: "A",
  late: "L",
  excused: "E",
};
```

កូដនេះកំណត់ status របស់វត្តមាន។ វាមាន ៤ ប្រភេទគឺ `present`, `absent`, `late` និង `excused`។ ប្រព័ន្ធបង្ហាញវាជាអក្សរកាត់ P, A, L និង E ដើម្បីឱ្យ grid វត្តមានមើលងាយស្រួល។

```tsx
const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];
const WEEK_OPTIONS = Array.from({ length: 48 }, (_, index) => index + 1);
const DAY_OPTIONS = ["M", "T", "W", "T", "F", "S", "S"];
```

កូដនេះកំណត់ជម្រើសសម្រាប់ការកត់វត្តមាន។ អ្នកប្រើអាចជ្រើសឆមាស សប្តាហ៍ និងថ្ងៃ។ `WEEK_OPTIONS` បង្កើតលេខសប្តាហ៍ចាប់ពី ១ ដល់ ៤៨ ដើម្បីគាំទ្រការកត់វត្តមានពេញឆ្នាំសិក្សា។

```tsx
await supabase.from("attendance").upsert(
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

កូដនេះប្រើ `upsert` ដើម្បីរក្សាទុកវត្តមាន។ ប្រសិនបើ record មិនទាន់មាន ប្រព័ន្ធនឹង insert ថ្មី។ ប្រសិនបើ record មានរួចហើយ ប្រព័ន្ធនឹង update status ថ្មី។ `onConflict` កំណត់ key ដើម្បីការពារកុំឱ្យវត្តមានស្ទួនសម្រាប់សិស្ស ថ្នាក់ ឆមាស សប្តាហ៍ ថ្ងៃ និងមុខវិជ្ជាដូចគ្នា។

Attendance Page ជួយឱ្យគ្រូអាចកត់ត្រាការចូលរៀនបានរហ័ស និងអាចបោះពុម្ពរបាយការណ៍វត្តមានបាន។ ទិន្នន័យវត្តមាននេះក៏ត្រូវបានប្រើក្នុង Exams Page ដើម្បីគណនាពិន្ទុវត្តមានផងដែរ។

## ៨. Exams and Scores Page

Exams and Scores Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.exams.tsx`។ ទំព័រនេះប្រើសម្រាប់បញ្ចូល និងមើលពិន្ទុសិស្សតាមមុខវិជ្ជា។ ពិន្ទុត្រូវបានបែងចែកជា Attendance, Assignment, Midterm និង Final។

```tsx
const ATTENDANCE_SCORE_MAX = 10;
const ASSIGNMENT_SCORE_MAX = 20;
const MIDTERM_SCORE_MAX = 25;
const FINAL_SCORE_MAX = 45;
```

កូដនេះកំណត់ពិន្ទុអតិបរមារបស់ component នីមួយៗ។ Attendance មាន ១០ ពិន្ទុ Assignment មាន ២០ ពិន្ទុ Midterm មាន ២៥ ពិន្ទុ និង Final មាន ៤៥ ពិន្ទុ។ សរុបទាំងអស់ស្មើ ១០០ ពិន្ទុ។

```tsx
function totalSubjectScore({
  attendance,
  assignment,
  midterm,
  final,
}: {
  attendance: number;
  assignment: number | null | undefined;
  midterm: number | null | undefined;
  final: number | null | undefined;
}) {
  return Math.min(
    SCORE_MAX,
    Math.max(0, attendance + (assignment ?? 0) + (midterm ?? 0) + (final ?? 0)),
  );
}
```

កូដនេះប្រើសម្រាប់គណនាពិន្ទុសរុបរបស់សិស្សក្នុងមុខវិជ្ជាមួយ។ វាបូកពិន្ទុ attendance, assignment, midterm និង final។ ប្រសិនបើពិន្ទុខ្លះមិនទាន់មាន វានឹងប្រើ `0` ជំនួស។ `Math.min` និង `Math.max` ត្រូវបានប្រើដើម្បីធានាថាពិន្ទុមិនលើស ១០០ និងមិនតិចជាង ០។

```tsx
function attendanceScoreFromRows(rows: ScoreAttendanceRow[]) {
  if (rows.length === 0) return 0;
  const absences = rows.filter((row) => row.status === "absent").length;
  return Math.max(0, ATTENDANCE_SCORE_MAX - absences);
}
```

កូដនេះគណនាពិន្ទុ attendance ពី record វត្តមាន។ ប្រសិនបើសិស្សអវត្តមានច្រើន ពិន្ទុ attendance នឹងត្រូវបានដកចុះ។ វាជួយភ្ជាប់ទិន្នន័យ Attendance ជាមួយការគណនាពិន្ទុប្រឡង។

```tsx
await supabase.from("subject_scores").upsert(payload, {
  onConflict: "student_id,class_id,semester,week_number,subject_code",
});
```

កូដនេះប្រើសម្រាប់រក្សាទុកពិន្ទុទៅក្នុងតារាង `subject_scores`។ ប្រព័ន្ធប្រើ `upsert` ដើម្បីបញ្ចូលពិន្ទុថ្មី ឬកែប្រែពិន្ទុដែលមានស្រាប់។ `onConflict` ការពារកុំឱ្យមាន score record ស្ទួនសម្រាប់សិស្ស និងមុខវិជ្ជាដូចគ្នា។

Exams Page ក៏មានមុខងារ print score report ដើម្បីឱ្យគ្រូ ឬ Admin អាចបោះពុម្ពលទ្ធផលពិន្ទុសិស្សតាមថ្នាក់ និងមុខវិជ្ជា។

## ៩. Timetable Page

Timetable Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.timetable.tsx`។ ទំព័រនេះប្រើសម្រាប់រៀបចំកាលវិភាគសិក្សា។ Admin អាចបង្កើត schedule, បន្ថែមម៉ោងសិក្សា, កំណត់ថ្ងៃ, គ្រូ, មុខវិជ្ជា, បន្ទប់ និង save កាលវិភាគ។ Teacher និង Student អាចមើល timetable ដែលពាក់ព័ន្ធនឹងខ្លួន។

```tsx
const days = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
const dayLabels = {
  mon: "ថ្ងៃចន្ទ",
  tue: "ថ្ងៃអង្គារ",
  wed: "ថ្ងៃពុធ",
  thu: "ថ្ងៃព្រហស្បតិ៍",
  fri: "ថ្ងៃសុក្រ",
  sat: "ថ្ងៃសៅរ៍",
};
```

កូដនេះកំណត់ថ្ងៃសិក្សាចាប់ពីថ្ងៃចន្ទដល់ថ្ងៃសៅរ៍។ ប្រព័ន្ធប្រើ key ដូចជា `mon`, `tue`, `wed` សម្រាប់រក្សាទុកក្នុង Database ហើយបង្ហាញ label ជាភាសាខ្មែរនៅលើ UI។

```tsx
const shiftOptions = [
  { value: "morning", label: "Morning", time: "07:00 - 11:00", start: "07:00", end: "11:00" },
  { value: "afternoon", label: "Afternoon", time: "13:00 - 17:00", start: "13:00", end: "17:00" },
  { value: "evening", label: "Evening", time: "17:30 - 20:30", start: "17:30", end: "20:30" },
];
```

កូដនេះកំណត់វេនសិក្សា។ មានវេនព្រឹក វេនរសៀល និងវេនយប់។ ពេលអ្នកប្រើជ្រើស shift ប្រព័ន្ធអាចដាក់ម៉ោងចាប់ផ្តើម និងម៉ោងបញ្ចប់ជាស្រេច ដើម្បីឱ្យការរៀបចំ timetable ងាយស្រួល។

```tsx
function emptyScheduleCells() {
  return days.reduce((acc, day) => {
    acc[day] = {
      teacherId: "",
      teacher: "",
      teacherPhone: "",
      subjectCode: "",
      subject: "",
      room: "",
    };
    return acc;
  }, {} as Record<(typeof days)[number], ScheduleCell>);
}
```

កូដនេះបង្កើត cell ទទេសម្រាប់ timetable។ រាល់ថ្ងៃក្នុង timetable នឹងមាន field សម្រាប់គ្រូ លេខទូរស័ព្ទគ្រូ មុខវិជ្ជា និងបន្ទប់។ វាជាមូលដ្ឋានសម្រាប់ឱ្យ Admin បំពេញ schedule នៅក្នុង table។

```tsx
function slotsToSchedules(slots: TimetableScheduleSlot[]): ScheduleBuilderData[] {
  const byClass = new Map<string, TimetableScheduleSlot[]>();
  slots.forEach((slot) => {
    const key = slot.class_id;
    byClass.set(key, [...(byClass.get(key) ?? []), slot]);
  });
}
```

កូដនេះបម្លែង timetable slots ពី Database ទៅជា schedule ដែលអាចបង្ហាញនៅលើ UI។ វា group slot តាម `class_id` ដើម្បីឱ្យ timetable របស់ថ្នាក់នីមួយៗបង្ហាញជាក្រុមដាច់ដោយឡែក។

Timetable Page មានការពិនិត្យ conflict ដើម្បីការពារមិនឱ្យគ្រូម្នាក់ ឬបន្ទប់មួយត្រូវបានប្រើនៅម៉ោងជាន់គ្នា។ វាជួយឱ្យការរៀបចំកាលវិភាគមានភាពត្រឹមត្រូវ និងអាចយកទៅបោះពុម្ពបាន។

## ១០. Payments Page

Payments Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.payments.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រង invoice ការបង់ប្រាក់ និង receipt របស់សិស្ស។ Admin អាចបង្កើត invoice និងកំណត់ថា payment បានបង់រួច។ Student អាចមើល invoice និងស្ថានភាពបង់ប្រាក់របស់ខ្លួន។

```tsx
const { data: payments = [], isLoading } = useQuery({
  queryKey: ["payments", primaryRole, user?.id, isDemo ? "demo" : "remote"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("payments")
      .select(PAYMENT_ROW_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});
```

កូដនេះទាញបញ្ជី payments ពី Supabase។ `PAYMENT_ROW_SELECT` ជ្រើសទិន្នន័យ payment រួមជាមួយព័ត៌មានសិស្ស ដូចជា ឈ្មោះ student code class major និង study year។ វាធ្វើឱ្យ payment table អាចបង្ហាញទិន្នន័យគ្រប់គ្រាន់សម្រាប់ការតាមដានហិរញ្ញវត្ថុ។

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

កូដនេះគណនាស្ថិតិ payment សម្រាប់បង្ហាញលើ summary cards។ វាបែងចែកប្រាក់ទៅជា `paid`, `pending` និង `overdue`។ Admin អាចមើលបានភ្លាមៗថាចំណូលដែលបានបង់មានប៉ុន្មាន ប្រាក់ដែលនៅរង់ចាំមានប៉ុន្មាន និងប្រាក់ហួសកំណត់មានប៉ុន្មាន។

```tsx
const markPaid = useMutation({
  mutationFn: async ({ id, method }: MarkPaidVariables) => {
    const paidDate = new Date().toISOString().slice(0, 10);
    const data = await markPaymentPaid({
      data: {
        accessToken,
        paymentId: id,
        method: method ?? "cash",
      },
    });
    return data as unknown as PaymentRow;
  },
});
```

កូដនេះប្រើសម្រាប់កំណត់ payment មួយថាបានបង់រួច។ ប្រព័ន្ធរក្សាទុក `paidDate` ជាកាលបរិច្ឆេទបង់ប្រាក់ ហើយផ្ញើ `paymentId` និង `method` ទៅ function `markPaymentPaid`។ បន្ទាប់ពីជោគជ័យ ប្រព័ន្ធអាច print receipt និង refresh payment list។

Payments Page ក៏មានមុខងារ QR payment modal និង receipt ជាភាសាខ្មែរ។ វាជួយឱ្យការគ្រប់គ្រងការបង់ប្រាក់មានភាពងាយស្រួល និងមានឯកសារបញ្ជាក់ច្បាស់លាស់។

## ១១. Reports Page

Reports Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.reports.tsx`។ ទំព័រនេះប្រើសម្រាប់បង្ហាញរបាយការណ៍សង្ខេបរបស់ប្រព័ន្ធ និងបញ្ជីចុះឈ្មោះសិស្ស។ វាជួយឱ្យ Admin អាចមើលស្ថិតិសំខាន់ៗ និង print report សម្រាប់ប្រើក្នុងការិយាល័យ។

```tsx
const [students, classes, payments, attendance] = await Promise.all([
  supabase.from("students").select("id", { count: "exact", head: true }),
  supabase.from("classes").select("id", { count: "exact", head: true }),
  supabase.from("payments").select("amount,status"),
  supabase.from("attendance").select("status"),
]);
```

កូដនេះទាញទិន្នន័យសំខាន់ៗសម្រាប់ report។ វាទាញចំនួនសិស្ស ចំនួនថ្នាក់ ទិន្នន័យ payment និងទិន្នន័យ attendance។ ដូច Dashboard ដែរ វាប្រើ `Promise.all` ដើម្បីឱ្យការទាញទិន្នន័យលឿន។

```tsx
const revenue = (payments.data ?? [])
  .filter((p) => p.status === "paid")
  .reduce((s, p) => s + Number(p.amount), 0);
const totalAtt = (attendance.data ?? []).length;
const present = (attendance.data ?? []).filter(
  (a) => a.status === "present" || a.status === "late",
).length;
const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;
```

កូដនេះគណនាចំណូល និង attendance rate។ Revenue គិតពី payment ដែល paid ប៉ុណ្ណោះ។ Attendance rate គិតពីចំនួន present និង late ប្រៀបធៀបនឹងចំនួន attendance records ទាំងអស់។ ប្រសិនបើមិនទាន់មាន attendance record ប្រព័ន្ធនឹងបង្ហាញ 0% ដើម្បីជៀសវាងការគណនាខុស។

```tsx
const filteredRegisterStudents = useMemo(() => {
  const term = registerSearch.trim().toLowerCase();
  const rows = registerStudents.filter((student) => {
    if (!term) return true;
    return [
      student.student_code,
      student.full_name_km,
      student.full_name_en,
      student.full_name,
      student.major,
      student.class_name,
      student.status,
    ].join(" ").toLowerCase().includes(term);
  });
  return rows.sort((a, b) => a.student_code.localeCompare(b.student_code));
}, [registerSearch, registerStudents]);
```

កូដនេះប្រើសម្រាប់ search និង sort បញ្ជីសិស្សក្នុង report។ អ្នកប្រើអាចស្វែងរកតាម student code ឈ្មោះ major class ឬ status។ បន្ទាប់ពី filter វាតម្រៀបតាម student code ដើម្បីឱ្យ report មានលំដាប់ច្បាស់លាស់។

Reports Page ក៏មានមុខងារ print student registration report។ ប្រព័ន្ធបង្កើត HTML report និងបើក print window ដើម្បីឱ្យអ្នកប្រើអាចបោះពុម្ពជាឯកសារ A4 បាន។

## ១២. Notifications Page

Notifications Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.notifications.tsx`។ ទំព័រនេះប្រើសម្រាប់បង្ហាញ និងបង្កើតសេចក្តីជូនដំណឹង។ Admin អាចផ្ញើ announcement ទៅ student, teacher ឬ everyone។ Notification អាចមាន title, message, kind, image និង video។

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
```

កូដនេះទាញបញ្ជី notifications ពីតារាង `notifications`។ វាតម្រៀបតាម `created_at` ដោយឱ្យ notification ថ្មីៗបង្ហាញមុន។ `queryKey` មាន role និង user id ដើម្បីឱ្យ cache ទិន្នន័យត្រឹមត្រូវតាមអ្នកប្រើ។

```tsx
const visibleItems = useMemo(
  () => items.filter((item) => isNotificationVisibleForRole(item, primaryRole, user?.id)),
  [items, primaryRole, user?.id],
);
```

កូដនេះ filter notification តាម role របស់អ្នកប្រើ។ ប្រសិនបើ notification ត្រូវផ្ញើទៅ student នោះ teacher មិនគួរមើលឃើញទេ។ Function `isNotificationVisibleForRole` ជួយធានាថា user មើលឃើញតែ notification ដែលពាក់ព័ន្ធនឹងខ្លួន។

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

កូដនេះប្រើសម្រាប់បង្កើត notification ថ្មី។ វារក្សាទុក title, message, kind, target role, media URL, media type និង user ដែលបានបង្កើត។ ប្រសិនបើមានរូបភាព ឬ video ប្រព័ន្ធនឹងរក្សាទុក link ឬ data URL របស់ media នោះ។

Notifications Page ជួយឱ្យ Admin ផ្ញើព័ត៌មានទៅអ្នកប្រើក្នុងប្រព័ន្ធបានយ៉ាងងាយស្រួល។ វាក៏គាំទ្រ fallback logic សម្រាប់ database schema ចាស់ដែលមិនទាន់មាន columns media ឬ target role។

## ១៣. Roles and Permissions Page

Roles and Permissions Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.roles.tsx`។ ទំព័រនេះប្រើសម្រាប់មើល និងគ្រប់គ្រង role របស់ user ក្នុងប្រព័ន្ធ។ Role សំខាន់ៗមាន admin, teacher និង student។

```tsx
type RoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "teacher" | "student";
  profiles: { full_name: string; email: string | null } | null;
};
```

កូដនេះកំណត់ទម្រង់ទិន្នន័យ role មួយ។ Role record មាន `user_id`, `role` និងព័ត៌មាន profile របស់ user ដូចជា full name និង email។ វាជួយឱ្យ table roles អាចបង្ហាញឈ្មោះ អ៊ីមែល និងតួនាទីរបស់អ្នកប្រើបានច្បាស់។

```tsx
const { data: roles } = await supabase
  .from("user_roles")
  .select("id,user_id,role")
  .order("created_at", { ascending: false });

const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
const { data: profs } = userIds.length
  ? await supabase.from("profiles").select("user_id,full_name,email").in("user_id", userIds)
  : { data: [] };
```

កូដនេះទាញ roles ពីតារាង `user_roles` ហើយបន្ទាប់មកទាញ profiles ដែលពាក់ព័ន្ធតាម `user_id`។ ព្រោះ role និង profile ស្ថិតនៅតារាងផ្សេងគ្នា ប្រព័ន្ធត្រូវ map ទិន្នន័យទាំងពីរចូលគ្នា ដើម្បីបង្ហាញក្នុង table តែមួយ។

```tsx
const sortedRows = useMemo(
  () => [...rows].sort((a, b) => roleLabel(a.role, t).localeCompare(roleLabel(b.role, t))),
  [rows, t],
);
```

កូដនេះតម្រៀបបញ្ជី role តាមឈ្មោះ role។ ការប្រើ `useMemo` ជួយរក្សា performance ព្រោះវាគណនាតែពេល `rows` ឬ translation function `t` ផ្លាស់ប្តូរ។

```tsx
const del = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) throw error;
  },
});
```

កូដនេះប្រើសម្រាប់លុប role assignment ចេញពីតារាង `user_roles`។ ប្រព័ន្ធប្រើ `id` ដើម្បីលុប role record ជាក់លាក់។ ទោះជាយ៉ាងណា UI បាន disable ការលុប admin role ដើម្បីការពារកុំឱ្យប្រព័ន្ធបាត់បង់អ្នកគ្រប់គ្រង។

Roles Page ក៏អនុញ្ញាតឱ្យ Admin update password របស់ user បាន។ មុខងារនេះមានការពិនិត្យ password យ៉ាងតិច ៦ តួអក្សរ និងពិនិត្យ confirm password មុនផ្ញើទៅ backend។

## ១៤. Certificates Page

Certificates Page ត្រូវបានគ្រប់គ្រងដោយ file `src/routes/app.certificates.tsx`។ ទំព័រនេះប្រើសម្រាប់គ្រប់គ្រងវិញ្ញាបនបត្រ ឬ transcript របស់សិស្ស។ Admin អាចបង្កើត certificate បោះពុម្ព certificate និងបង្ហាញ verification code។ Student អាចមើលឯកសារដែលពាក់ព័ន្ធនឹងខ្លួន។

```tsx
type CertificateRow = {
  id: string;
  student_id?: string | null;
  kind: string;
  title: string;
  issue_date: string;
  verification_code: string;
  status: string;
  students: {
    full_name: string;
    full_name_km: string | null;
    avatar_url: string | null;
    date_of_birth: string | null;
    major: string | null;
    class_name?: string | null;
  } | null;
};
```

កូដនេះកំណត់ទម្រង់ទិន្នន័យ certificate។ Certificate មួយមានប្រភេទ ឈ្មោះឯកសារ កាលបរិច្ឆេទចេញ លេខ verification និងស្ថានភាព។ វាក៏ភ្ជាប់ព័ត៌មានសិស្ស ដូចជា ឈ្មោះ រូបភាព ថ្ងៃខែឆ្នាំកំណើត major និង class។

```tsx
function certificateKindLabel(kind: string) {
  if (kind === "graduation") return "Certificate of Graduation";
  if (kind === "award") return "Certificate of Achievement";
  if (kind === "participation") return "Certificate of Participation";
  return "Certificate of Completion";
}
```

កូដនេះប្រើសម្រាប់បម្លែងប្រភេទ certificate ទៅជា label សម្រាប់បង្ហាញ។ ប្រសិនបើ kind ជា `graduation` វានឹងបង្ហាញជា Certificate of Graduation។ ប្រសិនបើ kind មិនត្រូវនឹងលក្ខខណ្ឌណាមួយ វានឹងប្រើ Certificate of Completion ជា default។

```tsx
async function loadTranscriptRows(
  certificate: CertificateRow,
  isDemo: boolean,
): Promise<TranscriptScoreRow[]> {
  const studentId = certificate.student_id || certificate.students?.id;
  if (!studentId) return fallbackTranscriptRows();

  const { data, error } = await supabase
    .from("subject_scores")
    .select("subject_code,score,max_score,semester")
    .eq("student_id", studentId)
    .order("semester", { ascending: true })
    .order("subject_code", { ascending: true });
  if (error) throw error;
}
```

កូដនេះប្រើសម្រាប់ទាញពិន្ទុ transcript របស់សិស្ស។ ប្រព័ន្ធរក student id ពី certificate ហើយទាញ score ពីតារាង `subject_scores`។ វាតម្រៀបតាម semester និង subject code ដើម្បីឱ្យ transcript បង្ហាញលំដាប់មុខវិជ្ជាបានស្អាត។

```tsx
async function printCertificate(certificate: CertificateRow, isDemo: boolean) {
  let rows: TranscriptScoreRow[];
  try {
    rows = await loadTranscriptRows(certificate, isDemo);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : translate("unknown_error"));
    rows = fallbackTranscriptRows();
  }
}
```

កូដនេះប្រើសម្រាប់បោះពុម្ព certificate។ មុនបោះពុម្ព វាទាញ transcript rows របស់សិស្ស។ ប្រសិនបើមានបញ្ហាពេលទាញពិន្ទុ ប្រព័ន្ធនឹងបង្ហាញ error ហើយប្រើ fallback rows ដើម្បីឱ្យការបោះពុម្ពមិនបរាជ័យទាំងស្រុង។

Certificates Page ជា page ចុងក្រោយសម្រាប់បង្កើតឯកសារផ្លូវការរបស់សិស្ស។ វាភ្ជាប់ទិន្នន័យពី students និង subject scores ដើម្បីបង្កើត certificate ឬ transcript ដែលមានព័ត៌មានពេញលេញ និងអាចប្រើសម្រាប់ការផ្ទៀងផ្ទាត់បានតាម verification code។

## សរុប

ចាប់ពី Dashboard រហូតដល់ Certificates ប្រព័ន្ធនេះមាន page សំខាន់ៗសម្រាប់គ្រប់គ្រងសាលា។ Dashboard បង្ហាញស្ថិតិសង្ខេប។ Students និង Teachers គ្រប់គ្រងអ្នកសិក្សា និងបុគ្គលិកបង្រៀន។ Classes, Classrooms, Subjects និង Timetable គ្រប់គ្រងផ្នែកសិក្សា។ Attendance និង Exams គ្រប់គ្រងវត្តមាន និងពិន្ទុ។ Payments គ្រប់គ្រងការបង់ប្រាក់។ Reports បង្កើតរបាយការណ៍។ Notifications ផ្ញើសេចក្តីជូនដំណឹង។ Roles គ្រប់គ្រងសិទ្ធិអ្នកប្រើ។ Certificates បង្កើតឯកសារផ្លូវការរបស់សិស្ស។
