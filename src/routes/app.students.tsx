import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatusPill, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  Plus,
  Search,
  Filter,
  Printer,
  Trash2,
  X,
  Loader2,
  Eye,
  Pencil,
  Users,
  Mars,
  Venus,
  Camera,
  Upload,
  KeyRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ADDRESS_OPTIONS,
  FLAT_MAJOR_OPTIONS,
  MAJOR_OPTIONS,
  generateClassName,
} from "@/lib/academic-options";
import { generateSchoolAccountId } from "@/lib/account-ids";
import { pageTitle } from "@/lib/brand";
import { createStudentAccount } from "@/lib/student-accounts";
import { ResetPasswordModal } from "@/components/app/reset-password-modal";
import { findTeacherClassScope } from "@/lib/teacher-scope";
import { tuitionPaymentLabel, tuitionPaymentOptions, tuitionPaymentPrice } from "@/lib/tuition";

export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: pageTitle("Students") }] }),
  component: StudentsPage,
});

type StudentRow = {
  id: string;
  user_id?: string | null;
  student_code: string;
  full_name: string;
  full_name_km: string | null;
  full_name_en: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  avatar_url: string | null;
  nationality: string | null;
  place_of_birth: string | null;
  father_name: string | null;
  father_job: string | null;
  mother_name: string | null;
  mother_job: string | null;
  academic: string | null;
  major: string | null;
  student_type: string | null;
  pay_year1: string | null;
  pay_year2: string | null;
  pay_year3: string | null;
  pay_year4: string | null;
  enrollment_year: number;
  study_year: number | null;
  class_name: string | null;
  shift: string | null;
  status: "active" | "inactive" | "graduated" | "suspended";
  created_at: string;
};

const DEMO_STUDENTS_KEY = "studentsphere.demo.students";
const SHIFT_OPTIONS = [
  { value: "morning", labelKey: "morning" },
  { value: "afternoon", labelKey: "afternoon" },
  { value: "evening", labelKey: "evening" },
];
const ACADEMIC_OPTIONS = MAJOR_OPTIONS.map((group) => group.group);
const NATIONALITY_OPTIONS = ["Khmer", "Foreign"];
const STUDENT_TYPE_OPTIONS = ["បង់ថ្លៃ", "អាហារូបកណ៍"];
const BLANK_ADDRESS_OPTION = { value: "", label: "" };

function majorGroupsForAcademic(academic: string) {
  const groups = MAJOR_OPTIONS.filter((group) => group.group === academic);
  return groups.length ? groups : MAJOR_OPTIONS;
}

function firstMajorForAcademic(academic: string) {
  return (
    majorGroupsForAcademic(academic)[0]?.options[0]?.value ?? MAJOR_OPTIONS[0].options[0].value
  );
}

function paymentStudyYear(studyYear: number | string | null | undefined) {
  return Math.min(4, Math.max(1, Number(studyYear) || 1));
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

type ClassCapacityRow = { name: string; capacity: number | null };

function nextAvailableClassName({
  major,
  studyYear,
  shift,
  students,
  classes,
}: {
  major: string | null | undefined;
  studyYear: number | string | null | undefined;
  shift: string | null | undefined;
  students: Array<{ class_name?: string | null }>;
  classes: ClassCapacityRow[];
}) {
  for (let classNumber = 1; classNumber < 100; classNumber += 1) {
    const className = generateClassName(major, studyYear, shift, classNumber);
    const capacity = classes.find((classRow) => classRow.name === className)?.capacity ?? 40;
    const enrolled = students.filter((student) => student.class_name === className).length;
    if (enrolled < capacity) return className;
  }

  return generateClassName(major, studyYear, shift, 99);
}

function shiftLabel(value: string | null | undefined, t: (key: string) => string) {
  const shift = SHIFT_OPTIONS.find((option) => option.value === value);
  return shift ? t(shift.labelKey) : "—";
}

function readDemoStudents(): StudentRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_STUDENTS_KEY);
    return raw ? (JSON.parse(raw) as StudentRow[]) : [];
  } catch {
    return [];
  }
}

function writeDemoStudents(students: StudentRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_STUDENTS_KEY, JSON.stringify(students));
}

function compressAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Image must be smaller than 10 MB."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(900, Math.max(image.width, image.height));
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not process image."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image."))),
        "image/webp",
        0.82,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image."));
    };
    image.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printDocument(
  title: string,
  html: string,
  orientation: "portrait" | "landscape" = "portrait",
) {
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
        <style>
          @page { size: A4 ${orientation}; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2937;
            font-family: "Noto Sans Khmer", "Khmer OS Battambang", Arial, sans-serif;
            font-size: 11px;
          }
          .report { width: 100%; }
          .report-top {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            gap: 16px;
            align-items: start;
            margin-bottom: 10px;
          }
          .left-note { line-height: 1.7; color: #4b5563; text-align: center; }
          .title { text-align: center; line-height: 1.55; }
          .title h1, .title h2, .title h3 { margin: 0; font-weight: 700; }
          .title h1 { font-size: 15px; }
          .title h2 { font-size: 13px; }
          .title h3 { margin-top: 8px; font-size: 13px; }
          .meta { margin: 8px 0 10px; text-align: center; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #4b5563; padding: 3px 4px; text-align: center; vertical-align: middle; }
          th { font-weight: 700; background: #f3f4f6; }
          td.name, th.name { text-align: left; }
          .footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-top: 10px;
            line-height: 1.8;
          }
          .signature { margin-top: 22px; text-align: center; }
          .muted { color: #6b7280; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function studentListReportHtml(students: StudentRow[], reportTitle: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = students
    .map(
      (student, index) => `
        <tr>
          <td style="width: 28px">${index + 1}</td>
          <td style="width: 76px">${escapeHtml(student.student_code)}</td>
          <td class="name">${escapeHtml(student.full_name_km)}</td>
          <td class="name">${escapeHtml(student.full_name_en || student.full_name)}</td>
          <td style="width: 34px">${escapeHtml(student.gender?.toLowerCase().startsWith("f") ? "F" : "M")}</td>
          <td style="width: 72px">${escapeHtml(student.date_of_birth)}</td>
          <td style="width: 68px">${escapeHtml(student.class_name)}</td>
          <td style="width: 70px">${escapeHtml(student.major)}</td>
          <td style="width: 70px">${escapeHtml(student.status)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <main class="report">
      <section class="report-top">
        <div class="left-note">
          សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្ត្រ<br />
          និងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច<br />
          ការិយាល័យសិក្សា
        </div>
        <div class="title">
          <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
          <h3>${escapeHtml(reportTitle)}</h3>
        </div>
        <div></div>
      </section>
      <div class="meta">
        ឆ្នាំសិក្សា ${new Date().getFullYear()} · កាលបរិច្ឆេទ ${escapeHtml(today)}<br />
        ចំនួននិស្សិតសរុប ${students.length} នាក់
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 28px">ល.រ</th>
            <th style="width: 76px">អត្តលេខ</th>
            <th class="name">គោត្តនាម និង នាម</th>
            <th class="name">នាមជាអក្សរឡាតាំង</th>
            <th style="width: 34px">ភេទ</th>
            <th style="width: 72px">ថ្ងៃខែកំណើត</th>
            <th style="width: 68px">ក្រុម</th>
            <th style="width: 70px">ជំនាញ</th>
            <th style="width: 70px">ផ្សេងៗ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="footer">
        <div>
          បានឃើញ និងឯកភាព<br />
          ប្រធានការិយាល័យសិក្សា
          <div class="signature muted">ហត្ថលេខា</div>
        </div>
        <div>
          រាជធានីភ្នំពេញ ថ្ងៃទី ${escapeHtml(today)}<br />
          អ្នករៀបចំបញ្ជី
          <div class="signature muted">ហត្ថលេខា</div>
        </div>
      </section>
    </main>
  `;
}

function StudentsPage() {
  const { t } = useI18n();
  const { user, primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [majorFilter, setMajorFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [avatarStudent, setAvatarStudent] = useState<StudentRow | null>(null);
  const [passwordStudent, setPasswordStudent] = useState<StudentRow | null>(null);

  const isAdmin = primaryRole === "admin";
  const isStudent = primaryRole === "student";

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const rows = readDemoStudents();
        if (primaryRole === "student") {
          const ownStudent = rows[0];
          return ownStudent
            ? rows.filter((student) => student.class_name === ownStudent.class_name)
            : [];
        }
        if (primaryRole === "teacher") {
          const teacher = readDemoList<{ id: string }>("studentsphere.demo.teachers")[0];
          const classes = readDemoList<{ teacher_id?: string | null; name: string }>(
            "studentsphere.demo.classes",
          );
          const assignedClassNames = new Set(
            classes
              .filter((classRow) => !teacher || classRow.teacher_id === teacher.id)
              .map((classRow) => classRow.name),
          );
          return rows.filter((student) => assignedClassNames.has(student.class_name ?? ""));
        }
        return rows;
      }

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

  const filtered = useMemo(() => {
    return students
      .filter((s) => {
        if (filter !== "all" && s.status !== filter) return false;
        if (majorFilter !== "all" && s.major !== majorFilter) return false;
        if (classFilter !== "all" && s.class_name !== classFilter) return false;
        if (
          q &&
          !s.full_name.toLowerCase().includes(q.toLowerCase()) &&
          !(s.full_name_km ?? "").toLowerCase().includes(q.toLowerCase()) &&
          !(s.full_name_en ?? "").toLowerCase().includes(q.toLowerCase()) &&
          !(s.major ?? "").toLowerCase().includes(q.toLowerCase()) &&
          !(s.class_name ?? "").toLowerCase().includes(q.toLowerCase()) &&
          !s.student_code.toLowerCase().includes(q.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const majorCompare = (a.major ?? "").localeCompare(b.major ?? "");
        if (majorCompare !== 0) return majorCompare;
        return a.student_code.localeCompare(b.student_code);
      });
  }, [students, q, filter, majorFilter, classFilter]);

  const classOptions = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.class_name?.trim())
          .filter((className): className is string => !!className),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const printTitle =
    classFilter === "all" ? "បញ្ជីរាយនាមនិស្សិត" : `បញ្ជីរាយនាមនិស្សិត ថ្នាក់ ${classFilter}`;

  const isOwnStudent = (student: StudentRow) => student.user_id === user?.id;

  const summary = useMemo(() => {
    return {
      total: filtered.length,
      male: filtered.filter((student) => student.gender === "male").length,
      female: filtered.filter((student) => student.gender === "female").length,
    };
  }, [filtered]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        writeDemoStudents(readDemoStudents().filter((student) => student.id !== id));
        return;
      }

      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", isDemo ? "demo" : "remote"] });
      toast.success("Student deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader
        title={t("students")}
        subtitle={t("students_subtitle")}
        actions={
          <>
            <button
              onClick={() =>
                printDocument(
                  classFilter === "all" ? "Student List" : `Student List - ${classFilter}`,
                  studentListReportHtml(filtered, printTitle),
                )
              }
              disabled={filtered.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print Student List
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
              >
                <Plus className="h-4 w-4" /> {t("add_student")}
              </button>
            )}
          </>
        }
      />

      {isStudent && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StudentSummaryCard
            label={t("total")}
            value={summary.total}
            note="ក្នុងថ្នាក់"
            icon={<Users className="h-4 w-4" />}
            tone="primary"
          />
          <StudentSummaryCard
            label={t("male")}
            value={summary.male}
            note="និស្សិតប្រុស"
            icon={<Mars className="h-4 w-4" />}
            tone="info"
          />
          <StudentSummaryCard
            label={t("female")}
            value={summary.female}
            note="និស្សិតស្រី"
            icon={<Venus className="h-4 w-4" />}
            tone="success"
          />
        </div>
      )}

      <SectionCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search_students")}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex rounded-xl border border-border bg-surface p-1">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors " +
                  (filter === f
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t(f)}
              </button>
            ))}
          </div>
          {!isStudent && (
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm hover:bg-muted">
              <Filter className="h-4 w-4" /> {t("filter")}
            </button>
          )}
        </div>
        {!isStudent && (
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_repeat(3,minmax(120px,160px))]">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("sort_filter_major")}
              </label>
              <select
                value={majorFilter}
                onChange={(event) => setMajorFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="all">{t("all_majors")}</option>
                {FLAT_MAJOR_OPTIONS.map((major) => (
                  <option key={major.value} value={major.value}>
                    {major.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("filter_by_class")}
              </label>
              <select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="all">{t("all_classes")}</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
            <SummaryCard label={t("total")} value={summary.total} />
            <SummaryCard label={t("male")} value={summary.male} />
            <SummaryCard label={t("female")} value={summary.female} />
          </div>
        )}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("no_students_yet")}</p>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_student")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 pr-4">{t("student_id")}</th>
                  <th className="py-3 pr-4">{t("name")}</th>
                  <th className="py-3 pr-4">{t("gender")}</th>
                  <th className="py-3 pr-4">{t("dob")}</th>
                  <th className="py-3 pr-4">{t("year")}</th>
                  <th className="py-3 pr-4">{t("major")}</th>
                  <th className="py-3 pr-4">{t("class")}</th>
                  <th className="py-3 pr-4">{t("shift")}</th>
                  <th className="py-3 pr-4">{t("address")}</th>
                  <th className="py-3 pr-4">{t("status")}</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const canViewDetails = primaryRole !== "student" || isOwnStudent(s);
                  return (
                    <tr
                      key={s.id}
                      className="group border-b border-border/60 transition-colors hover:bg-muted/40"
                    >
                      <td className="py-3 pr-4 font-mono text-xs">{s.student_code}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.full_name_en || s.full_name} src={s.avatar_url} />
                          <div>
                            <p className="font-semibold leading-tight">
                              {s.full_name_en || s.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.full_name_km || t("khmer_name")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 capitalize">{s.gender ?? "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-xs">
                        {s.date_of_birth ?? "—"}
                      </td>
                      <td className="py-3 pr-4">{s.study_year ?? s.enrollment_year}</td>
                      <td className="max-w-64 py-3 pr-4 text-xs">
                        <span className="line-clamp-2">{s.major ?? "—"}</span>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{s.class_name ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                          {shiftLabel(s.shift, t)}
                        </span>
                      </td>
                      <td className="max-w-48 py-3 pr-4 text-xs">
                        <span className="line-clamp-2">{s.address ?? "—"}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {canViewDetails && (
                            <button
                              onClick={() => setSelectedStudent(s)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                              aria-label={`${t("view")} ${s.full_name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          {(isAdmin || isOwnStudent(s)) && (
                            <button
                              onClick={() => setAvatarStudent(s)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-success hover:bg-success/10"
                              aria-label={`${t("upload_profile_image")} ${s.full_name}`}
                              title={t("upload_profile_image")}
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setEditingStudent(s)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-info opacity-0 transition-opacity hover:bg-info/10 group-hover:opacity-100"
                                aria-label={`Update ${s.full_name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setPasswordStudent(s)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-warning opacity-0 transition-opacity hover:bg-warning/10 group-hover:opacity-100"
                                aria-label={`Reset password for ${s.full_name}`}
                                title="Reset password"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete ${s.full_name}?`)) deleteMut.mutate(s.id);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                                aria-label={`${t("delete")} ${s.full_name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          {t("showing")} {filtered.length} {t("of")} {students.length}
        </div>
      </SectionCard>

      {showAdd && (
        <AddStudentModal
          existingStudents={students}
          isDemo={isDemo}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          isDemo={isDemo}
          onClose={() => setEditingStudent(null)}
        />
      )}
      {selectedStudent && (
        <StudentInfoModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
      {avatarStudent && (
        <StudentAvatarModal
          student={avatarStudent}
          isDemo={isDemo}
          onClose={() => setAvatarStudent(null)}
        />
      )}
      {passwordStudent && (
        <ResetPasswordModal
          title="Reset student password"
          subtitle={`${passwordStudent.full_name_en || passwordStudent.full_name} · ${passwordStudent.student_code}`}
          userId={passwordStudent.user_id}
          isDemo={isDemo}
          onClose={() => setPasswordStudent(null)}
        />
      )}
    </div>
  );
}

function StudentAvatarModal({
  student,
  isDemo,
  onClose,
}: {
  student: StudentRow;
  isDemo: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { session, refresh } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(student.avatar_url ?? "");

  const uploadAvatar = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("choose_image"));
      const blob = await compressAvatar(file);
      const dataUrl = await blobToDataUrl(blob);

      if (isDemo) {
        writeDemoStudents(
          readDemoStudents().map((row) =>
            row.id === student.id ? { ...row, avatar_url: dataUrl } : row,
          ),
        );
        return;
      }

      if (!session?.access_token || !session.user?.id) {
        throw new Error(t("session_expired_login"));
      }

      const { error: avatarError } = await supabase.rpc("set_student_avatar", {
        p_student_id: student.id,
        p_avatar_url: dataUrl,
      });
      if (avatarError) {
        const missingRpc =
          avatarError.code === "PGRST202" ||
          avatarError.message.toLowerCase().includes("schema cache");
        if (!missingRpc) throw avatarError;

        const { error: updateError } = await supabase
          .from("students")
          .update({ avatar_url: dataUrl })
          .eq("id", student.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student-dashboard"] });
      void refresh();
      toast.success(t("profile_image_updated"));
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold">{t("upload_profile_image")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {student.full_name_en || student.full_name} · {student.student_code}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-muted"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          {preview ? (
            <img
              src={preview}
              alt={t("upload_profile_image")}
              className="h-32 w-32 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <Avatar
              name={student.full_name_en || student.full_name}
              className="h-32 w-32 rounded-xl text-2xl"
            />
          )}
          <label className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted">
            <Camera className="h-4 w-4" />
            {t("choose_image")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const selected = event.currentTarget.files?.[0] ?? null;
                setFile(selected);
                if (selected) setPreview(URL.createObjectURL(selected));
              }}
            />
          </label>
          <p className="mt-2 text-center text-xs text-muted-foreground">{t("image_upload_hint")}</p>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => uploadAvatar.mutate()}
            disabled={!file || uploadAvatar.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {uploadAvatar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("upload")}
          </button>
        </div>
      </div>
    </div>
  );
}

function payYearLabel(value: string | null | undefined, major: string | null | undefined) {
  return tuitionPaymentLabel(value, major);
}

function academicYearLabel(enrollmentYear: number | null | undefined) {
  const year = Number(enrollmentYear) || new Date().getFullYear();
  return `${year}-${year + 1}`;
}

function StudentInfoModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  const { t } = useI18n();
  const fullName = student.full_name_en || student.full_name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={fullName}
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-border"
              />
            ) : (
              <Avatar name={fullName} className="h-14 w-14 text-base" />
            )}
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold">
                {t("student_information")}
              </h3>
              <p className="mt-1 truncate text-sm font-semibold">{fullName}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {student.student_code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={student.status} />
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
            <InfoField label={t("student_id")} value={student.student_code} />
            <InfoField label={t("name_in_khmer")} value={student.full_name_km} />
            <InfoField
              label={t("name_in_latin")}
              value={student.full_name_en || student.full_name}
            />
            <InfoField label={t("gender")} value={student.gender} />
            <InfoField label={t("nationality")} value={student.nationality} />
            <InfoField label={t("dob")} value={student.date_of_birth} />
            <InfoField label={t("place_of_birth")} value={student.place_of_birth} />
            <InfoField label={t("father_name")} value={student.father_name} />
            <InfoField label={t("father_job")} value={student.father_job} />
            <InfoField label={t("mother_name")} value={student.mother_name} />
            <InfoField label={t("mother_job")} value={student.mother_job} />
            <InfoField label={t("phone")} value={student.phone} />
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
              <InfoField label={t("academic")} value={student.academic} />
              <InfoField
                label={t("academic_year")}
                value={academicYearLabel(student.enrollment_year)}
              />
              <InfoField label={t("major")} value={student.major} />
              <InfoField label={t("type_of_student")} value={student.student_type} />
              <InfoField label={t("class")} value={student.class_name} />
              <InfoField label={t("shift")} value={shiftLabel(student.shift, t)} />
              <InfoField label={t("year")} value={student.study_year} />
              <InfoField
                label={t("pay_year1")}
                value={payYearLabel(student.pay_year1, student.major)}
              />
              <InfoField
                label={t("pay_year2")}
                value={payYearLabel(student.pay_year2, student.major)}
              />
              <InfoField
                label={t("pay_year3")}
                value={payYearLabel(student.pay_year3, student.major)}
              />
              <InfoField
                label={t("pay_year4")}
                value={payYearLabel(student.pay_year4, student.major)}
              />
              <InfoField label={t("email")} value={student.email} />
              <InfoField label={t("image")} value={student.avatar_url} />
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <InfoField label={t("address")} value={student.address} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 min-h-5 break-words text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function AddStudentModal({
  existingStudents,
  isDemo,
  onClose,
}: {
  existingStudents: StudentRow[];
  isDemo: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { session } = useAuth();
  const qc = useQueryClient();
  const currentEnrollmentYear = new Date().getFullYear();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const academicYearOptions = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => {
        const year = currentEnrollmentYear + index;
        return { value: String(year), label: `${year}-${year + 1}` };
      }),
    [currentEnrollmentYear],
  );
  const { data: classCapacityRows = [] } = useQuery({
    queryKey: ["class-capacities", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<ClassCapacityRow>("studentsphere.demo.classes").map((classRow) => ({
          name: classRow.name,
          capacity: classRow.capacity,
        }));
      }

      const { data, error } = await supabase.from("classes").select("name,capacity");
      if (error) throw error;
      return (data ?? []) as ClassCapacityRow[];
    },
  });
  const [form, setForm] = useState(() => {
    return {
      student_code: generateSchoolAccountId("student", currentEnrollmentYear),
      full_name_km: "",
      full_name_en: "",
      gender: "male",
      date_of_birth: "",
      nationality: "Khmer",
      place_of_birth: "",
      father_name: "",
      father_job: "",
      mother_name: "",
      mother_job: "",
      phone: "",
      academic: ACADEMIC_OPTIONS[0],
      enrollment_year: currentEnrollmentYear,
      study_year: 1,
      major: MAJOR_OPTIONS[0].options[0].value,
      student_type: STUDENT_TYPE_OPTIONS[0],
      class_name: generateClassName(MAJOR_OPTIONS[0].options[0].value, 1, "morning"),
      shift: "morning",
      pay_year1: "not_yet",
      pay_year2: "not_yet",
      pay_year3: "not_yet",
      pay_year4: "not_yet",
      email: "",
      password: "",
      avatar_url: "",
      address: "",
    };
  });

  const mut = useMutation({
    mutationFn: async () => {
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        const blob = await compressAvatar(avatarFile);
        avatarUrl = await blobToDataUrl(blob);
      }
      const enrollmentYear = Math.max(
        Number(form.enrollment_year) || currentEnrollmentYear,
        currentEnrollmentYear,
      );
      const assignedClassName = nextAvailableClassName({
        major: form.major,
        studyYear: form.study_year,
        shift: form.shift,
        students: existingStudents,
        classes: classCapacityRows,
      });
      if (isDemo) {
        const studentCode =
          form.student_code.trim().toUpperCase().replaceAll(".", "-") ||
          generateSchoolAccountId("student", enrollmentYear);
        const newStudent: StudentRow = {
          id: `demo-student-${Date.now()}`,
          user_id: `demo-student-user-${Date.now()}`,
          student_code: studentCode,
          full_name: form.full_name_en || form.full_name_km,
          full_name_km: form.full_name_km || null,
          full_name_en: form.full_name_en || null,
          email: form.email || null,
          phone: form.phone || null,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          avatar_url: avatarUrl || null,
          nationality: form.nationality || null,
          place_of_birth: form.place_of_birth || null,
          father_name: form.father_name || null,
          father_job: form.father_job || null,
          mother_name: form.mother_name || null,
          mother_job: form.mother_job || null,
          academic: form.academic || null,
          study_year: Number(form.study_year),
          major: form.major || null,
          student_type: form.student_type || null,
          class_name: assignedClassName,
          shift: form.shift || null,
          pay_year1: form.pay_year1 || null,
          pay_year2: form.pay_year2 || null,
          pay_year3: form.pay_year3 || null,
          pay_year4: form.pay_year4 || null,
          address: form.address || null,
          enrollment_year: enrollmentYear,
          status: "active",
          created_at: new Date().toISOString(),
        };

        writeDemoStudents([newStudent, ...readDemoStudents()]);
        return;
      }

      if (!session?.access_token) {
        throw new Error("Your admin session expired. Please log in again.");
      }

      await createStudentAccount({
        data: {
          accessToken: session.access_token,
          student: {
            password: form.password,
            student_code: form.student_code.trim().replaceAll(".", "-"),
            enrollment_year: enrollmentYear,
            full_name: form.full_name_en || form.full_name_km,
            full_name_km: form.full_name_km || null,
            full_name_en: form.full_name_en || null,
            email: form.email || null,
            phone: form.phone || null,
            gender: form.gender || null,
            date_of_birth: form.date_of_birth || null,
            avatar_url: avatarUrl || null,
            nationality: form.nationality || null,
            place_of_birth: form.place_of_birth || null,
            father_name: form.father_name || null,
            father_job: form.father_job || null,
            mother_name: form.mother_name || null,
            mother_job: form.mother_job || null,
            academic: form.academic || null,
            study_year: Number(form.study_year),
            major: form.major || null,
            student_type: form.student_type || null,
            class_name: assignedClassName,
            shift: form.shift || null,
            pay_year1: form.pay_year1 || "not_yet",
            pay_year2: form.pay_year2 || "not_yet",
            pay_year3: form.pay_year3 || "not_yet",
            pay_year4: form.pay_year4 || "not_yet",
            address: form.address || null,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recent-students"] });
      toast.success(isDemo ? "Demo student added" : "Student added");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const selectedMajorGroups = majorGroupsForAcademic(form.academic);
  const assignedClassName = nextAvailableClassName({
    major: form.major,
    studyYear: form.study_year,
    shift: form.shift,
    students: existingStudents,
    classes: classCapacityRows,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold">{t("student_information")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("add_student")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.full_name_km.trim()) return toast.error(t("khmer_name"));
            if (!form.full_name_en.trim()) return toast.error(t("english_name"));
            if (!form.major.trim()) return toast.error(t("major"));
            if (!assignedClassName.trim()) return toast.error(t("class"));
            if (!form.password.trim()) return toast.error(t("password"));
            mut.mutate();
          }}
          className="overflow-y-auto p-6"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label={t("student_id")}
              placeholder={`Auto: RULE${String(form.enrollment_year).slice(-2)}-1234`}
              value={form.student_code}
              onChange={(v) => setForm({ ...form, student_code: v.toUpperCase() })}
              autoComplete="off"
              name="student-code"
              readOnly
            />
            <Input
              label={`${t("name_in_khmer")} *`}
              placeholder="ឈ្មោះជាភាសាខ្មែរ"
              value={form.full_name_km}
              onChange={(v) => setForm({ ...form, full_name_km: v })}
            />
            <Input
              label={`${t("name_in_latin")} *`}
              placeholder="KEO SALITA"
              value={form.full_name_en}
              onChange={(v) => setForm({ ...form, full_name_en: v.toUpperCase() })}
            />
            <Select
              label={`${t("gender")} *`}
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v })}
              options={[
                { value: "male", label: t("male") },
                { value: "female", label: t("female") },
                { value: "other", label: t("other") },
              ]}
            />
            <Select
              label={t("nationality")}
              value={form.nationality}
              onChange={(v) => setForm({ ...form, nationality: v })}
              options={NATIONALITY_OPTIONS.map((nationality) => ({
                value: nationality,
                label: nationality,
              }))}
            />
            <Input
              label={t("dob")}
              type="date"
              value={form.date_of_birth}
              onChange={(v) => setForm({ ...form, date_of_birth: v })}
            />
            <Select
              label={t("place_of_birth")}
              value={form.place_of_birth}
              onChange={(v) => setForm({ ...form, place_of_birth: v })}
              options={[
                BLANK_ADDRESS_OPTION,
                ...ADDRESS_OPTIONS.map((address) => ({ value: address, label: address })),
              ]}
            />
            <Input
              label={t("father_name")}
              value={form.father_name}
              onChange={(v) => setForm({ ...form, father_name: v })}
            />
            <Input
              label={t("father_job")}
              value={form.father_job}
              onChange={(v) => setForm({ ...form, father_job: v })}
            />
            <Input
              label={t("mother_name")}
              value={form.mother_name}
              onChange={(v) => setForm({ ...form, mother_name: v })}
            />
            <Input
              label={t("mother_job")}
              value={form.mother_job}
              onChange={(v) => setForm({ ...form, mother_job: v })}
            />
            <Input
              label={t("phone")}
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: digitsOnly(v) })}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <Select
              label={t("academic")}
              value={form.academic}
              onChange={(v) => {
                const major = firstMajorForAcademic(v);
                setForm({
                  ...form,
                  academic: v,
                  major,
                  class_name: generateClassName(major, form.study_year, form.shift),
                });
              }}
              options={ACADEMIC_OPTIONS.map((academic) => ({ value: academic, label: academic }))}
            />
            <Select
              label={`${t("academic_year")} *`}
              value={String(form.enrollment_year)}
              onChange={(v) => {
                const enrollmentYear = Math.max(
                  Number(v) || currentEnrollmentYear,
                  currentEnrollmentYear,
                );
                setForm({
                  ...form,
                  enrollment_year: enrollmentYear,
                  student_code: generateSchoolAccountId("student", enrollmentYear),
                });
              }}
              options={academicYearOptions}
            />
            <GroupedSelect
              label={`${t("major")} *`}
              value={form.major}
              onChange={(v) =>
                setForm({
                  ...form,
                  major: v,
                  class_name: generateClassName(v, form.study_year, form.shift),
                })
              }
              groups={selectedMajorGroups}
            />
            <Select
              label={t("type_of_student")}
              value={form.student_type}
              onChange={(v) => setForm({ ...form, student_type: v })}
              options={STUDENT_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
            />
            <Input
              label={`${t("class")} *`}
              placeholder="IT1A01"
              value={assignedClassName}
              onChange={() => {}}
              readOnly
            />
            <Select
              label={`${t("shift")} *`}
              value={form.shift}
              onChange={(v) =>
                setForm({
                  ...form,
                  shift: v,
                  class_name: generateClassName(form.major, form.study_year, v),
                })
              }
              options={SHIFT_OPTIONS.map((shift) => ({
                value: shift.value,
                label: t(shift.labelKey),
              }))}
            />
            <Input
              label={`${t("year")} *`}
              type="number"
              value={String(form.study_year)}
              onChange={(v) => {
                const studyYear = Number(v) || 1;
                setForm({
                  ...form,
                  study_year: studyYear,
                  class_name: generateClassName(form.major, studyYear, form.shift),
                });
              }}
            />
            <PaymentYearSelect
              label={t(`pay_year${paymentStudyYear(form.study_year)}`)}
              major={form.major}
              value={
                paymentStudyYear(form.study_year) === 1
                  ? form.pay_year1
                  : paymentStudyYear(form.study_year) === 2
                    ? form.pay_year2
                    : paymentStudyYear(form.study_year) === 3
                      ? form.pay_year3
                      : form.pay_year4
              }
              onChange={(v) => {
                const year = paymentStudyYear(form.study_year);
                setForm({
                  ...form,
                  ...(year === 1 ? { pay_year1: v } : {}),
                  ...(year === 2 ? { pay_year2: v } : {}),
                  ...(year === 3 ? { pay_year3: v } : {}),
                  ...(year === 4 ? { pay_year4: v } : {}),
                });
              }}
            />
            <Input
              label={t("email")}
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              autoComplete="off"
              name="new-student-email"
            />
            <Input
              label={`${t("password")} *`}
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete="new-password"
              name="new-student-password"
            />
            <ImageUploadField
              label={t("image")}
              name={form.full_name_en || form.full_name_km || t("student_information")}
              value={form.avatar_url}
              file={avatarFile}
              onFileChange={setAvatarFile}
              onRemove={() => {
                setAvatarFile(null);
                setForm({ ...form, avatar_url: "" });
              }}
            />
            <div className="md:col-span-3">
              <Select
                label={t("address")}
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                options={[
                  BLANK_ADDRESS_OPTION,
                  ...ADDRESS_OPTIONS.map((address) => ({ value: address, label: address })),
                ]}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow disabled:opacity-60"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save_student")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStudentModal({
  student,
  isDemo,
  onClose,
}: {
  student: StudentRow;
  isDemo: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [form, setForm] = useState(() => ({
    student_code: student.student_code,
    full_name_km: student.full_name_km ?? "",
    full_name_en: student.full_name_en ?? student.full_name,
    gender: student.gender ?? "male",
    date_of_birth: student.date_of_birth ?? "",
    nationality: student.nationality ?? "Khmer",
    place_of_birth: student.place_of_birth ?? "",
    father_name: student.father_name ?? "",
    father_job: student.father_job ?? "",
    mother_name: student.mother_name ?? "",
    mother_job: student.mother_job ?? "",
    phone: student.phone ?? "",
    academic: student.academic ?? ACADEMIC_OPTIONS[0],
    enrollment_year: student.enrollment_year,
    study_year: student.study_year ?? 1,
    major: student.major ?? MAJOR_OPTIONS[0].options[0].value,
    student_type: student.student_type ?? STUDENT_TYPE_OPTIONS[0],
    class_name: student.class_name ?? "",
    shift: student.shift ?? "morning",
    pay_year1: student.pay_year1 ?? "not_yet",
    pay_year2: student.pay_year2 ?? "not_yet",
    pay_year3: student.pay_year3 ?? "not_yet",
    pay_year4: student.pay_year4 ?? "not_yet",
    email: student.email ?? "",
    avatar_url: student.avatar_url ?? "",
    address: student.address ?? "",
    status: student.status,
  }));

  const mut = useMutation({
    mutationFn: async () => {
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        const blob = await compressAvatar(avatarFile);
        avatarUrl = await blobToDataUrl(blob);
      }
      const payload = {
        student_code: form.student_code.trim().toUpperCase().replaceAll(".", "-"),
        full_name: form.full_name_en || form.full_name_km,
        full_name_km: form.full_name_km || null,
        full_name_en: form.full_name_en || null,
        email: form.email || null,
        phone: form.phone || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        avatar_url: avatarUrl || null,
        nationality: form.nationality || null,
        place_of_birth: form.place_of_birth || null,
        father_name: form.father_name || null,
        father_job: form.father_job || null,
        mother_name: form.mother_name || null,
        mother_job: form.mother_job || null,
        academic: form.academic || null,
        enrollment_year: Number(form.enrollment_year) || new Date().getFullYear(),
        study_year: Number(form.study_year) || null,
        major: form.major || null,
        student_type: form.student_type || null,
        class_name: form.class_name || null,
        shift: form.shift || null,
        pay_year1: form.pay_year1 || "not_yet",
        pay_year2: form.pay_year2 || "not_yet",
        pay_year3: form.pay_year3 || "not_yet",
        pay_year4: form.pay_year4 || "not_yet",
        address: form.address || null,
        status: form.status,
      };

      if (isDemo) {
        writeDemoStudents(
          readDemoStudents().map((row) =>
            row.id === student.id
              ? {
                  ...row,
                  ...payload,
                  created_at: row.created_at,
                }
              : row,
          ),
        );
        return;
      }

      const { error } = await supabase.from("students").update(payload).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recent-students"] });
      toast.success(t("student_information_updated"));
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const selectedMajorGroups = majorGroupsForAcademic(form.academic);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold">{t("update_student_information")}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{student.student_code}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.full_name_km.trim()) return toast.error(t("khmer_name"));
            if (!form.full_name_en.trim()) return toast.error(t("english_name"));
            if (!form.major.trim()) return toast.error(t("major"));
            if (!form.class_name.trim()) return toast.error(t("class"));
            mut.mutate();
          }}
          className="overflow-y-auto p-6"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label={t("student_id")}
              value={form.student_code}
              onChange={(v) => setForm({ ...form, student_code: v.toUpperCase() })}
              autoComplete="off"
              name="edit-student-code"
            />
            <Input
              label={`${t("name_in_khmer")} *`}
              value={form.full_name_km}
              onChange={(v) => setForm({ ...form, full_name_km: v })}
            />
            <Input
              label={`${t("name_in_latin")} *`}
              value={form.full_name_en}
              onChange={(v) => setForm({ ...form, full_name_en: v.toUpperCase() })}
            />
            <Select
              label={`${t("gender")} *`}
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v })}
              options={[
                { value: "male", label: t("male") },
                { value: "female", label: t("female") },
                { value: "other", label: t("other") },
              ]}
            />
            <Select
              label={t("nationality")}
              value={form.nationality}
              onChange={(v) => setForm({ ...form, nationality: v })}
              options={NATIONALITY_OPTIONS.map((nationality) => ({
                value: nationality,
                label: nationality,
              }))}
            />
            <Input
              label={t("dob")}
              type="date"
              value={form.date_of_birth}
              onChange={(v) => setForm({ ...form, date_of_birth: v })}
            />
            <Select
              label={t("place_of_birth")}
              value={form.place_of_birth}
              onChange={(v) => setForm({ ...form, place_of_birth: v })}
              options={[
                BLANK_ADDRESS_OPTION,
                ...ADDRESS_OPTIONS.map((address) => ({ value: address, label: address })),
              ]}
            />
            <Input
              label={t("father_name")}
              value={form.father_name}
              onChange={(v) => setForm({ ...form, father_name: v })}
            />
            <Input
              label={t("father_job")}
              value={form.father_job}
              onChange={(v) => setForm({ ...form, father_job: v })}
            />
            <Input
              label={t("mother_name")}
              value={form.mother_name}
              onChange={(v) => setForm({ ...form, mother_name: v })}
            />
            <Input
              label={t("mother_job")}
              value={form.mother_job}
              onChange={(v) => setForm({ ...form, mother_job: v })}
            />
            <Input
              label={t("phone")}
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: digitsOnly(v) })}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <Select
              label={t("academic")}
              value={form.academic}
              onChange={(v) => {
                const major = firstMajorForAcademic(v);
                setForm({
                  ...form,
                  academic: v,
                  major,
                  class_name: generateClassName(major, form.study_year, form.shift),
                });
              }}
              options={ACADEMIC_OPTIONS.map((academic) => ({ value: academic, label: academic }))}
            />
            <Input
              label={`${t("academic_year")} *`}
              type="number"
              value={String(form.enrollment_year)}
              onChange={(v) =>
                setForm({ ...form, enrollment_year: Number(v) || new Date().getFullYear() })
              }
            />
            <GroupedSelect
              label={`${t("major")} *`}
              value={form.major}
              onChange={(v) =>
                setForm({
                  ...form,
                  major: v,
                  class_name: generateClassName(v, form.study_year, form.shift),
                })
              }
              groups={selectedMajorGroups}
            />
            <Select
              label={t("type_of_student")}
              value={form.student_type}
              onChange={(v) => setForm({ ...form, student_type: v })}
              options={STUDENT_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
            />
            <Input
              label={`${t("class")} *`}
              value={form.class_name}
              onChange={(v) => setForm({ ...form, class_name: v.toUpperCase() })}
            />
            <Select
              label={`${t("shift")} *`}
              value={form.shift}
              onChange={(v) =>
                setForm({
                  ...form,
                  shift: v,
                  class_name: generateClassName(form.major, form.study_year, v),
                })
              }
              options={SHIFT_OPTIONS.map((shift) => ({
                value: shift.value,
                label: t(shift.labelKey),
              }))}
            />
            <Input
              label={`${t("year")} *`}
              type="number"
              value={String(form.study_year)}
              onChange={(v) => {
                const studyYear = Number(v) || 1;
                setForm({
                  ...form,
                  study_year: studyYear,
                  class_name: generateClassName(form.major, studyYear, form.shift),
                });
              }}
            />
            <PaymentYearSelect
              label={t(`pay_year${paymentStudyYear(form.study_year)}`)}
              major={form.major}
              value={
                paymentStudyYear(form.study_year) === 1
                  ? form.pay_year1
                  : paymentStudyYear(form.study_year) === 2
                    ? form.pay_year2
                    : paymentStudyYear(form.study_year) === 3
                      ? form.pay_year3
                      : form.pay_year4
              }
              onChange={(v) => {
                const year = paymentStudyYear(form.study_year);
                setForm({
                  ...form,
                  ...(year === 1 ? { pay_year1: v } : {}),
                  ...(year === 2 ? { pay_year2: v } : {}),
                  ...(year === 3 ? { pay_year3: v } : {}),
                  ...(year === 4 ? { pay_year4: v } : {}),
                });
              }}
            />
            <Input
              label={t("email")}
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <ImageUploadField
              label={t("image")}
              name={form.full_name_en || form.full_name_km || student.full_name}
              value={form.avatar_url}
              file={avatarFile}
              onFileChange={setAvatarFile}
              onRemove={() => {
                setAvatarFile(null);
                setForm({ ...form, avatar_url: "" });
              }}
            />
            <Select
              label={t("status")}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v as StudentRow["status"] })}
              options={[
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
                { value: "graduated", label: "Graduated" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
            <div className="md:col-span-3">
              <Select
                label={t("address")}
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                options={[
                  BLANK_ADDRESS_OPTION,
                  ...ADDRESS_OPTIONS.map((address) => ({ value: address, label: address })),
                ]}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow disabled:opacity-60"
            >
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ImageUploadField({
  label,
  name,
  value,
  file,
  onFileChange,
  onRemove,
}: {
  label: string;
  name: string;
  value: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState(value);

  useEffect(() => {
    if (!file) {
      setPreview(value);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, value]);

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex min-h-10 items-center gap-3 rounded-xl border border-border bg-surface p-2">
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <Avatar name={name} className="h-14 w-14 shrink-0 rounded-lg" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted">
              <Camera className="h-4 w-4" />
              {t("choose_image")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.currentTarget.files?.[0] ?? null;
                  if (selected && !selected.type.startsWith("image/")) {
                    toast.error(t("choose_image"));
                    event.currentTarget.value = "";
                    return;
                  }
                  onFileChange(selected);
                }}
              />
            </label>
            {(preview || file) && (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-destructive hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
                {t("remove_image")}
              </button>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {file ? file.name : t("image_upload_hint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function PaymentYearSelect({
  label,
  major,
  value,
  onChange,
}: {
  label: string;
  major: string | null | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="grid overflow-hidden rounded-xl border border-border bg-surface focus-within:border-primary sm:grid-cols-[1fr_120px]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 min-w-0 border-0 bg-transparent px-3 text-sm outline-none"
        >
          {tuitionPaymentOptions(major).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex h-10 items-center justify-between border-t border-border bg-muted/40 px-3 sm:border-l sm:border-t-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Price
          </span>
          <span className="font-mono text-sm font-bold text-primary">
            {tuitionPaymentPrice(value, major)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StudentSummaryCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
  tone: "primary" | "info" | "success";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
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

function GroupedSelect({
  label,
  value,
  onChange,
  groups,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groups: Array<{ group: string; options: Array<{ value: string; label: string }> }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      >
        {groups.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  pattern,
  name,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  pattern?: string;
  name?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={
          "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary " +
          (readOnly ? "cursor-default text-muted-foreground" : "")
        }
      />
    </div>
  );
}
