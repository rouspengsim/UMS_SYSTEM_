import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Plus, Loader2, X, Trash2, School, User, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FLAT_MAJOR_OPTIONS, MAJOR_OPTIONS } from "@/lib/academic-options";
import { DEFAULT_SUBJECT_OPTIONS, readDemoSubjects, subjectRowsToOptions } from "@/lib/subjects";

export const Route = createFileRoute("/app/classes")({
  head: () => ({ meta: [{ title: "Classes — RULE" }] }),
  component: ClassesPage,
});

type ClassRow = {
  id: string;
  name: string;
  subject_code: string;
  major?: string | null;
  shift?: string | null;
  room: string | null;
  capacity: number;
  semester: string | null;
  teacher_id: string | null;
  teachers: { full_name: string } | null;
};

type ClassStudent = {
  id: string;
  student_code: string;
  full_name: string;
  full_name_en?: string | null;
  full_name_km?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  study_year?: number | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  major?: string | null;
  class_name?: string | null;
  shift?: string | null;
};

const DEMO_CLASSES_KEY = "studentsphere.demo.classes";
const CLASS_SHIFT_OPTIONS = [
  { value: "morning", labelKey: "morning" },
  { value: "afternoon", labelKey: "afternoon" },
  { value: "evening", labelKey: "evening" },
];

function shiftLabel(value: string | null | undefined, t: (key: string) => string) {
  const shift = CLASS_SHIFT_OPTIONS.find((option) => option.value === value);
  return shift ? t(shift.labelKey) : null;
}

function readDemoClasses(): ClassRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_CLASSES_KEY);
    return raw ? (JSON.parse(raw) as ClassRow[]) : [];
  } catch {
    return [];
  }
}

function writeDemoClasses(classes: ClassRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_CLASSES_KEY, JSON.stringify(classes));
}

