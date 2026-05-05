import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatusPill, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Plus, Search, Filter, Printer, Trash2, X, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ADDRESS_OPTIONS, FLAT_MAJOR_OPTIONS, MAJOR_OPTIONS } from "@/lib/academic-options";

export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: "Students — RULE" }] }),
  component: StudentsPage,
});

type StudentRow = {
  id: string;
  student_code: string;
  full_name: string;
  full_name_km: string | null;
  full_name_en: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  major: string | null;
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printDocument(title: string, html: string, orientation: "portrait" | "landscape" = "portrait") {
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
            <th class="name">គោត្តនាម និង​ នាម</th>
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
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [majorFilter, setMajorFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);

  const isAdmin = primaryRole === "admin";

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoStudents();

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
          <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm hover:bg-muted">
            <Filter className="h-4 w-4" /> {t("filter")}
          </button>
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_repeat(3,minmax(120px,160px))]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sort / filter by major
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
              Filter by class
            </label>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="all">All classes</option>
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
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="group border-b border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className="py-3 pr-4 font-mono text-xs">{s.student_code}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.full_name} />
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
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${s.full_name}?`)) deleteMut.mutate(s.id);
                          }}
                          className="rounded-lg p-2 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          {t("showing")} {filtered.length} {t("of")} {students.length}
        </div>
      </SectionCard>

      {showAdd && <AddStudentModal isDemo={isDemo} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddStudentModal({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    student_code: "",
    full_name_km: "",
    full_name_en: "",
    gender: "male",
    date_of_birth: "",
    study_year: 1,
    major: MAJOR_OPTIONS[0].options[0].value,
    class_name: "",
    shift: "morning",
    address: ADDRESS_OPTIONS[0],
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const newStudent: StudentRow = {
          id: `demo-student-${Date.now()}`,
          student_code: form.student_code,
          full_name: form.full_name_en || form.full_name_km,
          full_name_km: form.full_name_km || null,
          full_name_en: form.full_name_en || null,
          email: null,
          phone: null,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          study_year: Number(form.study_year),
          major: form.major || null,
          class_name: form.class_name || null,
          shift: form.shift || null,
          address: form.address || null,
          enrollment_year: new Date().getFullYear(),
          status: "active",
          created_at: new Date().toISOString(),
        };

        writeDemoStudents([newStudent, ...readDemoStudents()]);
        return;
      }

      const { error } = await supabase.from("students").insert({
        student_code: form.student_code,
        full_name: form.full_name_en || form.full_name_km,
        full_name_km: form.full_name_km || null,
        full_name_en: form.full_name_en || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        study_year: Number(form.study_year),
        major: form.major || null,
        class_name: form.class_name || null,
        shift: form.shift || null,
        address: form.address || null,
        enrollment_year: new Date().getFullYear(),
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recent-students"] });
      toast.success(isDemo ? "Demo student added" : "Student added");
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
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{t("add_student")}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.student_code.trim()) return toast.error(t("student_id"));
            if (!form.full_name_km.trim()) return toast.error(t("khmer_name"));
            if (!form.full_name_en.trim()) return toast.error(t("english_name"));
            if (!form.major.trim()) return toast.error(t("major"));
            if (!form.class_name.trim()) return toast.error(t("class"));
            mut.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <Input
            label={`${t("student_id")} *`}
            placeholder="20260001"
            value={form.student_code}
            onChange={(v) => setForm({ ...form, student_code: v })}
          />
          <Input
            label={`${t("name_in_khmer")} *`}
            placeholder="ឈ្មោះជាភាសាខ្មែរ"
            value={form.full_name_km}
            onChange={(v) => setForm({ ...form, full_name_km: v })}
          />
          <Input
            label={`${t("name_in_english")} *`}
            placeholder="Sok Dara"
            value={form.full_name_en}
            onChange={(v) => setForm({ ...form, full_name_en: v })}
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
          <Input
            label={t("dob")}
            type="date"
            value={form.date_of_birth}
            onChange={(v) => setForm({ ...form, date_of_birth: v })}
          />
          <Input
            label={`${t("year")} *`}
            type="number"
            value={String(form.study_year)}
            onChange={(v) => setForm({ ...form, study_year: Number(v) })}
          />
          <GroupedSelect
            label={`${t("major")} *`}
            value={form.major}
            onChange={(v) => setForm({ ...form, major: v })}
            groups={MAJOR_OPTIONS}
          />
          <Input
            label={`${t("class")} *`}
            placeholder="IT1A02"
            value={form.class_name}
            onChange={(v) => setForm({ ...form, class_name: v.toUpperCase() })}
          />
          <Select
            label={`${t("shift")} *`}
            value={form.shift}
            onChange={(v) => setForm({ ...form, shift: v })}
            options={SHIFT_OPTIONS.map((shift) => ({ value: shift.value, label: t(shift.labelKey) }))}
          />
          <div className="sm:col-span-2">
            <Select
              label={t("address")}
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
              options={ADDRESS_OPTIONS.map((address) => ({ value: address, label: address }))}
            />
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow disabled:opacity-60 sm:col-span-2"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save_student")}
          </button>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
