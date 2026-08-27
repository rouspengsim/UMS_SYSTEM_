import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { Eye, Loader2, Printer, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_SUBJECT_OPTIONS,
  filterSubjectOptionsByScope,
  mergeSubjectOptions,
  readDemoSubjects,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { pageTitle } from "@/lib/brand";
import { decodeTimetableCell } from "@/lib/timetable-cell";
import { findTeacherClassScope, type CurrentTeacher } from "@/lib/teacher-scope";
import { formatDateDisplay } from "@/lib/utils";

export const Route = createFileRoute("/app/exams")({
  head: () => ({ meta: [{ title: pageTitle("Exams & Scores") }] }),
  component: ExamsPage,
});

type ExamClass = { id: string; name: string; isSynthetic?: boolean };
type ExamRow = {
  id: string;
  class_id: string | null;
  name: string;
  exam_type: string;
  exam_date: string | null;
  max_score: number;
  classes: { name: string; subject_code: string | null } | null;
};
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
    major?: string | null;
    study_year?: number | null;
  };
};
type SubjectScoreRow = {
  student_id: string;
  subject_code: string;
  attendance_score?: number | null;
  assignment_score?: number | null;
  midterm_score?: number | null;
  final_score?: number | null;
  score: number | null;
};
type ScoreAttendanceRow = {
  student_id: string;
  subject_code: string | null;
  status: "present" | "absent" | "late" | "excused";
  week_number: number | null;
  day_of_week: number | null;
};
type DemoSubjectScoreRow = SubjectScoreRow & {
  class_id: string;
  semester: string;
  week_number: number;
};
type DemoAttendanceRow = ScoreAttendanceRow & {
  class_id: string;
  date: string;
  semester?: string;
};

const DEMO_SUBJECT_SCORES_KEY = "studentsphere.demo.subject_scores";
const SYNTHETIC_CLASS_PREFIX = "student-class:";
const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];
const SCORE_MAX = 100;
const ATTENDANCE_SCORE_MAX = 10;
const ASSIGNMENT_SCORE_MAX = 20;
const MIDTERM_SCORE_MAX = 25;
const FINAL_SCORE_MAX = 45;
const SCORE_SUBJECT_OPTIONS = DEFAULT_SUBJECT_OPTIONS;
const SCORE_COMPONENTS = [
  { key: "assignment_score", label: "Assignment", max: ASSIGNMENT_SCORE_MAX },
  { key: "midterm_score", label: "Midterm exam", max: MIDTERM_SCORE_MAX },
  { key: "final_score", label: "Final exam", max: FINAL_SCORE_MAX },
] as const;
type ScoreComponentKey = (typeof SCORE_COMPONENTS)[number]["key"];
type TeacherScoreSlot = {
  room: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  subject_code?: string | null;
};

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

function formatScoreValue(value: number | null | undefined) {
  return value == null ? "" : value.toFixed(2);
}

function subjectScoreValue(score: SubjectScoreRow | undefined) {
  if (!score) return null;

  const hasManualScoreColumns = ["assignment_score", "midterm_score", "final_score"].some((key) =>
    Object.prototype.hasOwnProperty.call(score, key),
  );
  const hasManualScoreInput = [score.assignment_score, score.midterm_score, score.final_score].some(
    (value) => value != null,
  );

  if (hasManualScoreColumns && !hasManualScoreInput) return null;
  if (score.score != null) return score.score;
  if (!hasManualScoreInput) return null;

  const hasComponent = [
    score.attendance_score,
    score.assignment_score,
    score.midterm_score,
    score.final_score,
  ].some((value) => value != null);
  if (!hasComponent) return null;

  return totalSubjectScore({
    attendance: score.attendance_score ?? 0,
    assignment: score.assignment_score,
    midterm: score.midterm_score,
    final: score.final_score,
  });
}

function splitStudentName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { familyName: fullName, givenName: "" };
  return { familyName: parts[0], givenName: parts.slice(1).join(" ") };
}

function khmerGenderLabel(gender: string | null | undefined) {
  const normalized = gender?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  if (normalized.startsWith("f") || normalized.includes("female") || normalized.includes("ស្រី")) {
    return "ស្រី";
  }
  if (normalized.startsWith("m") || normalized.includes("male") || normalized.includes("ប្រុស")) {
    return "ប្រុស";
  }
  return gender ?? "";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeScoreMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function teacherScoreMatchValues(teacher: CurrentTeacher | null | undefined) {
  return new Set(
    [
      teacher?.id,
      teacher?.staff_code,
      teacher?.full_name,
      teacher?.full_name_en,
      teacher?.full_name_km,
    ]
      .map(normalizeScoreMatchValue)
      .filter(Boolean),
  );
}

function scoreSlotMatchesTeacher(
  slot: TeacherScoreSlot,
  teacher: CurrentTeacher | null | undefined,
) {
  const values = teacherScoreMatchValues(teacher);
  if (values.size === 0) return false;

  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeScoreMatchValue(value)),
  );
}

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