function readDemoStudents(): ClassStudent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("studentsphere.demo.students");
    return raw ? (JSON.parse(raw) as ClassStudent[]) : [];
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
        <style>
          @page { size: A4 portrait; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2937;
            font-family: "Noto Sans Khmer", "Khmer OS Battambang", Arial, sans-serif;
            font-size: 11px;
          }
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
          th, td { border: 1px solid #4b5563; padding: 4px; text-align: center; vertical-align: middle; }
          th { font-weight: 700; background: #f3f4f6; }
          td.name, th.name { text-align: left; }
          .footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-top: 12px;
            line-height: 1.8;
          }
          .signature { margin-top: 24px; text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function classStudentListReportHtml(classRow: ClassRow, students: ClassStudent[]) {
  const today = new Date().toISOString().slice(0, 10);
  const sortedStudents = [...students].sort((a, b) => a.student_code.localeCompare(b.student_code));
  const rows = sortedStudents
    .map(
      (student, index) => `
        <tr>
          <td style="width: 32px">${index + 1}</td>
          <td style="width: 78px">${escapeHtml(student.student_code)}</td>
          <td class="name">${escapeHtml(student.full_name_km)}</td>
          <td class="name">${escapeHtml(student.full_name_en || student.full_name)}</td>
          <td style="width: 38px">${escapeHtml(student.gender?.toLowerCase().startsWith("f") ? "F" : "M")}</td>
          <td style="width: 74px">${escapeHtml(student.date_of_birth)}</td>
          <td style="width: 54px">${escapeHtml(student.study_year)}</td>
          <td style="width: 82px">${escapeHtml(student.phone)}</td>
          <td>${escapeHtml(student.address)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <main>
      <section class="report-top">
        <div class="left-note">
          សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្ត្រ<br />
          និងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច<br />
          ការិយាល័យសិក្សា
        </div>
        <div class="title">
          <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
          <h3>បញ្ជីរាយនាមនិស្សិត ថ្នាក់ ${escapeHtml(classRow.name)}</h3>
        </div>
        <div></div>
      </section>
      <div class="meta">
        ថ្នាក់ ${escapeHtml(classRow.name)}
        ${classRow.major ? ` · ជំនាញ ${escapeHtml(classRow.major)}` : ""}
        ${classRow.shift ? ` · វេន ${escapeHtml(classRow.shift)}` : ""}<br />
        ឆ្នាំសិក្សា ${new Date().getFullYear()} · កាលបរិច្ឆេទ ${escapeHtml(today)} · ចំនួននិស្សិតសរុប ${students.length} នាក់
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 32px">ល.រ</th>
            <th style="width: 78px">អត្តលេខ</th>
            <th class="name">គោត្តនាម និង នាម</th>
            <th class="name">នាមជាអក្សរឡាតាំង</th>
            <th style="width: 38px">ភេទ</th>
            <th style="width: 74px">ថ្ងៃខែកំណើត</th>
            <th style="width: 54px">ឆ្នាំ</th>
            <th style="width: 82px">ទូរស័ព្ទ</th>
            <th>អាសយដ្ឋាន</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="footer">
        <div>
          បានឃើញ និងឯកភាព<br />
          ប្រធានការិយាល័យសិក្សា
          <div class="signature">ហត្ថលេខា</div>
        </div>
        <div>
          រាជធានីភ្នំពេញ ថ្ងៃទី ${escapeHtml(today)}<br />
          អ្នករៀបចំបញ្ជី
          <div class="signature">ហត្ថលេខា</div>
        </div>
      </section>
    </main>
  `;
}

function ClassesPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [majorFilter, setMajorFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [selectedClass, setSelectedClass] = useState<{
    classRow: ClassRow;
    students: ClassStudent[];
  } | null>(null);
  const isAdmin = primaryRole === "admin";
  const isStudent = primaryRole === "student";

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoClasses();

      const { data, error } = await supabase
        .from("classes")
        .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
  });

  const { data: enrollCounts = {} } = useQuery({
    queryKey: ["class-enrollment-counts", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return {};

      const { data } = await supabase.from("enrollments").select("class_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        counts[r.class_id] = (counts[r.class_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const { data: classStudents = [] } = useQuery({
    queryKey: ["class-students", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoStudents();

      const { data, error } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_en,full_name_km,gender,date_of_birth,study_year,address,phone,email,status,major,class_name,shift",
        );
      if (error) throw error;
      return (data ?? []) as unknown as ClassStudent[];
    },
  });

  const majorOptions = FLAT_MAJOR_OPTIONS;

  const displayClasses = useMemo(() => {
    const studentClassNames = new Set(
      classStudents
        .map((student) => student.class_name)
        .filter((className): className is string => !!className),
    );
    const matchingClassNames = new Set(
      classStudents
        .filter(
          (student) =>
            (majorFilter === "all" || student.major === majorFilter) &&
            (shiftFilter === "all" || student.shift === shiftFilter),
        )
        .map((student) => student.class_name)
        .filter((className): className is string => !!className),
    );

    const syntheticClasses: ClassRow[] = Array.from(matchingClassNames)
      .filter((className) => !classes.some((classRow) => classRow.name === className))
      .map((className) => ({
        id: `student-class-${className}`,
        name: className,
        subject_code: className,
        major:
          classStudents.find(
            (student) =>
              student.class_name === className &&
              (majorFilter === "all" || student.major === majorFilter) &&
              (shiftFilter === "all" || student.shift === shiftFilter),
          )?.major ?? null,
        shift:
          classStudents.find(
            (student) =>
              student.class_name === className &&
              (majorFilter === "all" || student.major === majorFilter) &&
              (shiftFilter === "all" || student.shift === shiftFilter),
          )?.shift ?? null,
        room: null,
        capacity: Math.max(40, classStudents.filter((student) => student.class_name === className).length),
        semester: null,
        teacher_id: null,
        teachers: null,
      }));

    const combined = [...classes, ...syntheticClasses];
    return combined.filter((classRow) => {
      if (isStudent && !studentClassNames.has(classRow.name)) return false;
      const matchesMajor =
        majorFilter === "all" || classRow.major === majorFilter || matchingClassNames.has(classRow.name);
      const classHasStudentInShift = classStudents.some(
        (student) => student.class_name === classRow.name && student.shift === shiftFilter,
      );
      const matchesShift =
        shiftFilter === "all" || classRow.shift === shiftFilter || classHasStudentInShift;
      return matchesMajor && matchesShift;
    });
  }, [classes, classStudents, isStudent, majorFilter, shiftFilter]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        writeDemoClasses(readDemoClasses().filter((classRow) => classRow.id !== id));
        return;
      }

      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Class deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("classes")}
        subtitle={t("classes_subtitle")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("add_class")}
            </button>
          )
        }
      />
      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("major")}
            </label>
            <select
              value={majorFilter}
              onChange={(e) => setMajorFilter(e.target.value)}
              className="h-10 min-w-72 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="all">{t("all_majors")}</option>
              {majorOptions.map((major) => (
                <option key={major.value} value={major.value}>
                  {major.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("shift")}
            </label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="h-10 min-w-44 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="all">{t("all_shifts")}</option>
              {CLASS_SHIFT_OPTIONS.map((shift) => (
                <option key={shift.value} value={shift.value}>
                  {t(shift.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Classes are matched by the student's class field. Example: a student with class IE4C02
            appears inside class IE4C02.
          </p>
        </div>
      </SectionCard>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : displayClasses.length === 0 ? (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("no_classes_yet")}
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_class")}
              </button>
            )}
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayClasses.map((c) => {
            const allStudentsInClass = classStudents.filter((student) => student.class_name === c.name);
            const studentsInClass = allStudentsInClass.filter(
              (student) =>
                (majorFilter === "all" || student.major === majorFilter) &&
                (shiftFilter === "all" || student.shift === shiftFilter),
            );
            const count = allStudentsInClass.length || enrollCounts[c.id] || 0;
            const pct = Math.min(100, Math.round((count / Math.max(1, c.capacity)) * 100));
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedClass({ classRow: c, students: allStudentsInClass })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedClass({ classRow: c, students: allStudentsInClass });
                  }
                }}
                className="group rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <School className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.subject_code}
                        {c.room ? ` · ${c.room}` : ""}
                      </p>
                      {c.shift && (
                        <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {shiftLabel(c.shift, t)}
                        </p>
                      )}
                      {c.major && (
                        <p className="mt-1 line-clamp-1 max-w-48 text-[10px] text-muted-foreground">
                          {c.major}
                        </p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (confirm(`Delete ${c.name}?`)) del.mutate(c.id);
                      }}
                      className="rounded-lg p-1.5 text-destructive opacity-0 hover:bg-destructive/10 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <User className="h-3 w-3" /> {c.teachers?.full_name ?? t("unassigned")}
                  </p>
                  {c.semester && <p className="mt-1">{t("semester")}: {c.semester}</p>}
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{t("enrolled")}</span>
                    <span>
                      {count} / {c.capacity}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {allStudentsInClass.length > 0 && (
                  <div className="mt-4 rounded-xl bg-muted/50 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("students_in_class")} {c.name}
                    </p>
                    <ul className="space-y-1.5">
                      {allStudentsInClass.slice(0, 5).map((student) => (
                        <li key={student.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium">
                            {student.full_name_en || student.full_name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {student.student_code}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {allStudentsInClass.length > 5 && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        +{allStudentsInClass.length - 5} more
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {t("view")}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {showAdd && <AddClass isDemo={isDemo} onClose={() => setShowAdd(false)} />}
      {selectedClass && (
        <ClassDetailsModal
          classRow={selectedClass.classRow}
          students={selectedClass.students}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

function ClassDetailsModal({
  classRow,
  students,
  onClose,
}: {
  classRow: ClassRow;
  students: ClassStudent[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <School className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold">{classRow.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {students.length} total student{students.length === 1 ? "" : "s"}
                  {classRow.room ? ` · Room ${classRow.room}` : ""}
                  {classRow.shift ? ` · ${shiftLabel(classRow.shift, t)} ${t("shift")}` : ""}
                </p>
              </div>
            </div>
            {classRow.major && (
              <p className="mt-3 max-w-3xl text-xs text-muted-foreground">{classRow.major}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                printDocument(
                  `Student List - ${classRow.name}`,
                  classStudentListReportHtml(classRow, students),
                )
              }
              disabled={students.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto p-5">
          {students.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium">No students in this class yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a student with class {classRow.name} to show them here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">{t("student_id")}</th>
                    <th className="py-3 pr-4">{t("english_name")}</th>
                    <th className="py-3 pr-4">{t("khmer_name")}</th>
                    <th className="py-3 pr-4">{t("gender")}</th>
                    <th className="py-3 pr-4">{t("dob")}</th>
                    <th className="py-3 pr-4">{t("year")}</th>
                    <th className="py-3 pr-4">{t("shift")}</th>
                    <th className="py-3 pr-4">{t("address")}</th>
                    <th className="py-3 pr-4">{t("phone")}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="py-3 pr-4 font-mono text-xs">{student.student_code}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {student.full_name_en || student.full_name}
                      </td>
                      <td className="py-3 pr-4">{student.full_name_km || "-"}</td>
                      <td className="py-3 pr-4 capitalize">{student.gender || "-"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{student.date_of_birth || "-"}</td>
                      <td className="py-3 pr-4">{student.study_year || "-"}</td>
                      <td className="py-3 pr-4">
                        {student.shift ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                            {shiftLabel(student.shift, t)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-56 py-3 pr-4 text-xs">
                        <span className="line-clamp-2">{student.address || "-"}</span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{student.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddClass({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    subject_code: "",
    major: FLAT_MAJOR_OPTIONS[0]?.value ?? "",
    shift: "morning",
    room: "",
    capacity: 40,
    semester: "",
    teacher_id: "",
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-min", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoTeachersMin();

      const { data } = await supabase.from("teachers").select("id,full_name").order("full_name");
      return data ?? [];
    },
  });
  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["subject-options", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return subjectRowsToOptions(readDemoSubjects());

      const { data, error } = await supabase
        .from("subjects")
        .select("subject_id,subject_name,description")
        .order("subject_id", { ascending: true });
      if (error) return DEFAULT_SUBJECT_OPTIONS;
      const options = (data ?? []).map((subject) => ({
        code: subject.subject_id,
        label: subject.subject_name || subject.subject_id,
        description: subject.description,
      }));
      return options.length > 0 ? options : DEFAULT_SUBJECT_OPTIONS;
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const teacher = teachers.find((tc) => tc.id === f.teacher_id);
        const newClass: ClassRow = {
          id: `demo-class-${Date.now()}`,
          name: f.name,
          subject_code: f.subject_code,
          major: f.major || null,
          shift: f.shift || null,
          room: f.room || null,
          capacity: Number(f.capacity),
          semester: f.semester || null,
          teacher_id: f.teacher_id || null,
          teachers: teacher ? { full_name: teacher.full_name } : null,
        };
        writeDemoClasses([newClass, ...readDemoClasses()]);
        return;
      }

      const { error } = await supabase
        .from("classes")
        .insert({
          name: f.name,
          subject_code: f.subject_code,
          room: f.room || null,
          capacity: Number(f.capacity),
          semester: f.semester || null,
          teacher_id: f.teacher_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-subjects"] });
      toast.success(isDemo ? "Demo class created" : "Class created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{t("add_class")}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.name || !f.subject_code) return toast.error(`${t("class_name")} & ${t("subject_code")}`);
            mut.mutate();
          }}
          className="space-y-3"
        >
          <Field label={`${t("class_name")} *`}>
            <input
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={`${t("subject_code")} *`}>
            <input
              list="class-subject-options"
              value={f.subject_code}
              onChange={(e) => setF({ ...f, subject_code: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <datalist id="class-subject-options">
              {subjectOptions.map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.label}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label={`${t("major")} *`}>
            <GroupedSelect
              value={f.major}
              onChange={(major) => setF({ ...f, major })}
              groups={MAJOR_OPTIONS}
            />
          </Field>
          <Field label={`${t("shift")} *`}>
            <select
              value={f.shift}
              onChange={(e) => setF({ ...f, shift: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              {CLASS_SHIFT_OPTIONS.map((shift) => (
                <option key={shift.value} value={shift.value}>
                  {t(shift.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("room")}>
            <input
              value={f.room}
              onChange={(e) => setF({ ...f, room: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("capacity")}>
            <input
              type="number"
              value={f.capacity}
              onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("semester")}>
            <input
              value={f.semester}
              onChange={(e) => setF({ ...f, semester: e.target.value })}
              placeholder="e.g. Spring 2026"
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("teacher")}>
            <select
              value={f.teacher_id}
              onChange={(e) => setF({ ...f, teacher_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">— {t("unassigned")} —</option>
              {teachers.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.full_name}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save_class")}
          </button>
        </form>
      </div>
    </div>
  );
}

function readDemoTeachersMin(): Array<{ id: string; full_name: string }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("studentsphere.demo.teachers");
    const teachers = raw ? (JSON.parse(raw) as Array<{ id: string; full_name: string }>) : [];
    return teachers.map((teacher) => ({ id: teacher.id, full_name: teacher.full_name }));
  } catch {
    return [];
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function GroupedSelect({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: Array<{ group: string; options: Array<{ value: string; label: string }> }>;
}) {
  return (
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
  );
}
