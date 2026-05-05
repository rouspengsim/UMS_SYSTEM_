export type Student = {
  id: string;
  name: string;
  email: string;
  grade: string;
  className: string;
  avatar?: string;
  status: "active" | "inactive";
  attendance: number; // %
  gpa: number;
  feeStatus: "paid" | "unpaid" | "overdue";
};

export type Teacher = {
  id: string;
  name: string;
  email: string;
  subject: string;
  classes: number;
  experience: number;
};

export type ClassItem = {
  id: string;
  name: string;
  code: string;
  teacher: string;
  students: number;
  subject: string;
  room: string;
};

export type PaymentRow = {
  id: string;
  student: string;
  amount: number;
  date: string;
  method: string;
  status: "paid" | "unpaid" | "overdue";
};

export type CertificateItem = {
  id: string;
  student: string;
  type: "Completion" | "Graduation" | "Award";
  course: string;
  issuedAt: string;
  code: string;
};

const firstNames = ["Lina", "Dara", "Sokha", "Pisey", "Vannak", "Chenda", "Rithy", "Mealea", "Bopha", "Sopheak", "Kosal", "Nita"];
const lastNames = ["Sok", "Pich", "Vong", "Chea", "Heng", "Ros", "Kim", "Ny", "Sam", "Long"];

function rand<T>(arr: T[], i: number) { return arr[i % arr.length]; }

export const students: Student[] = Array.from({ length: 36 }).map((_, i) => ({
  id: `s-${1000 + i}`,
  name: `${rand(firstNames, i)} ${rand(lastNames, i + 3)}`,
  email: `student${i + 1}@educore.app`,
  grade: `Grade ${7 + (i % 6)}`,
  className: `${["7A", "8B", "9C", "10A", "11B", "12A"][i % 6]}`,
  status: i % 11 === 0 ? "inactive" : "active",
  attendance: 70 + ((i * 7) % 30),
  gpa: Number((2.5 + ((i * 13) % 150) / 100).toFixed(2)),
  feeStatus: (["paid", "paid", "unpaid", "paid", "overdue"] as const)[i % 5],
}));

export const teachers: Teacher[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `t-${100 + i}`,
  name: `${rand(firstNames, i + 2)} ${rand(lastNames, i)}`,
  email: `teacher${i + 1}@educore.app`,
  subject: ["Math", "Physics", "Khmer", "English", "Biology", "History", "Chemistry", "Art"][i % 8],
  classes: 2 + (i % 4),
  experience: 1 + (i % 15),
}));

export const classes: ClassItem[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `c-${10 + i}`,
  name: `${["7A", "8B", "9C", "10A", "11B", "12A", "7B", "8A", "9A", "10B"][i]}`,
  code: `CLS-${100 + i}`,
  teacher: teachers[i % teachers.length].name,
  students: 18 + ((i * 5) % 18),
  subject: teachers[i % teachers.length].subject,
  room: `R-${201 + i}`,
}));

export const payments: PaymentRow[] = Array.from({ length: 14 }).map((_, i) => ({
  id: `p-${500 + i}`,
  student: students[i].name,
  amount: 50 + ((i * 37) % 200),
  date: `2026-04-${String(1 + (i % 22)).padStart(2, "0")}`,
  method: ["ABA", "Wing", "Cash", "Bank Transfer"][i % 4],
  status: (["paid", "paid", "unpaid", "overdue", "paid"] as const)[i % 5],
}));

export const certificates: CertificateItem[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `cert-${i + 1}`,
  student: students[i].name,
  type: (["Completion", "Graduation", "Award"] as const)[i % 3],
  course: ["Mathematics 10", "English Advanced", "Physics 11", "Khmer Literature", "Computer Science"][i % 5],
  issuedAt: `2026-0${1 + (i % 4)}-15`,
  code: `EDU-${(2026000 + i).toString()}`,
}));

export const attendanceTrend = [
  { day: "Mon", present: 312, absent: 18 },
  { day: "Tue", present: 305, absent: 25 },
  { day: "Wed", present: 320, absent: 10 },
  { day: "Thu", present: 298, absent: 32 },
  { day: "Fri", present: 314, absent: 16 },
  { day: "Sat", present: 240, absent: 12 },
];

export const revenueTrend = [
  { month: "Nov", revenue: 12400 },
  { month: "Dec", revenue: 15200 },
  { month: "Jan", revenue: 18900 },
  { month: "Feb", revenue: 17300 },
  { month: "Mar", revenue: 21500 },
  { month: "Apr", revenue: 24800 },
];

export const subjectsDistribution = [
  { name: "Math", value: 28 },
  { name: "Science", value: 22 },
  { name: "Languages", value: 24 },
  { name: "Arts", value: 14 },
  { name: "Other", value: 12 },
];

export const notifications = [
  { id: "n1", title: "Fee due reminder", desc: "12 students have unpaid fees this week.", time: "5m ago", type: "warning" as const },
  { id: "n2", title: "New enrollment", desc: "Lina Sok enrolled in Grade 10A.", time: "1h ago", type: "info" as const },
  { id: "n3", title: "Exam schedule published", desc: "Midterm exams start May 6.", time: "3h ago", type: "info" as const },
  { id: "n4", title: "Low attendance alert", desc: "Class 8B is below 80% this week.", time: "Yesterday", type: "danger" as const },
  { id: "n5", title: "Payment received", desc: "$120 from Dara Pich via ABA.", time: "Yesterday", type: "success" as const },
];

export const timetable = [
  { day: "Mon", slots: [{ time: "08:00", subject: "Math", room: "R-201" }, { time: "10:00", subject: "English", room: "R-205" }, { time: "13:00", subject: "Physics", room: "R-210" }] },
  { day: "Tue", slots: [{ time: "08:00", subject: "Khmer", room: "R-202" }, { time: "10:00", subject: "Biology", room: "R-208" }, { time: "13:00", subject: "Art", room: "R-211" }] },
  { day: "Wed", slots: [{ time: "08:00", subject: "Math", room: "R-201" }, { time: "10:00", subject: "History", room: "R-204" }] },
  { day: "Thu", slots: [{ time: "08:00", subject: "English", room: "R-205" }, { time: "10:00", subject: "Chemistry", room: "R-207" }, { time: "13:00", subject: "PE", room: "Gym" }] },
  { day: "Fri", slots: [{ time: "08:00", subject: "Physics", room: "R-210" }, { time: "10:00", subject: "Math", room: "R-201" }] },
];