function attendanceScoreFromRows(rows: ScoreAttendanceRow[]) {
  if (rows.length === 0) return 0;
  const absences = rows.filter((row) => row.status === "absent").length;
  return Math.max(0, ATTENDANCE_SCORE_MAX - absences);
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
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111827;
            font-family: "Noto Sans Khmer", "Khmer OS Battambang", Arial, sans-serif;
            font-size: 8.5px;
            background-image:
              linear-gradient(#e5e7eb 1px, transparent 1px),
              linear-gradient(90deg, #e5e7eb 1px, transparent 1px);
            background-size: 28px 20px;
          }
          main { background: transparent; }
          .report-top {
            display: grid;
            grid-template-columns: 1fr 1.7fr 1fr;
            gap: 10px;
            align-items: start;
            margin-bottom: 6px;
          }
          .left-note { line-height: 1.55; text-align: left; }
          .title { text-align: center; line-height: 1.45; }
          .title h1, .title h2, .title h3 { margin: 0; font-weight: 700; }
          .title h1 { font-size: 12px; }
          .title h2 { font-size: 11px; }
          .title h3 { margin-top: 7px; font-size: 12px; }
          .meta {
            margin: 6px 0 8px;
            text-align: center;
            font-size: 9px;
            font-weight: 700;
            line-height: 1.6;
          }
          .subject-line {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            margin: 4px 0 8px;
            font-size: 8.5px;
            font-weight: 700;
            line-height: 1.5;
          }
          .subject-fill {
            display: inline-block;
            min-width: 120px;
            border-bottom: 1px dotted #111827;
            padding: 0 4px 1px;
            text-align: center;
          }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td {
            border: 1px solid #111827;
            height: 20px;
            padding: 2px 3px;
            text-align: center;
            vertical-align: middle;
          }
          th { font-weight: 700; background: transparent; }
          td.name, th.name { text-align: left; }
          .score-percent th { height: 16px; font-size: 7.5px; }
          .page-foot {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            margin-top: 8px;
            font-family: "Times New Roman", serif;
            font-size: 9px;
          }
          .page-foot :nth-child(2) { text-align: center; }
          .page-foot :nth-child(3) { text-align: right; }
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
  const resultListRef = useRef<HTMLDivElement | null>(null);
  const [classId, setClassId] = useState("");
  const [semester, setSemester] = useState(SEMESTER_OPTIONS[0]);
  const [scoreSubjectCode, setScoreSubjectCode] = useState("");
  const [showScoredOnly, setShowScoredOnly] = useState(false);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const weekNumber = 1;
  const isStudent = primaryRole === "student";
  const isTeacher = primaryRole === "teacher";
  const canManageScores = primaryRole === "admin" || primaryRole === "teacher";

  const { data: teacherScope = null } = useQuery({
    queryKey: ["exam-teacher-scope", user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => findTeacherClassScope(user),
    enabled: !isDemo && isTeacher && !!user?.id,
  });

  const { data: scoreSubjectOptions = isTeacher ? [] : SCORE_SUBJECT_OPTIONS } = useQuery({
    queryKey: [
      "subject-options",
      primaryRole,
      user?.id,
      teacherScope?.subjectCodes,
      isDemo ? "demo" : "remote",
    ],
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
        const subjectCodes = teacherScope?.subjectCodes ?? [];
        if (subjectCodes.length === 0) return [];

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
        .select("id,class_id,name,exam_type,exam_date,max_score,classes(name,subject_code)")
        .order("exam_date", { ascending: false });
      if (classIds) query = query.in("class_id", classIds);
      const { data } = await query;
      return (data ?? []) as unknown as ExamRow[];
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
  const { data: teacherClassSubjectCodes = [] } = useQuery({
    queryKey: [
      "teacher-score-class-subjects",
      classId,
      teacherScope?.teacher?.id,
      isDemo ? "demo" : "remote",
    ],
    enabled: isTeacher && !!classId && (isDemo || !!teacherScope?.teacher),
    queryFn: async () => {
      const subjectCodes = new Set<string>();
      const selectedClassName = classNameFromId(classId, classes);

      if (isDemo) {
        const teacher = readDemoList<{ id: string }>("studentsphere.demo.teachers")[0];
        readDemoList<{
          id: string;
          name: string;
          teacher_id?: string | null;
          subject_code?: string | null;
        }>("studentsphere.demo.classes")
          .filter(
            (classRow) =>
              (!teacher || classRow.teacher_id === teacher.id) &&
              (classRow.id === classId || classRow.name === selectedClassName),
          )
          .forEach((classRow) => {
            const code = classRow.subject_code?.trim();
            if (code) subjectCodes.add(code);
          });
        return Array.from(subjectCodes);
      }

      const scopedClass = teacherScope?.classes.find(
        (classRow) => classRow.id === classId || classRow.name === selectedClassName,
      );
      const scopedClassCode = scopedClass?.subject_code?.trim();
      if (scopedClassCode) subjectCodes.add(scopedClassCode);

      if (!classId.startsWith(SYNTHETIC_CLASS_PREFIX)) {
        const { data, error } = await supabase
          .from("timetable_slots")
          .select("room,teacher_id,teacher_name,subject_code")
          .eq("class_id", classId);
        if (!error) {
          ((data ?? []) as TeacherScoreSlot[])
            .filter((slot) => scoreSlotMatchesTeacher(slot, teacherScope?.teacher))
            .forEach((slot) => {
              const payload = decodeTimetableCell(slot.room);
              const code = slot.subject_code?.trim() || payload.subjectCode?.trim();
              if (code) subjectCodes.add(code);
            });
        }
      }

      return Array.from(subjectCodes);
    },
  });
  const classScoreSubjectOptions = useMemo(() => {
    if (!isTeacher) return scoreSubjectOptions;
    if (!classId) return [];
    const allowed = new Set(teacherClassSubjectCodes);
    return scoreSubjectOptions.filter((subject) => allowed.has(subject.code));
  }, [classId, isTeacher, scoreSubjectOptions, teacherClassSubjectCodes]);

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
    queryKey: ["exam-result-students", classId, primaryRole, user?.id, isDemo ? "demo" : "remote"],
    enabled: !!classId && (!isStudent || isDemo || !!user?.id),
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
          major?: string | null;
          study_year?: number | null;
        }>("studentsphere.demo.students");
        const demoOwnStudent = demoStudents[0];
        const visibleDemoStudents =
          isStudent && demoOwnStudent
            ? demoStudents.filter((student) => student.class_name === demoOwnStudent.class_name)
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
              major: student.major,
              study_year: student.study_year,
            },
          })) as ExamStudentRow[];
      }

      if (isStudent) {
        const { data, error } = await supabase.rpc("list_student_classmates");
        if (error) throw error;
        return (data ?? [])
          .filter(
            (student) => student.class_name === selectedClassName && student.status === "active",
          )
          .map((student) => ({
            student_id: student.id,
            students: {
              id: student.id,
              student_code: student.student_code,
              full_name: student.full_name,
              full_name_km: student.full_name_km,
              gender: student.gender,
              date_of_birth: student.date_of_birth,
              address: student.address,
              class_name: student.class_name,
              major: student.major,
              study_year: student.study_year,
            },
          })) as ExamStudentRow[];
      }

      const selectedClass = classes.find((c) => c.id === classId);
      if (!selectedClass?.isSynthetic) {
        const { data } = await supabase
          .from("enrollments")
          .select(
            "student_id,students(id,student_code,full_name,full_name_km,gender,date_of_birth,address,class_name,major,study_year)",
          )
          .eq("class_id", classId);
        const enrolledRows = (data ?? []) as unknown as ExamStudentRow[];
        if (enrolledRows.length > 0) return enrolledRows;
      }

      const { data } = await supabase
        .from("students")
        .select(
          "id,student_code,full_name,full_name_km,gender,date_of_birth,address,class_name,major,study_year",
        )
        .eq("class_name", selectedClassName)
        .eq("status", "active")
        .order("student_code");
      return (data ?? []).map((student) => ({
        student_id: student.id,
        students: student,
      })) as ExamStudentRow[];
    },
  });
  const visibleScoreStudentIds = useMemo(
    () => enrolled.map((student) => student.student_id).filter(Boolean),
    [enrolled],
  );
  const selectedClassSubjectScope = useMemo(() => {
    const studentWithScope =
      enrolled.find((row) => row.students.major || row.students.study_year) ?? null;
    return {
      major: studentWithScope?.students.major ?? null,
      studyYear: studentWithScope?.students.study_year ?? null,
      semester,
    };
  }, [enrolled, semester]);
  const { data: subjectScores = [] } = useQuery({
    queryKey: [
      "exam-result-scores",
      classId,
      semester,
      weekNumber,
      visibleScoreStudentIds,
      isDemo ? "demo" : "remote",
    ],
    enabled: !!classId && visibleScoreStudentIds.length > 0,
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<DemoSubjectScoreRow>(DEMO_SUBJECT_SCORES_KEY).filter(
          (row) =>
            row.class_id === classId &&
            row.semester === semester &&
            row.week_number === weekNumber &&
            visibleScoreStudentIds.includes(row.student_id),
        );
      }

      let { data, error } = await supabase
        .from("subject_scores")
        .select(
          "student_id,subject_code,attendance_score,assignment_score,midterm_score,final_score,score",
        )
        .eq("class_id", classId)
        .eq("semester", semester)
        .eq("week_number", weekNumber)
        .in("student_id", visibleScoreStudentIds);
      if (
        error &&
        (error.message.includes("schema cache") ||
          error.message.includes("column") ||
          error.message.includes("Could not find"))
      ) {
        const fallback = await supabase
          .from("subject_scores")
          .select("student_id,subject_code,score")
          .eq("class_id", classId)
          .eq("semester", semester)
          .eq("week_number", weekNumber)
          .in("student_id", visibleScoreStudentIds);
        data = fallback.data as typeof data;
        error = fallback.error;
      }
      if (error) throw error;
      return (data ?? []) as SubjectScoreRow[];
    },
  });
  const scoreSheetSubjectOptions = useMemo(() => {
    const byCode = new Map(classScoreSubjectOptions.map((subject) => [subject.code, subject]));
    if (!isTeacher) {
      subjectScores.forEach((score) => {
        const code = score.subject_code?.trim();
        if (code && !byCode.has(code)) byCode.set(code, { code, label: code });
      });
    }
    return filterSubjectOptionsByScope(Array.from(byCode.values()), selectedClassSubjectScope);
  }, [classScoreSubjectOptions, isTeacher, selectedClassSubjectScope, subjectScores]);
  const selectedScoreSubject =
    scoreSheetSubjectOptions.find((subject) => subject.code === scoreSubjectCode) ??
    scoreSheetSubjectOptions[0] ??
    null;

  useEffect(() => {
    if (!scoreSheetSubjectOptions.some((subject) => subject.code === scoreSubjectCode)) {
      setScoreSubjectCode(scoreSheetSubjectOptions[0]?.code ?? "");
      return;
    }

    if (isStudent && subjectScores.length > 0) {
      const hasSavedScoreForSelected = subjectScores.some(
        (score) => score.subject_code === scoreSubjectCode,
      );
      if (!hasSavedScoreForSelected) {
        setScoreSubjectCode(
          subjectScores[0]?.subject_code ?? scoreSheetSubjectOptions[0]?.code ?? "",
        );
      }
    }
  }, [isStudent, scoreSheetSubjectOptions, scoreSubjectCode, subjectScores]);
  const { data: scoreAttendanceRows = [] } = useQuery({
    queryKey: [
      "exam-score-attendance",
      classId,
      semester,
      scoreSheetSubjectOptions.map((subject) => subject.code),
      visibleScoreStudentIds,
      isDemo ? "demo" : "remote",
    ],
    enabled: !!classId && visibleScoreStudentIds.length > 0,
    queryFn: async () => {
      const subjectCodes = scoreSheetSubjectOptions.map((subject) => subject.code).filter(Boolean);
      if (subjectCodes.length === 0) return [];

      if (isDemo) {
        return readDemoList<DemoAttendanceRow>("studentsphere.demo.attendance")
          .filter(
            (row) =>
              row.class_id === classId &&
              (row.semester ?? "Semester 1") === semester &&
              subjectCodes.includes(row.subject_code ?? "") &&
              visibleScoreStudentIds.includes(row.student_id),
          )
          .map((row) => ({
            student_id: row.student_id,
            subject_code: row.subject_code ?? null,
            status: row.status,
            week_number: row.week_number ?? null,
            day_of_week: row.day_of_week ?? null,
          })) as ScoreAttendanceRow[];
      }

      const { data, error } = await supabase
        .from("attendance")
        .select("student_id,subject_code,status,week_number,day_of_week")
        .eq("class_id", classId)
        .eq("semester", semester)
        .in("subject_code", subjectCodes)
        .in("student_id", visibleScoreStudentIds);
      if (error) throw error;
      return (data ?? []) as ScoreAttendanceRow[];
    },
  });

  const scoreRecordFor = (studentId: string, subject: string) =>
    subjectScores.find((score) => score.student_id === studentId && score.subject_code === subject);
  const attendanceScoreFor = (studentId: string, subject: string) =>
    attendanceScoreFromRows(
      scoreAttendanceRows.filter(
        (row) => row.student_id === studentId && row.subject_code === subject,
      ),
    );
  const attendanceCountFor = (studentId: string, subject: string) =>
    scoreAttendanceRows.filter(
      (row) => row.student_id === studentId && row.subject_code === subject,
    ).length;
  const absenceCountFor = (studentId: string, subject: string) =>
    scoreAttendanceRows.filter(
      (row) =>
        row.student_id === studentId && row.subject_code === subject && row.status === "absent",
    ).length;
  const scoreDraftKey = (studentId: string, subject: string, field: ScoreComponentKey) =>
    `${studentId}:${subject}:${field}`;
  const scoreComponentInputValue = (
    studentId: string,
    subject: string,
    field: ScoreComponentKey,
    savedValue: number | null | undefined,
  ) => {
    const draft = scoreDrafts[scoreDraftKey(studentId, subject, field)];
    return draft ?? savedValue ?? "";
  };
  const scoreComponentNumber = (
    studentId: string,
    subject: string,
    field: ScoreComponentKey,
    savedValue: number | null | undefined,
  ) => {
    const draft = scoreDrafts[scoreDraftKey(studentId, subject, field)];
    return draft === undefined ? numberOrNull(savedValue) : numberOrNull(draft);
  };
  const setScoreDraft = (
    studentId: string,
    subject: string,
    field: ScoreComponentKey,
    value: string,
  ) => {
    setScoreDrafts((current) => ({
      ...current,
      [scoreDraftKey(studentId, subject, field)]: value,
    }));
  };
  const scoreBreakdownFor = (studentId: string, subject: string) => {
    const record = scoreRecordFor(studentId, subject);
    const attendance = attendanceScoreFor(studentId, subject);
    const assignment = scoreComponentNumber(
      studentId,
      subject,
      "assignment_score",
      record?.assignment_score,
    );
    const midterm = scoreComponentNumber(
      studentId,
      subject,
      "midterm_score",
      record?.midterm_score,
    );
    const final = scoreComponentNumber(studentId, subject, "final_score", record?.final_score);
    const total = totalSubjectScore({ attendance, assignment, midterm, final });
    const average = total / 4;
    return {
      attendance,
      assignment,
      midterm,
      final,
      total,
      average,
      attendanceCount: attendanceCountFor(studentId, subject),
      absenceCount: absenceCountFor(studentId, subject),
    };
  };
  const selectedClassLabel = classId ? classNameFromId(classId, classes) : "-";
  const viewSelectedResult = () => {
    setShowScoredOnly(true);
    resultListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const viewExamResult = (exam: ExamRow) => {
    const nextClassId =
      exam.class_id ?? classes.find((classRow) => classRow.name === exam.classes?.name)?.id ?? "";

    if (!nextClassId) {
      toast.error("Class is not available for this exam.");
      return;
    }

    setClassId(nextClassId);
    setScoreSubjectCode(exam.classes?.subject_code?.trim() ?? "");
    setShowScoredOnly(true);
    resultListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scoreTableRows =
    selectedScoreSubject == null
      ? []
      : enrolled
          .map((student) => ({
            student,
            score: scoreBreakdownFor(student.student_id, selectedScoreSubject.code),
          }))
          .sort((a, b) =>
            a.student.students.student_code.localeCompare(b.student.students.student_code),
          );
  const classResultSubjects = useMemo(() => {
    const savedSubjectCodes = new Set(
      subjectScores
        .filter((score) => subjectScoreValue(score) != null)
        .map((score) => score.subject_code?.trim())
        .filter((code): code is string => !!code),
    );
    const optionMap = new Map(scoreSheetSubjectOptions.map((subject) => [subject.code, subject]));
    return Array.from(savedSubjectCodes)
      .map((code) => optionMap.get(code) ?? { code, label: code })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [scoreSheetSubjectOptions, subjectScores]);
  const classResultRows = useMemo(() => {
    return enrolled
      .map((student) => {
        const scores = classResultSubjects.map((subject) => {
          const saved = subjectScores.find(
            (score) =>
              score.student_id === student.student_id && score.subject_code === subject.code,
          );
          return subjectScoreValue(saved);
        });
        const completedScores = scores.filter((score): score is number => score != null);
        return {
          student,
          scores,
          total: completedScores.reduce((sum, score) => sum + score, 0),
          average:
            completedScores.length === 0
              ? null
              : completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length,
        };
      })
      .filter((row) => row.scores.some((score) => score != null))
      .sort((a, b) =>
        a.student.students.student_code.localeCompare(b.student.students.student_code),
      );
  }, [classResultSubjects, enrolled, subjectScores]);

  const saveScoresMut = useMutation({
    mutationFn: async () => {
      if (!canManageScores) throw new Error("Only teachers and admins can save scores.");
      if (!classId || !selectedScoreSubject) throw new Error("Select a class and subject first.");
      if (scoreTableRows.length === 0) throw new Error("No students available to save.");
      if (
        isTeacher &&
        !classScoreSubjectOptions.some((option) => option.code === selectedScoreSubject.code)
      ) {
        throw new Error("Teachers can only save scores for their assigned subjects.");
      }

      const subject = selectedScoreSubject.code;
      scoreTableRows.forEach(({ student, score }) => {
        SCORE_COMPONENTS.forEach((component) => {
          const componentScore =
            component.key === "assignment_score"
              ? score.assignment
              : component.key === "midterm_score"
                ? score.midterm
                : score.final;
          if (
            componentScore !== null &&
            componentScore !== undefined &&
            (componentScore < 0 || componentScore > component.max)
          ) {
            throw new Error(
              `${student.students.student_code} ${component.label} must be between 0 and ${component.max}`,
            );
          }
        });
      });
      const scoreRows = scoreTableRows.map(({ student, score }) => ({
        student_id: student.student_id,
        class_id: classId,
        semester,
        week_number: weekNumber,
        subject_code: subject,
        attendance_score: score.attendance,
        assignment_score: score.assignment,
        midterm_score: score.midterm,
        final_score: score.final,
        score: score.total,
      }));

      if (isDemo) {
        const studentIds = new Set(scoreRows.map((row) => row.student_id));
        const rows = readDemoList<DemoSubjectScoreRow>(DEMO_SUBJECT_SCORES_KEY);
        const next = rows.filter(
          (row) =>
            !(
              row.class_id === classId &&
              row.semester === semester &&
              row.week_number === weekNumber &&
              row.subject_code === subject &&
              studentIds.has(row.student_id)
            ),
        );
        writeDemoSubjectScores([...next, ...scoreRows]);
        return;
      }

      const rowsWithMeta = scoreRows.map((row) => ({
        ...row,
        max_score: SCORE_MAX,
        recorded_by: user?.id ?? null,
      }));
      const { error } = await supabase.from("subject_scores").upsert(rowsWithMeta, {
        onConflict: "student_id,class_id,semester,week_number,subject_code",
      });
      if (
        error &&
        (error.message.includes("schema cache") ||
          error.message.includes("column") ||
          error.message.includes("Could not find"))
      ) {
        const fallbackRows = scoreRows.map((row) => ({
          student_id: row.student_id,
          class_id: row.class_id,
          semester: row.semester,
          week_number: row.week_number,
          subject_code: row.subject_code,
          score: row.score,
          max_score: SCORE_MAX,
          recorded_by: user?.id ?? null,
        }));
        const { error: fallbackError } = await supabase
          .from("subject_scores")
          .upsert(fallbackRows, {
            onConflict: "student_id,class_id,semester,week_number,subject_code",
          });
        if (fallbackError) throw fallbackError;
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      const savedSubject = selectedScoreSubject?.code;
      if (savedSubject) {
        setScoreDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([key]) => key.split(":")[1] !== savedSubject),
          ),
        );
      }
      qc.invalidateQueries({ queryKey: ["exam-result-scores"] });
      toast.success("Scores saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const setSubjectScoreComponent = (
    studentId: string,
    subject: string,
    field: ScoreComponentKey,
    rawValue: string,
  ) => {
    if (!canManageScores) {
      toast.error("Only teachers and admins can enter scores.");
      return;
    }
    if (isTeacher && !classScoreSubjectOptions.some((option) => option.code === subject)) {
      toast.error("Teachers can only enter scores for their assigned subjects.");
      return;
    }

    const component = SCORE_COMPONENTS.find((item) => item.key === field);
    if (!component) return;

    const componentScore = rawValue.trim() === "" ? null : Number(rawValue);
    if (componentScore !== null && Number.isNaN(componentScore)) return;
    if (componentScore !== null && (componentScore < 0 || componentScore > component.max)) {
      toast.error(`${component.label} must be between 0 and ${component.max}`);
      return;
    }

    const current = scoreRecordFor(studentId, subject);
    const attendanceScore = attendanceScoreFor(studentId, subject);
    const nextAssignment =
      field === "assignment_score"
        ? componentScore
        : scoreComponentNumber(studentId, subject, "assignment_score", current?.assignment_score);
    const nextMidterm =
      field === "midterm_score"
        ? componentScore
        : scoreComponentNumber(studentId, subject, "midterm_score", current?.midterm_score);
    const nextFinal =
      field === "final_score"
        ? componentScore
        : scoreComponentNumber(studentId, subject, "final_score", current?.final_score);
    const score = totalSubjectScore({
      attendance: attendanceScore,
      assignment: nextAssignment,
      midterm: nextMidterm,
      final: nextFinal,
    });

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
        attendance_score: attendanceScore,
        assignment_score: nextAssignment,
        midterm_score: nextMidterm,
        final_score: nextFinal,
        score,
      });
      writeDemoSubjectScores(next);
      qc.invalidateQueries({
        queryKey: ["exam-result-scores"],
      });
      return;
    }

    const payload = {
      student_id: studentId,
      class_id: classId,
      semester,
      week_number: weekNumber,
      subject_code: subject,
      attendance_score: attendanceScore,
      assignment_score: nextAssignment,
      midterm_score: nextMidterm,
      final_score: nextFinal,
      score,
      max_score: SCORE_MAX,
      recorded_by: user?.id ?? null,
    };

    supabase
      .from("subject_scores")
      .upsert(payload, { onConflict: "student_id,class_id,semester,week_number,subject_code" })
      .then(async ({ error }) => {
        if (
          error &&
          (error.message.includes("schema cache") ||
            error.message.includes("column") ||
            error.message.includes("Could not find"))
        ) {
          const { error: fallbackError } = await supabase.from("subject_scores").upsert(
            {
              student_id: studentId,
              class_id: classId,
              semester,
              week_number: weekNumber,
              subject_code: subject,
              score,
              max_score: SCORE_MAX,
              recorded_by: user?.id ?? null,
            },
            { onConflict: "student_id,class_id,semester,week_number,subject_code" },
          );
          if (fallbackError) toast.error(fallbackError.message);
        } else if (error) {
          toast.error(error.message);
        }
        qc.invalidateQueries({
          queryKey: ["exam-result-scores"],
        });
      });
  };

  const scoreReportHtml = () => {
    const today = formatDateDisplay(new Date());
    if (!selectedScoreSubject) {
      return `<main><p>No assigned subject available for this class.</p></main>`;
    }
    const rows = scoreTableRows
      .map(({ student, score }, index) => {
        const displayName = student.students.full_name_km || student.students.full_name;
        const name = splitStudentName(displayName);
        return `
          <tr>
            <td style="width: 24px">${index + 1}</td>
            <td style="width: 76px">${escapeHtml(student.students.student_code)}</td>
            <td class="name" style="width: 92px">${escapeHtml(name.familyName)}</td>
            <td class="name" style="width: 100px">${escapeHtml(name.givenName)}</td>
            <td style="width: 32px">${escapeHtml(khmerGenderLabel(student.students.gender))}</td>
            <td style="width: 64px">${escapeHtml(formatDateDisplay(student.students.date_of_birth))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.attendance))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.assignment))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.midterm))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.final))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.total))}</td>
            <td style="width: 44px">${escapeHtml(formatScoreValue(score.average))}</td>
            <td style="width: 44px"></td>
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
            <h3>បញ្ជីរាយនាមនិងពិន្ទុនិស្សិត</h3>
          </div>
          <div></div>
        </section>
        <div class="meta">
          បរិញ្ញាបត្ររង / បរិញ្ញាបត្រ · ក្រុម ${escapeHtml(selectedClassLabel)}<br />
          ឆ្នាំសិក្សា ${escapeHtml(today.slice(0, 4))}-${escapeHtml(
            String(Number(today.slice(0, 4)) + 1),
          )} · ${escapeHtml(semester)}
        </div>
        <div class="subject-line">
          <div>មុខវិជ្ជា <span class="subject-fill">${escapeHtml(selectedScoreSubject.label)}</span></div>
          <div>ចំនួននិស្សិត <span class="subject-fill">${enrolled.length}</span></div>
          <div>កាលបរិច្ឆេទ <span class="subject-fill">${escapeHtml(today)}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="3" style="width: 24px">ល.រ</th>
              <th rowspan="3" style="width: 76px">អត្តលេខ</th>
              <th colspan="2">គោត្តនាម និង នាម</th>
              <th rowspan="3" style="width: 32px">ភេទ</th>
              <th rowspan="3" style="width: 64px">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th colspan="6">ពិន្ទុ</th>
              <th rowspan="3" style="width: 44px">ផ្សេងៗ</th>
            </tr>
            <tr>
              <th rowspan="2" class="name" style="width: 92px">គោត្តនាម</th>
              <th rowspan="2" class="name" style="width: 100px">នាម</th>
              <th style="width: 44px">វត្តមាន</th>
              <th style="width: 44px">កិច្ចការ</th>
              <th style="width: 44px">ប្រឡងពាក់កណ្តាល</th>
              <th style="width: 44px">ប្រឡងបញ្ចប់</th>
              <th style="width: 44px">សរុប</th>
              <th style="width: 44px">មធ្យម</th>
            </tr>
            <tr class="score-percent">
              <th>${ATTENDANCE_SCORE_MAX}%</th>
              <th>${ASSIGNMENT_SCORE_MAX}%</th>
              <th>${MIDTERM_SCORE_MAX}%</th>
              <th>${FINAL_SCORE_MAX}%</th>
              <th>${SCORE_MAX}%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="page-foot">
          <div>${escapeHtml(selectedClassLabel)}</div>
          <div>Page 1</div>
          <div>ទំព័រ ១</div>
        </div>
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
  return (
    <div>
      <PageHeader title={t("exams")} subtitle={t("exams_subtitle")} />
      <div ref={resultListRef}>
        <SectionCard title={t("result_list")} className="mb-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_minmax(220px,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                {t("class")}
              </span>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.currentTarget.value);
                  setShowScoredOnly(false);
                }}
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
                onChange={(event) => {
                  setSemester(event.currentTarget.value);
                  setShowScoredOnly(false);
                }}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {SEMESTER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Subject
              </span>
              <select
                value={selectedScoreSubject?.code ?? ""}
                onChange={(event) => {
                  setScoreSubjectCode(event.currentTarget.value);
                  setShowScoredOnly(false);
                }}
                disabled={!classId || scoreSheetSubjectOptions.length === 0}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select subject</option>
                {scoreSheetSubjectOptions.map((subject) => (
                  <option key={subject.code} value={subject.code}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={viewSelectedResult}
                disabled={!classId || studentsLoading || enrolled.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {studentsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {t("view_result")}
              </button>
              {showScoredOnly && (
                <button
                  onClick={() => setShowScoredOnly(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold hover:bg-muted"
                >
                  {t("all_students")}
                </button>
              )}
              {canManageScores && !showScoredOnly && (
                <button
                  onClick={() => saveScoresMut.mutate()}
                  disabled={
                    !classId ||
                    !selectedScoreSubject ||
                    studentsLoading ||
                    enrolled.length === 0 ||
                    saveScoresMut.isPending
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveScoresMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Scores
                </button>
              )}
              <button
                onClick={() => printDocument("Student Score Table", scoreReportHtml())}
                disabled={
                  !classId || !selectedScoreSubject || studentsLoading || enrolled.length === 0
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {studentsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print Score Table
              </button>
            </div>
          </div>
          {classId && (
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {showScoredOnly
                ? `${classResultRows.length} students with scores`
                : `${enrolled.length} students`}{" "}
              ·{" "}
              {showScoredOnly
                ? selectedClassLabel
                : (selectedScoreSubject?.label ?? "No subject selected")}{" "}
              · {subjectScores.length} saved score entries
            </p>
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
          ) : showScoredOnly && classResultRows.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No students have scores entered for this class yet.
            </p>
          ) : showScoredOnly ? (
            <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[920px] border-collapse text-sm text-slate-950">
                <thead>
                  <tr className="border-b border-border bg-muted/35 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="border-r border-border px-3 py-3 text-center">No</th>
                    <th className="border-r border-border px-3 py-3">Student ID</th>
                    <th className="border-r border-border px-3 py-3">Student Name</th>
                    <th className="border-r border-border px-3 py-3 text-center">Gender</th>
                    {classResultSubjects.map((subject) => (
                      <th
                        key={subject.code}
                        className="border-r border-border px-3 py-3 text-center"
                      >
                        {subject.label}
                      </th>
                    ))}
                    <th className="border-r border-border px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {classResultRows.map((row, index) => (
                    <tr key={row.student.student_id} className="border-b border-border/60">
                      <td className="border-r border-border/60 px-3 py-3 text-center font-semibold">
                        {index + 1}
                      </td>
                      <td className="border-r border-border/60 px-3 py-3 font-mono text-xs">
                        {row.student.students.student_code}
                      </td>
                      <td className="border-r border-border/60 px-3 py-3 font-semibold">
                        {row.student.students.full_name_km || row.student.students.full_name}
                      </td>
                      <td className="border-r border-border/60 px-3 py-3 text-center">
                        {khmerGenderLabel(row.student.students.gender) || "-"}
                      </td>
                      {row.scores.map((score, scoreIndex) => (
                        <td
                          key={`${row.student.student_id}-${classResultSubjects[scoreIndex]?.code}`}
                          className="border-r border-border/60 px-3 py-3 text-center font-semibold tabular-nums"
                        >
                          {formatScoreValue(score) || "-"}
                        </td>
                      ))}
                      <td className="border-r border-border/60 px-3 py-3 text-center font-black tabular-nums">
                        {formatScoreValue(row.total)}
                      </td>
                      <td className="px-3 py-3 text-center font-black tabular-nums">
                        {formatScoreValue(row.average) || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !selectedScoreSubject ? (
            <p className="mt-6 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No assigned subject available for this class.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full min-w-[1180px] border-collapse text-sm text-slate-950">
                <thead>
                  <tr className="border-b border-border bg-muted/35 text-center text-xs font-semibold text-muted-foreground">
                    <th rowSpan={3} className="w-12 px-3 py-3">
                      No
                    </th>
                    <th rowSpan={3} className="w-28 px-3 py-3 text-left">
                      Student ID
                    </th>
                    <th colSpan={2} className="px-3 py-2">
                      Student name
                    </th>
                    <th rowSpan={3} className="w-20 px-3 py-3">
                      Gender
                    </th>
                    <th rowSpan={3} className="w-28 px-3 py-3">
                      Date of birth
                    </th>
                    <th colSpan={6} className="px-3 py-2">
                      Score
                    </th>
                    <th rowSpan={3} className="w-24 px-3 py-3">
                      Remark
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-muted/35 text-center text-xs font-semibold text-muted-foreground">
                    <th rowSpan={2} className="w-36 px-3 py-2 text-left">
                      Family name
                    </th>
                    <th rowSpan={2} className="w-40 px-3 py-2 text-left">
                      Given name
                    </th>
                    <th className="w-28 px-3 py-2">Attendance</th>
                    <th className="w-28 px-3 py-2">Assignment</th>
                    <th className="w-28 px-3 py-2">Midterm</th>
                    <th className="w-28 px-3 py-2">Final</th>
                    <th className="w-28 px-3 py-2">Total score</th>
                    <th className="w-28 px-3 py-2">Average</th>
                  </tr>
                  <tr className="border-b border-border bg-muted/35 text-center text-xs font-semibold text-muted-foreground">
                    <th className="px-3 py-2">{ATTENDANCE_SCORE_MAX}%</th>
                    <th className="px-3 py-2">{ASSIGNMENT_SCORE_MAX}%</th>
                    <th className="px-3 py-2">{MIDTERM_SCORE_MAX}%</th>
                    <th className="px-3 py-2">{FINAL_SCORE_MAX}%</th>
                    <th className="px-3 py-2">{SCORE_MAX}%</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {scoreTableRows.map(({ student, score }, index) => {
                    const editable = canManageScores;
                    const displayName = student.students.full_name_km || student.students.full_name;
                    const studentName = splitStudentName(displayName);
                    const inputClass =
                      "h-9 w-full rounded-lg border border-border bg-background px-2 text-center text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted";
                    return (
                      <tr
                        key={student.student_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-3 py-3 text-center font-semibold">{index + 1}</td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {student.students.student_code}
                        </td>
                        <td className="px-3 py-3 font-semibold">{studentName.familyName}</td>
                        <td className="px-3 py-3 font-semibold">{studentName.givenName}</td>
                        <td className="px-3 py-3 text-center">
                          {khmerGenderLabel(student.students.gender)}
                        </td>
                        <td className="px-3 py-3 text-center text-xs">
                          {formatDateDisplay(student.students.date_of_birth)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div
                            title={`${score.attendanceCount} attendance records, ${score.absenceCount} absences`}
                            className="flex min-h-12 flex-col items-center justify-center rounded-lg border border-border bg-muted px-2 py-1"
                          >
                            <span className="text-sm font-semibold">
                              {score.attendance.toFixed(2)}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Absent: {score.absenceCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <input
                            key={`${student.student_id}-${selectedScoreSubject.code}-assignment`}
                            type="number"
                            min={0}
                            max={ASSIGNMENT_SCORE_MAX}
                            step="0.01"
                            value={scoreComponentInputValue(
                              student.student_id,
                              selectedScoreSubject.code,
                              "assignment_score",
                              score.assignment,
                            )}
                            disabled={!editable}
                            onChange={(event) =>
                              setScoreDraft(
                                student.student_id,
                                selectedScoreSubject.code,
                                "assignment_score",
                                event.currentTarget.value,
                              )
                            }
                            onBlur={(event) =>
                              setSubjectScoreComponent(
                                student.student_id,
                                selectedScoreSubject.code,
                                "assignment_score",
                                event.currentTarget.value,
                              )
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            key={`${student.student_id}-${selectedScoreSubject.code}-midterm`}
                            type="number"
                            min={0}
                            max={MIDTERM_SCORE_MAX}
                            step="0.01"
                            value={scoreComponentInputValue(
                              student.student_id,
                              selectedScoreSubject.code,
                              "midterm_score",
                              score.midterm,
                            )}
                            disabled={!editable}
                            onChange={(event) =>
                              setScoreDraft(
                                student.student_id,
                                selectedScoreSubject.code,
                                "midterm_score",
                                event.currentTarget.value,
                              )
                            }
                            onBlur={(event) =>
                              setSubjectScoreComponent(
                                student.student_id,
                                selectedScoreSubject.code,
                                "midterm_score",
                                event.currentTarget.value,
                              )
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            key={`${student.student_id}-${selectedScoreSubject.code}-final`}
                            type="number"
                            min={0}
                            max={FINAL_SCORE_MAX}
                            step="0.01"
                            value={scoreComponentInputValue(
                              student.student_id,
                              selectedScoreSubject.code,
                              "final_score",
                              score.final,
                            )}
                            disabled={!editable}
                            onChange={(event) =>
                              setScoreDraft(
                                student.student_id,
                                selectedScoreSubject.code,
                                "final_score",
                                event.currentTarget.value,
                              )
                            }
                            onBlur={(event) =>
                              setSubjectScoreComponent(
                                student.student_id,
                                selectedScoreSubject.code,
                                "final_score",
                                event.currentTarget.value,
                              )
                            }
                            className={inputClass}
                          />
                        </td>
                        <td className="px-3 py-3 text-center font-black">
                          {score.total.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center font-black">
                          {score.average.toFixed(2)}
                        </td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
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
                <th className="py-3 text-right">{t("action")}</th>
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
                  <td className="py-3 text-right">
                    <button
                      onClick={() => viewExamResult(e)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                      {t("view_result")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
