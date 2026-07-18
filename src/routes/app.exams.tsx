import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { Loader2, Printer } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SUBJECT_OPTIONS,
  mergeSubjectOptions,
  readDemoSubjects,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { pageTitle } from "@/lib/brand";
import { findTeacherClassScope } from "@/lib/teacher-scope";

export const Route = createFileRoute("/app/exams")({
  head: () => ({ meta: [{ title: pageTitle("Exams & Scores") }] }),
  component: ExamsPage,
});

type ExamClass = { id: string; name: string; isSynthetic?: boolean };
type ExamStudentRow = {
  student_id: string;
  students: {
    id: string;
    student_code: string;
    full_name: string;
    full_name_km?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    address?: string | null;
    class_name?: string | null;
  };
};
type SubjectScoreRow = {
  student_id: string;
  subject_code: string;
  score: number | null;
};
type DemoSubjectScoreRow = SubjectScoreRow & {
  class_id: string;
  semester: string;
  week_number: number;
};

const DEMO_SUBJECT_SCORES_KEY = "studentsphere.demo.subject_scores";
const SYNTHETIC_CLASS_PREFIX = "student-class:";
const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];
const SCORE_MAX = 100;
const SCORE_SUBJECT_OPTIONS = DEFAULT_SUBJECT_OPTIONS;
const SCORE_REPORT_SUBJECTS = [
  { code: "General_Culture", label: "ចំណេះដឹងទូទៅ" },
  { code: "C_Programming", label: "កម្មវិធី" },
  { code: "Political_Economics", label: "សេដ្ឋកិច្ច" },
  { code: "Microsoft_Office", label: "ក.វិស.មូលដ្ឋាន" },
  { code: "English_1", label: "អង់គ្លេស" },
];
const RESULT_REPORT_SUBJECTS = [
  { code: "General_Culture", short: "G_C", label: "General Culture" },
  { code: "Multimedia_and_Design_1", short: "M_D-1", label: "Multimedia and Design 1" },
  { code: "Mathematics", short: "Math", label: "Mathematics" },
  { code: "Microsoft_Office", short: "M_Of", label: "Microsoft Office" },
  { code: "English_1", short: "En-1", label: "English 1" },
  { code: "C_Programming", short: "C_Pro", label: "C Programming" },
  { code: "Political_Economics", short: "P_Eco", label: "Political Economics" },
  { code: "Statistics", short: "St", label: "Statistics" },
  { code: "Multimedia_and_Design_2", short: "M_D-2", label: "Multimedia and Design 2" },
  { code: "English_2", short: "En-2", label: "English 2" },
];

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemoSubjectScores(rows: DemoSubjectScoreRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_SUBJECT_SCORES_KEY, JSON.stringify(rows));
}

function syntheticClassId(className: string) {
  return `${SYNTHETIC_CLASS_PREFIX}${className}`;
}

function classNameFromId(classId: string, classes: ExamClass[]) {
  return classes.find((c) => c.id === classId)?.name ?? classId.replace(SYNTHETIC_CLASS_PREFIX, "");
}

