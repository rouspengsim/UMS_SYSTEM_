import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { Users, Wallet, CalendarCheck, FileBarChart, Loader2, Search, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Reports — RULE" }] }),
  component: ReportsPage,
});

type StudentRegisterRow = {
  id: string;
  student_code: string;
  full_name: string;
  full_name_km: string | null;
  full_name_en: string | null;
  gender: string | null;
  date_of_birth: string | null;
  major: string | null;
  class_name: string | null;
  pay_year1?: string | null;
  pay_year2?: string | null;
  pay_year3?: string | null;
  pay_year4?: string | null;
  status: string | null;
};

const DEMO_STUDENTS_KEY = "studentsphere.demo.students";
const REGISTER_PAGE_SIZE = 20;

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

function payLabel(student: StudentRegisterRow) {
  const payValues = [student.pay_year1, student.pay_year2, student.pay_year3, student.pay_year4];
  if (payValues.some((value) => value === "paid")) return "Pay";
  if (payValues.some((value) => value === "partial")) return "Partial";
  return "Not yet";
}

function genderShort(gender: string | null | undefined) {
  if (!gender) return "—";
  return gender.toLowerCase().startsWith("f") ? "F" : "M";
}

function printDocument(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=1200,height=800");
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
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1f2937;
            font-family: "Noto Sans Khmer", "Khmer OS Battambang", Arial, sans-serif;
            font-size: 10px;
          }
          h1 { margin: 0 0 12px; font-size: 16px; text-align: center; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #6b7280; padding: 4px; text-align: left; vertical-align: middle; }
          th { background: #1f2937; color: white; font-weight: 700; }
          td { font-size: 9px; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function studentRegisterReportHtml(students: StudentRegisterRow[]) {
  const rows = students
    .map(
      (student) => `
        <tr>
          <td>${escapeHtml(student.student_code)}</td>
          <td>${escapeHtml(student.full_name_km)}</td>
          <td>${escapeHtml(student.full_name_en || student.full_name)}</td>
          <td>${escapeHtml(genderShort(student.gender))}</td>
          <td>${escapeHtml(student.date_of_birth)}</td>
          <td>${escapeHtml(student.major)}</td>
          <td>${escapeHtml(student.class_name)}</td>
          <td>${escapeHtml(payLabel(student))}</td>
          <td>${escapeHtml(student.status)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <main>
      <h1>របាយការណ៍ចុះឈ្មោះនិស្សិត</h1>
      <table>
        <thead>
          <tr>
            <th style="width: 84px">Student ID</th>
            <th>Name in Khmer</th>
            <th>Name in Latin</th>
            <th style="width: 44px">Gender</th>
            <th style="width: 78px">Date of Birth</th>
            <th>Major</th>
            <th style="width: 70px">Class</th>
            <th style="width: 54px">Pay</th>
            <th style="width: 68px">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  `;
}

function ReportsPage() {
  const { t } = useI18n();
  const { isDemo } = useAuth();
  const [registerSearch, setRegisterSearch] = useState("");
  const [registerPage, setRegisterPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const students = readDemoList<StudentRegisterRow>(DEMO_STUDENTS_KEY);
        return {
          students: students.length,
          classes: new Set(students.map((student) => student.class_name).filter(Boolean)).size,
          revenue: 0,
          attendanceRate: 0,
        };
      }

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
      return {
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        revenue,
        attendanceRate: rate,
      };
    },
  });
  const { data: registerStudents = [], isLoading: isRegisterLoading } = useQuery({
    queryKey: ["student-register-report", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoList<StudentRegisterRow>(DEMO_STUDENTS_KEY);

      const { data, error } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_km,full_name_en,gender,date_of_birth,major,class_name,pay_year1,pay_year2,pay_year3,pay_year4,status",
        )
        .order("student_code", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentRegisterRow[];
    },
  });

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
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return rows.sort((a, b) => a.student_code.localeCompare(b.student_code));
  }, [registerSearch, registerStudents]);

  const registerPageCount = Math.max(
    1,
    Math.ceil(filteredRegisterStudents.length / REGISTER_PAGE_SIZE),
  );
  const safeRegisterPage = Math.min(registerPage, registerPageCount);
  const visibleRegisterStudents = filteredRegisterStudents.slice(
    (safeRegisterPage - 1) * REGISTER_PAGE_SIZE,
    safeRegisterPage * REGISTER_PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader title={t("reports")} subtitle="Aggregate insights from live data" />
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total students"
              value={data?.students ?? 0}
              icon={<Users className="h-5 w-5" />}
              tone="primary"
            />
            <StatCard
              label="Active classes"
              value={data?.classes ?? 0}
              icon={<FileBarChart className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              label="Revenue (paid)"
              value={`$${(data?.revenue ?? 0).toLocaleString()}`}
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Attendance rate"
              value={`${data?.attendanceRate ?? 0}%`}
              icon={<CalendarCheck className="h-5 w-5" />}
              tone="warning"
            />
          </div>
          <SectionCard
            className="mt-6"
            title="របាយការណ៍ចុះឈ្មោះនិស្សិត"
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={registerSearch}
                    onChange={(event) => {
                      setRegisterSearch(event.target.value);
                      setRegisterPage(1);
                    }}
                    placeholder="Search"
                    className="h-10 w-56 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() =>
                    printDocument(
                      "Student Register Report",
                      studentRegisterReportHtml(filteredRegisterStudents),
                    )
                  }
                  disabled={filteredRegisterStudents.length === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
            }
          >
            {isRegisterLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredRegisterStudents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No registered students match this report.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-left text-xs font-semibold text-white">
                        <th className="px-3 py-2">Student ID</th>
                        <th className="px-3 py-2">Name in Khmer</th>
                        <th className="px-3 py-2">Name in Latin</th>
                        <th className="px-3 py-2">Gender</th>
                        <th className="px-3 py-2">Date of Birth</th>
                        <th className="px-3 py-2">Major</th>
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Pay</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRegisterStudents.map((student) => (
                        <tr
                          key={student.id}
                          className="border-b border-border/70 text-xs hover:bg-muted/40"
                        >
                          <td className="px-3 py-2 font-mono">{student.student_code}</td>
                          <td className="px-3 py-2">{student.full_name_km ?? "—"}</td>
                          <td className="px-3 py-2 font-medium">
                            {student.full_name_en || student.full_name}
                          </td>
                          <td className="px-3 py-2">{genderShort(student.gender)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {student.date_of_birth ?? "—"}
                          </td>
                          <td className="max-w-72 px-3 py-2">
                            <span className="line-clamp-2">{student.major ?? "—"}</span>
                          </td>
                          <td className="px-3 py-2 font-semibold">{student.class_name ?? "—"}</td>
                          <td className="px-3 py-2">{payLabel(student)}</td>
                          <td className="px-3 py-2 capitalize">{student.status ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Showing {visibleRegisterStudents.length} of {filteredRegisterStudents.length}
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: registerPageCount }, (_, index) => index + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setRegisterPage(page)}
                          className={
                            "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors " +
                            (safeRegisterPage === page
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-surface text-muted-foreground hover:bg-muted")
                          }
                        >
                          {page}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
