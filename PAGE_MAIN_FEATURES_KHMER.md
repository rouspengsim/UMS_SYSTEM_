# Page Main Features សម្រាប់ Thesis

ឯកសារនេះសរសេរជាភាសាខ្មែរ ដើម្បីពន្យល់ថា page នីមួយៗក្នុងប្រព័ន្ធអាចធ្វើអ្វីបាន។ អាចយកទៅដាក់ក្នុងជំពូក Implementation ឬ User Interface Description។

## 1. Dashboard Page

File: `src/routes/app.index.tsx`

Dashboard page ជាទំព័រដំបូងបន្ទាប់ពីអ្នកប្រើ login ចូលប្រព័ន្ធ។ ទំព័រនេះបង្ហាញព័ត៌មានសង្ខេបសំខាន់ៗរបស់សាលា ឬព័ត៌មានផ្ទាល់ខ្លួនទៅតាម role របស់អ្នកប្រើ។

### Main Features for Admin

Admin អាចមើលព័ត៌មានសំខាន់ៗដូចខាងក្រោម៖

- មើលចំនួនសិស្សសរុប។
- មើលចំនួនគ្រូសរុប។
- មើលចំនួនថ្នាក់សកម្ម។
- មើលចំណូលសរុបពីការទូទាត់ដែលបានបង់រួច។
- មើលក្រាហ្វចំណូលតាមខែ។
- មើលស្ថិតិវត្តមានក្នុង 7 ថ្ងៃចុងក្រោយ។
- មើលការបែងចែកមុខវិជ្ជា ឬ subject mix។
- មើលបញ្ជីសិស្សថ្មីៗ។
- មើលការទូទាត់ថ្មីៗ។

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

return {
  students: students.count ?? 0,
  teachers: teachers.count ?? 0,
  classes: classes.count ?? 0,
  revenue: totalRevenue,
};
```

### Explanation

Code នេះទាញទិន្នន័យសម្រាប់ Dashboard។ វារាប់ចំនួនសិស្សពី table `students`, រាប់ចំនួនគ្រូពី table `teachers`, រាប់ចំនួនថ្នាក់ពី table `classes` និងគណនាចំណូលពី table `payments`។ ប្រព័ន្ធគិតចំណូលតែ payment ដែលមាន status `paid` ប៉ុណ្ណោះ។

### Thesis Wording

Dashboard page ត្រូវបានបង្កើតឡើងដើម្បីបង្ហាញព័ត៌មានសង្ខេបរបស់ប្រព័ន្ធ។ សម្រាប់ admin ទំព័រនេះអាចបង្ហាញចំនួនសិស្សសរុប ចំនួនគ្រូសរុប ចំនួនថ្នាក់សកម្ម និងចំណូលសរុប។ លើសពីនេះ វាក៏បង្ហាញក្រាហ្វចំណូល ស្ថិតិវត្តមាន ការបែងចែកមុខវិជ្ជា សិស្សថ្មីៗ និងការទូទាត់ថ្មីៗ ដើម្បីជួយឲ្យអ្នកគ្រប់គ្រងអាចតាមដានស្ថានភាពសាលាបានយ៉ាងឆាប់រហ័ស។

## 2. Student Dashboard

Student dashboard បង្ហាញព័ត៌មានសំខាន់ៗរបស់សិស្សដែលកំពុង login។

### Main Features for Student

សិស្សអាចមើលព័ត៌មានដូចខាងក្រោម៖

- មើលឈ្មោះ និងព័ត៌មាន class/major របស់ខ្លួន។
- មើលចំនួនមុខវិជ្ជាសរុប។
- មើល GPA ឬ average score។
- មើល percentage វត្តមាន។
- មើលស្ថានភាពការទូទាត់ថ្លៃសិក្សា។
- មើលការប្រឡងខាងមុខ។
- មើលកាលវិភាគថ្ងៃនេះ។
- មើលសេចក្តីជូនដំណឹង។
- ចូលទៅមើលព័ត៌មានផ្ទាល់ខ្លួនតាម button `My Information`។

### Main Source Code

```tsx
const [classesResult, attendanceResult, scoresResult, paymentsResult, notificationsResult] =
  await Promise.all([
    supabase.from("classes").select("id,name,subject_code").eq("name", className),
    supabase.from("attendance").select("status").eq("student_id", student.id),
    supabase.from("subject_scores").select("subject_code,score").eq("student_id", student.id),
    supabase.from("payments").select("status,amount,due_date,paid_date").eq("student_id", student.id),
    supabase.from("notifications").select("id,title,body,created_at,target_role,target_user_id"),
  ]);
```

### Explanation

Code នេះទាញព័ត៌មានរបស់សិស្សពី tables ផ្សេងៗ ដូចជា classes, attendance, subject scores, payments និង notifications។ ទិន្នន័យទាំងនេះត្រូវបានប្រើសម្រាប់បង្ហាញ summary របស់សិស្សនៅលើ dashboard។

## 3. Teacher Dashboard

Teacher dashboard បង្ហាញព័ត៌មានសំខាន់ៗសម្រាប់គ្រូដែលកំពុង login។

### Main Features for Teacher

គ្រូអាចមើលព័ត៌មានដូចខាងក្រោម៖

- មើលព័ត៌មានសង្ខេបរបស់គ្រូ។
- មើលថ្នាក់ដែលខ្លួនត្រូវបង្រៀន។
- មើលចំនួនសិស្សដែលខ្លួនទទួលបន្ទុក។
- មើល percentage វត្តមានរបស់គ្រូ។
- មើលការប្រឡងខាងមុខ។
- មើលកាលវិភាគបង្រៀនថ្ងៃនេះ។
- មើលសេចក្តីជូនដំណឹងសម្រាប់គ្រូ។

### Main Source Code

```tsx
const scope = await findTeacherClassScope(user);

const [classesResult, attendanceResult, notificationsResult] = await Promise.all([
  supabase.from("classes").select("id,name,subject_code,room,semester").in("id", scope.classIds),
  supabase.from("teacher_attendance").select("status").eq("teacher_id", teacher.id),
  supabase.from("notifications").select("id,title,body,created_at,target_role,target_user_id"),
]);
```

### Explanation

Code នេះរក class scope របស់គ្រូជាមុន ដើម្បីដឹងថាគ្រូមានសិទ្ធិមើលថ្នាក់ណាខ្លះ។ បន្ទាប់មកវាទាញ classes, teacher attendance និង notifications សម្រាប់បង្ហាញនៅលើ teacher dashboard។

## 4. Short Presentation Script

ពេលពន្យល់ Dashboard page អាចនិយាយបែបនេះ៖

Dashboard គឺជាទំព័រសង្ខេបសំខាន់បំផុតរបស់ប្រព័ន្ធ។ សម្រាប់ admin វាអាចមើលចំនួនសិស្ស គ្រូ ថ្នាក់សកម្ម និងចំណូលសរុប។ វាក៏មាន charts សម្រាប់មើលចំណូល វត្តមាន និង subject mix ផងដែរ។ សម្រាប់ teacher វាបង្ហាញថ្នាក់ដែលគ្រូបង្រៀន ចំនួនសិស្ស កាលវិភាគថ្ងៃនេះ និងសេចក្តីជូនដំណឹង។ សម្រាប់ student វាបង្ហាញ GPA វត្តមាន ស្ថានភាពការទូទាត់ កាលវិភាគថ្ងៃនេះ និងការប្រឡងខាងមុខ។ Dashboard ដូច្នេះជួយឲ្យអ្នកប្រើមើលព័ត៌មានសំខាន់ៗបានរហ័សក្នុងទំព័រតែមួយ។