function uniqueExamClasses(classes: ExamClass[]) {
  const byId = new Map<string, ExamClass>();
  classes.forEach((classRow) => {
    if (!classRow.id || !classRow.name) return;
    byId.set(classRow.id, classRow);
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
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
          .signature { margin-top: 22px; text-align: center; color: #6b7280; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function ExamsPage() {
  const { t } = useI18n();
  const { user, primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [semester, setSemester] = useState(SEMESTER_OPTIONS[0]);
  const [selectedScoreStudentId, setSelectedScoreStudentId] = useState("");
  const weekNumber = 1;
  const isStudent = primaryRole === "student";
  const isTeacher = primaryRole === "teacher";
  const canManageScores = primaryRole === "admin" || primaryRole === "teacher";

  const { data: scoreSubjectOptions = SCORE_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["subject-options", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const rows = readDemoSubjects();
        if (!isTeacher) return mergeSubjectOptions(subjectRowsToOptions(rows));

        const teacher = readDemoList<{ id: string }>("studentsphere.demo.teachers")[0];
        const subjectCodes = new Set(
          readDemoList<{ teacher_id?: string | null; subject_code?: string | null }>(
            "studentsphere.demo.classes",
          )
            .filter((classRow) => !teacher || classRow.teacher_id === teacher.id)
            .map((classRow) => classRow.subject_code?.trim())
            .filter((code): code is string => !!code),
        );
        return subjectRowsToOptions(rows.filter((subject) => subjectCodes.has(subject.subject_id)));
      }

      if (isTeacher) {
        const scope = await findTeacherClassScope(user);
        const subjectCodes = scope?.subjectCodes ?? [];
        if (subjectCodes.length === 0) return SCORE_SUBJECT_OPTIONS;

        const { data, error } = await supabase
          .from("subjects")
          .select("subject_id,subject_name,description")
          .in("subject_id", subjectCodes)
          .order("subject_id", { ascending: true });
        if (error) return subjectCodes.map((code) => ({ code, label: code }));

        const found = (data ?? []).map((subject) => ({
          code: subject.subject_id,
          label: subject.subject_name || subject.subject_id,
          description: subject.description,
        }));
        const foundCodes = new Set(found.map((subject) => subject.code));
        return [
          ...found,
          ...subjectCodes
            .filter((code) => !foundCodes.has(code))
            .map((code) => ({ code, label: code })),
        ];
      }

      const { data, error } = await supabase
        .from("subjects")
        .select("subject_id,subject_name,description")
        .order("subject_id", { ascending: true });
      if (error) return SCORE_SUBJECT_OPTIONS;
      const options = (data ?? []).map((subject) => ({
        code: subject.subject_id,
        label: subject.subject_name || subject.subject_id,
        description: subject.description,
      }));
      return mergeSubjectOptions(options);
    },
  });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      let classIds: string[] | null = null;
      if (isTeacher) {
        const scope = await findTeacherClassScope(user);
        classIds = scope?.classIds ?? [];
        if (classIds.length === 0) return [];
      }

      let query = supabase
        .from("exams")
        .select("id,name,exam_type,exam_date,max_score,classes(name,subject_code)")
        .order("exam_date", { ascending: false });
      if (classIds) query = query.in("class_id", classIds);
      const { data } = await query;
      return (data ?? []) as unknown as Array<{
        id: string;
        name: string;
        exam_type: string;
        exam_date: string | null;
        max_score: number;
        classes: { name: string; subject_code: string } | null;
      }>;
    },
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["exam-result-classes", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const teacher = readDemoList<{ id: string }>("studentsphere.demo.teachers")[0];
        const assignedClassNames = new Set(
          readDemoList<{ name: string; teacher_id?: string | null }>("studentsphere.demo.classes")
            .filter((classRow) => !isTeacher || !teacher || classRow.teacher_id === teacher.id)
            .map((classRow) => classRow.name),
        );
        const demoStudents = readDemoList<{ class_name?: string | null }>(
          "studentsphere.demo.students",
        );
        const visibleDemoStudents =
          isStudent && demoStudents.length > 0
            ? demoStudents.filter((student) => student.class_name === demoStudents[0]?.class_name)
            : isTeacher
              ? demoStudents.filter((student) => assignedClassNames.has(student.class_name ?? ""))
              : demoStudents;
        const demoClasses = Array.from(
          new Set(
            visibleDemoStudents
              .map((student) => student.class_name?.trim())
              .filter((name): name is string => !!name),
          ),
        ).map((name) => ({ id: syntheticClassId(name), name, isSynthetic: true }));
        return demoClasses;
      }

      const scope = isTeacher ? await findTeacherClassScope(user) : null;
      const scopedClasses = uniqueExamClasses(
        (scope?.classes ?? []).map((classRow) => ({
          id: classRow.id,
          name: classRow.name,
        })),
      );
      if (isTeacher && scopedClasses.length > 0) return scopedClasses;

      const studentClassesQuery = isStudent
        ? supabase.rpc("list_student_classmates")
        : supabase.from("students").select("class_name").not("class_name", "is", null);
      let classesQuery = supabase.from("classes").select("id,name").order("name");
      if (isTeacher) {
        if (!scope || scope.classIds.length === 0) return scopedClasses;
        classesQuery = classesQuery.in("id", scope.classIds);
      }
      const [classesResult, studentsResult] = await Promise.all([
        classesQuery,
        studentClassesQuery,
      ]);
      if (classesResult.error) {
        if (isTeacher) return scopedClasses;
        throw classesResult.error;
      }
      if (studentsResult.error) throw studentsResult.error;
      const ownClassNames = new Set(
        (studentsResult.data ?? [])
          .map((student) => student.class_name?.trim())
          .filter((name): name is string => !!name),
      );
      const storedClasses = ((classesResult.data ?? []) as ExamClass[]).filter(
        (item) => !isStudent || ownClassNames.has(item.name),
      );
      const storedNames = new Set(storedClasses.map((item) => item.name));
      const syntheticClasses = Array.from(ownClassNames)
        .filter((name) => !storedNames.has(name))
        .filter(() => !isTeacher)
        .map((name) => ({ id: syntheticClassId(name), name, isSynthetic: true }));
      return uniqueExamClasses([...storedClasses, ...scopedClasses, ...syntheticClasses]);
    },
  });
  useEffect(() => {
    if (
      (isStudent || isTeacher) &&
      classes.length > 0 &&
      !classes.some((item) => item.id === classId)
    ) {
      setClassId(classes[0].id);
    }
  }, [classId, classes, isStudent, isTeacher]);
  const { data: enrolled = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["exam-result-students", classId, isDemo ? "demo" : "remote"],
    enabled: !!classId,
    queryFn: async () => {
      const selectedClassName = classNameFromId(classId, classes);
      if (isDemo) {
        const demoStudents = readDemoList<{
          id: string;
          student_code: string;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          class_name?: string | null;
        }>("studentsphere.demo.students");
        const visibleDemoStudents =
          isStudent && demoStudents.length > 0
            ? demoStudents.filter((student) => student.class_name === demoStudents[0]?.class_name)
            : demoStudents;
        return visibleDemoStudents
          .filter((student) => student.class_name === selectedClassName)
          .map((student) => ({
            student_id: student.id,
            students: {
              id: student.id,
              student_code: student.student_code,
              full_name: student.full_name_en || student.full_name,
              full_name_km: student.full_name_km,
              gender: student.gender,
              date_of_birth: student.date_of_birth,
              address: student.address,
              class_name: student.class_name,
            },
          })) as ExamStudentRow[];
      }

      if (isStudent) {
        const { data, error } = await supabase.rpc("list_student_classmates");
        if (error) throw error;
        return (
          (data ?? []) as Array<{
            id: string;
            student_code: string;
            full_name: string;
            full_name_km?: string | null;
            gender?: string | null;
            date_of_birth?: string | null;
            address?: string | null;
            class_name?: string | null;
            status?: string | null;
          }>
        )
          .filter(
            (student) => student.class_name === selectedClassName && student.status === "active",
          )
          .map((student) => ({
            student_id: student.id,
            students: student,
          })) as ExamStudentRow[];
      }

      const selectedClass = classes.find((c) => c.id === classId);
      if (!selectedClass?.isSynthetic) {
        const { data } = await supabase
          .from("enrollments")
          .select(
            "student_id,students(id,student_code,full_name,full_name_km,gender,date_of_birth,address,class_name)",
          )
          .eq("class_id", classId);
        const enrolledRows = (data ?? []) as unknown as ExamStudentRow[];
        if (enrolledRows.length > 0) return enrolledRows;
      }

      const { data } = await supabase
        .from("students")
        .select("id,student_code,full_name,full_name_km,gender,date_of_birth,address,class_name")
        .eq("class_name", selectedClassName)
        .eq("status", "active")
        .order("student_code");
      return (data ?? []).map((student) => ({
        student_id: student.id,
        students: student,
      })) as ExamStudentRow[];
    },
  });
  const { data: subjectScores = [] } = useQuery({
    queryKey: ["exam-result-scores", classId, semester, weekNumber, isDemo ? "demo" : "remote"],
    enabled: !!classId,
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<DemoSubjectScoreRow>(DEMO_SUBJECT_SCORES_KEY).filter(
          (row) =>
            row.class_id === classId && row.semester === semester && row.week_number === weekNumber,
        );
      }

      const { data } = await supabase
        .from("subject_scores")
        .select("student_id,subject_code,score")
        .eq("class_id", classId)
        .eq("semester", semester)
        .eq("week_number", weekNumber);
      return (data ?? []) as SubjectScoreRow[];
    },
  });

  const scoreFor = (studentId: string, subject: string) =>
    subjectScores.find((score) => score.student_id === studentId && score.subject_code === subject)
      ?.score ?? null;
  const selectedClassLabel = classId ? classNameFromId(classId, classes) : "-";
  const selectedScoreStudent =
    enrolled.find((student) => student.student_id === selectedScoreStudentId) ?? enrolled[0];

  const setSubjectScore = (studentId: string, subject: string, rawValue: string) => {
    if (!canManageScores) {
      toast.error("Only teachers and admins can enter scores.");
      return;
    }

    const score = rawValue.trim() === "" ? null : Number(rawValue);
    if (score !== null && Number.isNaN(score)) return;
    if (score !== null && (score < 0 || score > SCORE_MAX)) {
      toast.error(`Score must be between 0 and ${SCORE_MAX}`);
      return;
    }

    if (isDemo) {
      const rows = readDemoList<DemoSubjectScoreRow>(DEMO_SUBJECT_SCORES_KEY);
      const next = rows.filter(
        (row) =>
          !(
            row.student_id === studentId &&
            row.class_id === classId &&
            row.semester === semester &&
            row.week_number === weekNumber &&
            row.subject_code === subject
          ),
      );
      next.push({
        student_id: studentId,
        class_id: classId,
        semester,
        week_number: weekNumber,
        subject_code: subject,
        score,
      });
      writeDemoSubjectScores(next);
      qc.invalidateQueries({
        queryKey: ["exam-result-scores", classId, semester, weekNumber, isDemo ? "demo" : "remote"],
      });
      return;
    }

    supabase
      .from("subject_scores")
      .upsert(
        {
          student_id: studentId,
          class_id: classId,
          semester,
          week_number: weekNumber,
          subject_code: subject,
          score,
        },
        { onConflict: "student_id,class_id,semester,week_number,subject_code" },
      )
      .then(({ error }) => {
        if (error) toast.error(error.message);
        qc.invalidateQueries({
          queryKey: [
            "exam-result-scores",
            classId,
            semester,
            weekNumber,
            isDemo ? "demo" : "remote",
          ],
        });
      });
  };

  const resultRows = enrolled
    .map((student) => {
      const scores = RESULT_REPORT_SUBJECTS.map((subject) =>
        scoreFor(student.student_id, subject.code),
      );
      const filledScores = scores.filter((score): score is number => score !== null);
      const total = filledScores.reduce((sum, score) => sum + score, 0);
      const average = filledScores.length === 0 ? null : total / filledScores.length;
      return { student, scores, total, average };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.student.students.student_code.localeCompare(b.student.students.student_code),
    );
  const scoreReportHtml = () => {
    const today = new Date().toISOString().slice(0, 10);
    const subjectHeaders = SCORE_REPORT_SUBJECTS.map(
      (subject) => `<th style="width: 58px">${escapeHtml(subject.label)}</th>`,
    ).join("");
    const rows = enrolled
      .map((student, index) => {
        const scores = SCORE_REPORT_SUBJECTS.map((subject) =>
          scoreFor(student.student_id, subject.code),
        );
        const filledScores = scores.filter((score): score is number => score !== null);
        const total = filledScores.reduce((sum, score) => sum + score, 0);
        return `
          <tr>
            <td style="width: 28px">${index + 1}</td>
            <td style="width: 72px">${escapeHtml(student.students.student_code)}</td>
            <td class="name" style="width: 150px">${escapeHtml(
              student.students.full_name_km || student.students.full_name,
            )}</td>
            <td style="width: 30px">${escapeHtml(
              student.students.gender?.toLowerCase().startsWith("f") ? "F" : "M",
            )}</td>
            <td style="width: 70px">${escapeHtml(student.students.date_of_birth)}</td>
            ${scores.map((score) => `<td>${score === null ? "" : escapeHtml(score)}</td>`).join("")}
            <td style="width: 42px">${
              filledScores.length === 0 ? "" : escapeHtml((total / filledScores.length).toFixed(1))
            }</td>
            <td style="width: 42px">${filledScores.length === 0 ? "" : escapeHtml(total)}</td>
            <td style="width: 56px"></td>
          </tr>
        `;
      })
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
            <h3>តារាងពិន្ទុនិស្សិត</h3>
          </div>
          <div></div>
        </section>
        <div class="meta">
          ក្រុម ${escapeHtml(selectedClassLabel)} · ${escapeHtml(semester)}<br />
          កាលបរិច្ឆេទ ${escapeHtml(today)} · ចំនួននិស្សិត ${enrolled.length} នាក់
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 28px">ល.រ</th>
              <th style="width: 72px">អត្តលេខ</th>
              <th class="name" style="width: 150px">គោត្តនាម និង នាម</th>
              <th style="width: 30px">ភេទ</th>
              <th style="width: 70px">ថ្ងៃខែកំណើត</th>
              ${subjectHeaders}
              <th style="width: 42px">មធ្យម</th>
              <th style="width: 42px">សរុប</th>
              <th style="width: 56px">ផ្សេងៗ</th>
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
  };
  const resultReportHtml = () => {
    const today = new Date().toISOString().slice(0, 10);
    const subjectHeaders = RESULT_REPORT_SUBJECTS.map(
      (subject) => `<th style="width: 34px">${escapeHtml(subject.short)}</th>`,
    ).join("");
    const maxScoreHeaders = RESULT_REPORT_SUBJECTS.map(
      () => `<th style="width: 34px">${SCORE_MAX}</th>`,
    ).join("");
    const rows = resultRows
      .map(
        ({ student, scores, total, average }, index) => `
        <tr>
          <td style="width: 28px">${index + 1}</td>
          <td style="width: 76px">${escapeHtml(student.students.student_code)}</td>
          <td class="name" style="width: 128px">${escapeHtml(
            student.students.full_name_km || student.students.full_name,
          )}</td>
          <td class="name" style="width: 128px">${escapeHtml(student.students.full_name)}</td>
          <td style="width: 30px">${escapeHtml(
            student.students.gender?.toLowerCase().startsWith("f") ? "F" : "M",
          )}</td>
          <td style="width: 72px">${escapeHtml(student.students.date_of_birth)}</td>
          ${scores.map((score) => `<td>${score === null ? "" : escapeHtml(score)}</td>`).join("")}
          <td style="width: 44px">${average === null ? "" : escapeHtml(average.toFixed(1))}</td>
          <td style="width: 44px">${average === null ? "" : escapeHtml(total)}</td>
          <td style="width: 48px">${average === null ? "" : index + 1}</td>
          <td style="width: 56px"></td>
        </tr>
      `,
      )
      .join("");
    const legend = RESULT_REPORT_SUBJECTS.map(
      (subject) =>
        `<div><strong>${escapeHtml(subject.short)}</strong> ${escapeHtml(subject.label)}</div>`,
    ).join("");

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
            <h3>លទ្ធផលប្រឡងនិស្សិត</h3>
          </div>
          <div></div>
        </section>
        <div class="meta">
          ក្រុម ${escapeHtml(selectedClassLabel)} · ${escapeHtml(semester)}<br />
          កាលបរិច្ឆេទ ${escapeHtml(today)} · ចំនួននិស្សិត ${enrolled.length} នាក់
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 28px">ល.រ</th>
              <th rowspan="2" style="width: 76px">អត្តលេខ</th>
              <th rowspan="2" class="name" style="width: 128px">គោត្តនាម និង នាម</th>
              <th rowspan="2" class="name" style="width: 128px">នាមជាអក្សរឡាតាំង</th>
              <th rowspan="2" style="width: 30px">ភេទ</th>
              <th rowspan="2" style="width: 72px">ថ្ងៃខែកំណើត</th>
              <th colspan="${RESULT_REPORT_SUBJECTS.length}">ពិន្ទុតាមមុខវិជ្ជា</th>
              <th rowspan="2" style="width: 44px">មធ្យម</th>
              <th rowspan="2" style="width: 44px">សរុប</th>
              <th rowspan="2" style="width: 48px">ចំណាត់ថ្នាក់</th>
              <th rowspan="2" style="width: 56px">ផ្សេងៗ</th>
            </tr>
            <tr>${subjectHeaders}</tr>
            <tr>
              <th colspan="6"></th>
              ${maxScoreHeaders}
              <th colspan="4"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="footer">
          <div>
            បញ្ជាក់៖<br />
            A ល្អណាស់<br />
            B ល្អ<br />
            C មធ្យម<br />
            NO ធ្លាក់
          </div>
          <div>
            រាជធានីភ្នំពេញ ថ្ងៃទី ${escapeHtml(today)}<br />
            ប្រធានគណៈកម្មការប្រឡង
            <div class="signature">ហត្ថលេខា</div>
          </div>
        </section>
        <section style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;line-height:1.7">
          ${legend}
        </section>
      </main>
    `;
  };

  return (
    <div>
      <PageHeader title={t("exams")} subtitle={t("exams_subtitle")} />
      <SectionCard title={t("result_list")} className="mb-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {t("class")}
            </span>
            <select
              value={classId}
              onChange={(event) => setClassId(event.currentTarget.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">{t("select_class")}</option>
              {classes.map((classRow) => (
                <option key={classRow.id} value={classRow.id}>
                  {classRow.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {t("semester")}
            </span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.currentTarget.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              {SEMESTER_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => printDocument("Student Result List", resultReportHtml())}
            disabled={!classId || studentsLoading || enrolled.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {studentsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print Result List
          </button>
        </div>
        {classId && (
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {enrolled.length} students · {subjectScores.length} saved score entries
          </p>
        )}
        {classId &&
          canManageScores &&
          !studentsLoading &&
          enrolled.length > 0 &&
          selectedScoreStudent && (
            <div className="mt-6">
              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(280px,420px)]">
                <div>
                  <p className="font-display text-base font-semibold tracking-tight text-foreground">
                    Student Score Form
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {semester} · Scores out of {SCORE_MAX}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Select student to input score
                    </span>
                    <select
                      value={selectedScoreStudent.student_id}
                      onChange={(event) => setSelectedScoreStudentId(event.currentTarget.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      {enrolled.map((student) => (
                        <option key={student.student_id} value={student.student_id}>
                          {student.students.student_code} · {student.students.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => printDocument("Student Score Table", scoreReportHtml())}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-muted"
                  >
                    <Printer className="h-4 w-4" /> Print Score Table
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="border-b border-border bg-muted/35 px-4 py-3">
                  <p className="font-khmer text-lg font-black text-foreground">
                    បញ្ចូលពិន្ទុនិស្សិត
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {selectedClassLabel} · {selectedScoreStudent.students.student_code}
                  </p>
                </div>
                <div className="space-y-5 p-4">
                  <div className="grid gap-x-6 gap-y-2 md:grid-cols-3">
                    <ScoreInfoField
                      label={t("student_id")}
                      value={selectedScoreStudent.students.student_code}
                    />
                    <ScoreInfoField
                      label={t("khmer_name")}
                      value={
                        selectedScoreStudent.students.full_name_km ||
                        selectedScoreStudent.students.full_name
                      }
                    />
                    <ScoreInfoField
                      label={t("name_in_latin")}
                      value={selectedScoreStudent.students.full_name}
                    />
                    <ScoreInfoField
                      label={t("gender")}
                      value={
                        selectedScoreStudent.students.gender?.toLowerCase().startsWith("f")
                          ? "F"
                          : selectedScoreStudent.students.gender
                            ? "M"
                            : "-"
                      }
                    />
                    <ScoreInfoField
                      label={t("dob")}
                      value={selectedScoreStudent.students.date_of_birth ?? ""}
                    />
                    <ScoreInfoField
                      label={t("group")}
                      value={selectedScoreStudent.students.class_name ?? selectedClassLabel}
                    />
                    <div className="md:col-span-2">
                      <ScoreInfoField
                        label={t("place_of_birth")}
                        value={selectedScoreStudent.students.address ?? ""}
                      />
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-3 border-t border-border pt-4 md:grid-cols-2">
                    <h4 className="font-khmer text-sm font-black text-foreground">
                      មុខវិជ្ជាពិសេសទូទៅ ថ្នាក់ទី១
                    </h4>
                    <h4 className="font-khmer text-sm font-black text-foreground">
                      មុខវិជ្ជាឯកទេសនិង ថ្នាក់ទី១
                    </h4>
                    {scoreSubjectOptions.map((subject) => {
                      const score = scoreFor(selectedScoreStudent.student_id, subject.code);
                      return (
                        <label key={subject.code} className="block">
                          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                            {subject.label}
                          </span>
                          <input
                            key={`${selectedScoreStudent.student_id}-${subject.code}-${
                              score ?? "blank"
                            }`}
                            type="number"
                            min={0}
                            max={SCORE_MAX}
                            step="0.01"
                            defaultValue={score ?? ""}
                            onBlur={(event) =>
                              setSubjectScore(
                                selectedScoreStudent.student_id,
                                subject.code,
                                event.currentTarget.value,
                              )
                            }
                            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        {!classId ? (
          <p className="mt-6 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Select a class to show results.
          </p>
        ) : studentsLoading ? (
          <div className="mt-6 flex h-32 items-center justify-center rounded-xl border border-border">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : enrolled.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No students found for this class.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-3 text-center">{t("rank")}</th>
                  <th className="px-3 py-3">{t("id")}</th>
                  <th className="px-3 py-3">{t("student")}</th>
                  <th className="px-3 py-3 text-center">{t("gender")}</th>
                  <th className="px-3 py-3 text-center">{t("dob")}</th>
                  {RESULT_REPORT_SUBJECTS.map((subject) => (
                    <th key={subject.code} className="px-2 py-3 text-center" title={subject.label}>
                      {subject.short}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">{t("average")}</th>
                  <th className="px-3 py-3 text-center">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map(({ student, scores, total, average }, index) => (
                  <tr key={student.student_id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-3 text-center font-black">{index + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs">{student.students.student_code}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold leading-tight">
                        {student.students.full_name_km || student.students.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{student.students.full_name}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {student.students.gender?.toLowerCase().startsWith("f") ? "F" : "M"}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {student.students.date_of_birth ?? "—"}
                    </td>
                    {scores.map((score, scoreIndex) => (
                      <td
                        key={`${student.student_id}-${RESULT_REPORT_SUBJECTS[scoreIndex].code}`}
                        className="px-2 py-3 text-center font-semibold"
                      >
                        {score ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center font-black">
                      {average === null ? "—" : average.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-center font-black">
                      {average === null ? "—" : total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SectionCard>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : exams.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No exams scheduled yet. Create classes first, then add exams from the database.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">{t("exam")}</th>
                <th className="py-3 pr-4">{t("class")}</th>
                <th className="py-3 pr-4">{t("exam_type")}</th>
                <th className="py-3 pr-4">{t("date")}</th>
                <th className="py-3">{t("max_score")}</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{e.name}</td>
                  <td className="py-3 pr-4">{e.classes?.name ?? "—"}</td>
                  <td className="py-3 pr-4 capitalize">{e.exam_type}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{e.exam_date ?? "—"}</td>
                  <td className="py-3">{e.max_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function ScoreInfoField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        readOnly
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none"
      />
    </label>
  );
}
