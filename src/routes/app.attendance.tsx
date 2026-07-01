import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, StatCard } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck,
  Printer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FLAT_MAJOR_OPTIONS } from "@/lib/academic-options";
import {
  DEFAULT_SUBJECT_OPTIONS,
  readDemoSubjects,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { pageTitle } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { findTeacherClassScope } from "@/lib/teacher-scope";

type Status = "present" | "absent" | "late" | "excused";
type AttendanceClass = { id: string; name: string; majors: string[]; isSynthetic?: boolean };

export const Route = createFileRoute("/app/attendance")({
  head: () => ({ meta: [{ title: pageTitle("Attendance") }] }),
  component: AttendancePage,
});

type DemoAttendanceRow = {
  student_id: string;
  class_id: string;
  date: string;
  semester?: string;
  week_number?: number;
  day_of_week?: number;
  subject_code?: string;
  status: Status;
};
const DEMO_ATTENDANCE_KEY = "studentsphere.demo.attendance";
const SYNTHETIC_CLASS_PREFIX = "student-class:";
const SEMESTER_OPTIONS = ["Semester 1", "Semester 2"];
const WEEK_OPTIONS = Array.from({ length: 48 }, (_, index) => index + 1);
const DAY_OPTIONS = ["M", "T", "W", "T", "F", "S", "S"];
const STATUS_LABELS: Record<Status, string> = {
  present: "P",
  absent: "A",
  late: "L",
  excused: "E",
};
const STATUS_OPTIONS: Array<{ value: Status; label: string; short: string; className: string }> = [
  {
    value: "present",
    label: "Present",
    short: "P",
    className: "bg-success/15 text-success",
  },
  {
    value: "absent",
    label: "Absent",
    short: "A",
    className: "bg-destructive/15 text-destructive",
  },
  {
    value: "late",
    label: "Late",
    short: "L",
    className: "bg-warning/20 text-warning-foreground",
  },
  {
    value: "excused",
    label: "Excused",
    short: "E",
    className: "bg-info/15 text-info",
  },
];
const ALL_MAJORS = "all";

function readDemoList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemoAttendance(rows: DemoAttendanceRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ATTENDANCE_KEY, JSON.stringify(rows));
}

function syntheticClassId(className: string) {
  return `${SYNTHETIC_CLASS_PREFIX}${className}`;
}

function classNameFromId(classId: string, classes: AttendanceClass[]) {
  const selectedClass = classes.find((c) => c.id === classId);
  return selectedClass?.name ?? classId.replace(SYNTHETIC_CLASS_PREFIX, "");
}

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

function classMatchesMajor(classRow: AttendanceClass, major: string) {
  return major === ALL_MAJORS || classRow.majors.includes(major);
}

function cellTone(status?: Status) {
  if (status === "present") return "bg-success/15 text-success hover:bg-success/25";
  if (status === "absent") return "bg-destructive/15 text-destructive hover:bg-destructive/25";
  if (status === "late") return "bg-warning/20 text-warning-foreground hover:bg-warning/30";
  if (status === "excused") return "bg-info/15 text-info hover:bg-info/25";
  return "bg-background text-muted-foreground hover:bg-muted";
}

function addDaysToIsoDate(startDate: string, dayOffset: number) {
  const base = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return startDate;
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString().slice(0, 10);
}

function formatIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printDocument(title: string, html: string, orientation: "portrait" | "landscape" = "landscape") {
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
          @page { size: A4 ${orientation}; margin: 12mm; }
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
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function AttendancePage() {
  const { t } = useI18n();
  const { user, primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [semester, setSemester] = useState(SEMESTER_OPTIONS[0]);
  const [subjectCode, setSubjectCode] = useState(DEFAULT_SUBJECT_OPTIONS[0]?.code ?? "Subject 1");
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [selectedMajor, setSelectedMajor] = useState(ALL_MAJORS);
  const [classId, setClassId] = useState("");
  const [slotDates, setSlotDates] = useState<Record<number, string>>({});
  const weekNumber = 1;
  const visibleWeeks = WEEK_OPTIONS.slice(weekNumber - 1, Math.min(48, weekNumber + 3));
  const attendanceSlots = visibleWeeks
    .flatMap((week) =>
      DAY_OPTIONS.map((dayLabel, index) => ({
        slot: (week - weekNumber) * DAY_OPTIONS.length + index + 1,
        week,
        day: index + 1,
        dayLabel,
      })),
    )
    .slice(0, 18);
  const defaultSlotDate = (slotIndex: number) => addDaysToIsoDate(date, slotIndex * 7);
  const slotDateFor = (slotNumber: number, slotIndex: number) =>
    slotDates[slotNumber] ?? defaultSlotDate(slotIndex);
  const isStudent = primaryRole === "student";
  const isTeacher = primaryRole === "teacher";
  const canManageAttendance = primaryRole === "admin" || primaryRole === "teacher";

  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["subject-options", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const rows = readDemoSubjects();
        if (!isTeacher) return subjectRowsToOptions(rows);

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
        if (subjectCodes.length === 0) return DEFAULT_SUBJECT_OPTIONS;

        const { data, error } = await supabase
          .from("subjects")
          .select("subject_id,subject_name,description")
          .in("subject_id", subjectCodes)
          .order("subject_name", { ascending: true });
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
        .order("subject_name", { ascending: true });
      if (error) return DEFAULT_SUBJECT_OPTIONS;

      const options = (data ?? []).map((subject) => ({
        code: subject.subject_id,
        label: subject.subject_name || subject.subject_id,
        description: subject.description,
      }));
      return options.length > 0 ? options : DEFAULT_SUBJECT_OPTIONS;
    },
  });
  const selectedSubject =
    subjectOptions.find((subject) => subject.code === subjectCode) ?? subjectOptions[0];

  useEffect(() => {
    if (!subjectOptions.some((subject) => subject.code === subjectCode)) {
      setSubjectCode(subjectOptions[0]?.code ?? DEFAULT_SUBJECT_OPTIONS[0]?.code ?? "Subject 1");
    }
  }, [subjectCode, subjectOptions]);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min-attendance", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        const demoStudents = readDemoList<{ class_name?: string | null; major?: string | null }>(
          "studentsphere.demo.students",
        );
        const visibleDemoStudents =
          isStudent && demoStudents.length > 0
            ? demoStudents.filter(
                (student) => student.class_name === demoStudents[0]?.class_name,
              )
            : demoStudents;
        const majorsByClass = new Map<string, Set<string>>();
        visibleDemoStudents.forEach((student) => {
          const className = student.class_name?.trim();
          if (!className || !student.major) return;
          const majors = majorsByClass.get(className) ?? new Set<string>();
          majors.add(student.major);
          majorsByClass.set(className, majors);
        });

        const teacher = readDemoList<{ id: string }>("studentsphere.demo.teachers")[0];
        const storedClasses = readDemoList<{ id: string; name: string; teacher_id?: string | null }>(
          "studentsphere.demo.classes",
        )
          .filter((c) => !isTeacher || !teacher || c.teacher_id === teacher.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            majors: Array.from(majorsByClass.get(c.name) ?? []),
          }));
        const storedNames = new Set(storedClasses.map((c) => c.name));
        const studentClassNames = Array.from(
          new Set(
            visibleDemoStudents
              .map((student) => student.class_name?.trim())
              .filter((name): name is string => !!name),
          ),
        );
        const syntheticClasses = studentClassNames
          .filter((name) => !storedNames.has(name))
          .filter(() => !isTeacher)
          .map((name) => ({
            id: syntheticClassId(name),
            name,
            majors: Array.from(majorsByClass.get(name) ?? []),
            isSynthetic: true,
          }));
        const combined = [...storedClasses, ...syntheticClasses].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        return combined;
      }

      const scope = isTeacher ? await findTeacherClassScope(user) : null;
      const scopedClasses = uniqueAttendanceClasses(
        (scope?.classes ?? []).map((classRow) => ({
          id: classRow.id,
          name: classRow.name,
          majors: [],
        })),
      );
      if (isTeacher && scopedClasses.length > 0) return scopedClasses;

      const studentClassesQuery = isStudent
        ? supabase.rpc("list_student_classmates")
        : supabase.from("students").select("class_name,major").not("class_name", "is", null);
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

      const majorsByClass = new Map<string, Set<string>>();
      (studentsResult.data ?? []).forEach((student) => {
        const className = student.class_name?.trim();
        if (!className || !student.major) return;
        const majors = majorsByClass.get(className) ?? new Set<string>();
        majors.add(student.major);
        majorsByClass.set(className, majors);
      });

      const ownClassNames = new Set(
        (studentsResult.data ?? [])
          .map((student) => student.class_name?.trim())
          .filter((name): name is string => !!name),
      );
      const storedClasses = (classesResult.data ?? [])
        .filter((c) => !isStudent || ownClassNames.has(c.name))
        .map((c) => ({
        id: c.id,
        name: c.name,
        majors: Array.from(majorsByClass.get(c.name) ?? []),
      }));
      const storedNames = new Set(storedClasses.map((c) => c.name));
      const syntheticClasses = Array.from(majorsByClass.keys())
        .filter((name) => !storedNames.has(name))
        .filter((name) => !isStudent || ownClassNames.has(name))
        .filter(() => !isTeacher)
        .map((name) => ({
          id: syntheticClassId(name),
          name,
          majors: Array.from(majorsByClass.get(name) ?? []),
          isSynthetic: true,
        }));

      return uniqueAttendanceClasses([...storedClasses, ...scopedClasses, ...syntheticClasses]);
    },
  });
  const filteredClasses = classes.filter((classRow) => classMatchesMajor(classRow, selectedMajor));

  useEffect(() => {
    if (
      (isStudent || isTeacher) &&
      filteredClasses.length > 0 &&
      !filteredClasses.some((item) => item.id === classId)
    ) {
      setClassId(filteredClasses[0].id);
    }
  }, [classId, filteredClasses, isStudent, isTeacher]);

  const { data: enrolled = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["enrolled-students", classId, selectedMajor, isDemo ? "demo" : "remote"],
    enabled: !!classId,
    queryFn: async () => {
      if (isDemo) {
        const selectedClassName = classNameFromId(classId, classes);
        const demoStudents = readDemoList<{
          id: string;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          student_code: string;
          gender?: string | null;
          date_of_birth?: string | null;
          class_name?: string | null;
          major?: string | null;
          address?: string | null;
        }>("studentsphere.demo.students");
        const visibleDemoStudents =
          isStudent && demoStudents.length > 0
            ? demoStudents.filter((student) => student.class_name === demoStudents[0]?.class_name)
            : demoStudents;
        return visibleDemoStudents
          .filter(
            (s) =>
              s.class_name === selectedClassName &&
              (selectedMajor === ALL_MAJORS || s.major === selectedMajor),
          )
          .map((s) => ({
            student_id: s.id,
            students: {
              id: s.id,
              full_name: s.full_name_en || s.full_name,
              full_name_km: s.full_name_km,
              student_code: s.student_code,
              gender: s.gender,
              date_of_birth: s.date_of_birth,
              address: s.address,
              major: s.major,
              class_name: s.class_name,
            },
          }));
      }

      const selectedClassName = classNameFromId(classId, classes);
      if (isStudent) {
        const { data, error } = await supabase.rpc("list_student_classmates");
        if (error) throw error;
        return ((data ?? []) as Array<{
          id: string;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          student_code: string;
          gender?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          major?: string | null;
          class_name?: string | null;
          status?: string | null;
        }>)
          .filter(
            (student) =>
              student.class_name === selectedClassName &&
              student.status === "active" &&
              (selectedMajor === ALL_MAJORS || student.major === selectedMajor),
          )
          .map((student) => ({
            student_id: student.id,
            students: {
              id: student.id,
              full_name: student.full_name_en || student.full_name,
              full_name_km: student.full_name_km,
              student_code: student.student_code,
              gender: student.gender,
              date_of_birth: student.date_of_birth,
              address: student.address,
              major: student.major,
              class_name: student.class_name,
            },
          }));
      }
      const selectedClass = classes.find((c) => c.id === classId);
      if (!selectedClass?.isSynthetic) {
        const { data } = await supabase
          .from("enrollments")
          .select(
            "student_id,students(id,full_name,full_name_km,student_code,major,gender,date_of_birth,address,class_name)",
          )
          .eq("class_id", classId);
        let enrolledRows = (data ?? []) as unknown as Array<{
          student_id: string;
          students: {
            id: string;
            full_name: string;
            full_name_km: string | null;
            student_code: string;
            major: string | null;
            gender: string | null;
            date_of_birth: string | null;
            address: string | null;
            class_name: string | null;
          };
        }>;
        if (selectedMajor !== ALL_MAJORS) {
          enrolledRows = enrolledRows.filter((row) => row.students?.major === selectedMajor);
        }
        if (enrolledRows.length > 0) return enrolledRows;
      }

      let query = supabase
        .from("students")
        .select("id,full_name,full_name_km,student_code,gender,date_of_birth,address,major,class_name")
        .eq("class_name", selectedClassName)
        .eq("status", "active")
        .order("full_name");
      if (selectedMajor !== ALL_MAJORS) {
        query = query.eq("major", selectedMajor);
      }

      const { data: classNameStudents, error } = await query;
      if (error) throw error;

      return (classNameStudents ?? []).map((student) => ({
        student_id: student.id,
        students: {
          id: student.id,
          full_name: student.full_name,
          full_name_km: student.full_name_km,
          student_code: student.student_code,
          gender: student.gender,
          date_of_birth: student.date_of_birth,
          address: student.address,
          major: student.major,
          class_name: student.class_name,
        },
      }));
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: [
      "attendance-day",
      classId,
      semester,
      weekNumber,
      subjectCode,
      date,
      isDemo ? "demo" : "remote",
    ],
    enabled: !!classId,
    queryFn: async () => {
      if (isDemo) {
        return readDemoList<DemoAttendanceRow>(DEMO_ATTENDANCE_KEY)
          .filter(
            (r) =>
              r.class_id === classId &&
              (r.semester ?? "Semester 1") === semester &&
              visibleWeeks.includes(r.week_number ?? 1) &&
              (r.subject_code ?? DEFAULT_SUBJECT_OPTIONS[0]?.code) === subjectCode,
          )
          .map((r) => ({
            student_id: r.student_id,
            status: r.status,
            week_number: r.week_number ?? 1,
            day_of_week: r.day_of_week ?? 1,
          }));
      }

      const { data } = await supabase
        .from("attendance")
        .select("student_id,status,week_number,day_of_week")
        .eq("class_id", classId)
        .eq("semester", semester)
        .gte("week_number", weekNumber)
        .lte("week_number", visibleWeeks.at(-1) ?? weekNumber)
        .eq("subject_code", subjectCode);
      return data ?? [];
    },
  });

  const attendanceFor = (studentId: string, week: number, day: number): Status | undefined => {
    const r = existing.find(
      (e) => e.student_id === studentId && e.week_number === week && e.day_of_week === day,
    );
    return r?.status as Status | undefined;
  };

  const setStudentStatus = useMutation({
    mutationFn: async ({
      sid,
      week,
      day,
      recordDate,
      status,
    }: {
      sid: string;
      week: number;
      day: number;
      recordDate: string;
      status: Status;
    }) => {
      if (isDemo) {
        const rows = readDemoList<DemoAttendanceRow>(DEMO_ATTENDANCE_KEY);
        const next = rows.filter(
          (r) =>
            !(
              r.student_id === sid &&
              r.class_id === classId &&
              (r.semester ?? "Semester 1") === semester &&
              (r.week_number ?? 1) === week &&
              (r.day_of_week ?? 1) === day &&
              (r.subject_code ?? DEFAULT_SUBJECT_OPTIONS[0]?.code) === subjectCode
            ),
        );
        next.push({
          student_id: sid,
          class_id: classId,
          date: recordDate,
          semester,
          week_number: week,
          day_of_week: day,
          subject_code: subjectCode,
          status,
        });
        writeDemoAttendance(next);
        return;
      }

      const { error } = await supabase.from("attendance").upsert(
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
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: [
          "attendance-day",
          classId,
          semester,
          weekNumber,
          subjectCode,
          date,
          isDemo ? "demo" : "remote",
        ],
      }),
    onError: (e) => toast.error(e.message),
  });

  const setStudentCellStatus = (
    studentId: string,
    week: number,
    day: number,
    recordDate: string,
    status: Status | null,
  ) => {
    if (!status) {
      if (isDemo) {
        const rows = readDemoList<DemoAttendanceRow>(DEMO_ATTENDANCE_KEY);
        const next = rows.filter(
          (r) =>
            !(
              r.student_id === studentId &&
              r.class_id === classId &&
              (r.semester ?? "Semester 1") === semester &&
              (r.week_number ?? 1) === week &&
              (r.day_of_week ?? 1) === day &&
              (r.subject_code ?? DEFAULT_SUBJECT_OPTIONS[0]?.code) === subjectCode
            ),
        );
        writeDemoAttendance(next);
        qc.invalidateQueries({
          queryKey: [
            "attendance-day",
            classId,
            semester,
            weekNumber,
            subjectCode,
            date,
            isDemo ? "demo" : "remote",
          ],
        });
        return;
      }

      supabase
        .from("attendance")
        .delete()
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .eq("semester", semester)
        .eq("week_number", week)
        .eq("day_of_week", day)
        .eq("subject_code", subjectCode)
        .then(({ error }) => {
          if (error) toast.error(error.message);
          qc.invalidateQueries({
            queryKey: [
              "attendance-day",
              classId,
              semester,
              weekNumber,
              subjectCode,
              date,
              isDemo ? "demo" : "remote",
            ],
          });
        });
      return;
    }

    setStudentStatus.mutate({ sid: studentId, week, day, recordDate, status });
  };

  const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  existing.forEach((row) => {
    const status = row.status as Status;
    counts[status] += 1;
  });

  const isLoading = studentsLoading;
  const selectedClassLabel = classId ? classNameFromId(classId, classes) : "-";
  const attendanceRangeLabel =
    attendanceSlots.length > 0
      ? `${formatIsoDate(slotDateFor(attendanceSlots[0].slot, 0))} - ${formatIsoDate(
          slotDateFor(attendanceSlots.at(-1)?.slot ?? 1, attendanceSlots.length - 1),
        )}`
      : "-";
  const attendanceReportHtml = () => {
    const today = new Date().toISOString().slice(0, 10);
    const slotHeaders = attendanceSlots
      .map((slot) => `<th style="width: 24px">${slot.slot}</th>`)
      .join("");
    const rows = enrolled
      .map((student, index) => {
        const cells = attendanceSlots
          .map((slot) => {
            const status = attendanceFor(student.student_id, slot.week, slot.day);
            return `<td>${status ? escapeHtml(STATUS_LABELS[status]) : ""}</td>`;
          })
          .join("");
        return `
          <tr>
            <td style="width: 28px">${index + 1}</td>
            <td style="width: 78px">${escapeHtml(student.students.student_code)}</td>
            <td class="name" style="width: 130px">${escapeHtml(
              student.students.full_name_km || student.students.full_name,
            )}</td>
            <td class="name" style="width: 130px">${escapeHtml(student.students.full_name)}</td>
            <td style="width: 30px">${escapeHtml(
              student.students.gender?.toLowerCase().startsWith("f") ? "F" : "M",
            )}</td>
            <td style="width: 72px">${escapeHtml(student.students.date_of_birth)}</td>
            ${cells}
            <td style="width: 58px"></td>
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
            <h3>បញ្ជីវត្តមាននិស្សិត ក្រុម ${escapeHtml(selectedClassLabel)}</h3>
          </div>
          <div></div>
        </section>
        <div class="meta">
          ${escapeHtml(semester)} · ${escapeHtml(selectedSubject?.label ?? subjectCode)} · ${escapeHtml(attendanceRangeLabel)}<br />
          កាលបរិច្ឆេទ ${escapeHtml(today)} · ចំនួននិស្សិត ${enrolled.length} នាក់
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 28px">ល.រ</th>
              <th rowspan="2" style="width: 78px">អត្តលេខ</th>
              <th rowspan="2" class="name" style="width: 130px">គោត្តនាម និង នាម</th>
              <th rowspan="2" class="name" style="width: 130px">នាមជាអក្សរឡាតាំង</th>
              <th rowspan="2" style="width: 30px">ភេទ</th>
              <th rowspan="2" style="width: 72px">ថ្ងៃខែកំណើត</th>
              <th colspan="${attendanceSlots.length}">ការចុះវត្តមាននិស្សិត</th>
              <th rowspan="2" style="width: 58px">ផ្សេងៗ</th>
            </tr>
            <tr>${slotHeaders}</tr>
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
  return (
    <div>
      <PageHeader
        title={t("attendance")}
        subtitle={t("attendance_subtitle")}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={selectedMajor}
          onChange={(e) => {
            setSelectedMajor(e.target.value);
            setClassId("");
          }}
          disabled={isStudent}
          className="h-10 max-w-80 rounded-xl border border-border bg-surface px-3 text-sm"
        >
          <option value={ALL_MAJORS}>{t("all_majors")}</option>
          {FLAT_MAJOR_OPTIONS.map((major) => (
            <option key={major.value} value={major.value}>
              {major.label}
            </option>
          ))}
        </select>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={isStudent && filteredClasses.length <= 1}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
        >
          <option value="">— Select class —</option>
          {filteredClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
        />
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm"
        >
          {SEMESTER_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={subjectSearchOpen}
              aria-label="Search subject"
              className="h-10 w-full justify-between rounded-xl bg-surface px-3 font-normal sm:w-64"
            >
              <span className="truncate">{selectedSubject?.label ?? "Select subject"}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandInput placeholder={t("search_subjects")} />
              <CommandList>
                <CommandEmpty>{t("no_subjects_yet")}</CommandEmpty>
                <CommandGroup>
                  {subjectOptions.map((subject) => (
                    <CommandItem
                      key={subject.code}
                      value={`${subject.label} ${subject.code}`}
                      onSelect={() => {
                        setSubjectCode(subject.code);
                        setSubjectSearchOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          subject.code === subjectCode ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{subject.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {!classId ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("select_class")}</p>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("present")}
              value={counts.present}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label={t("absent")}
              value={counts.absent}
              icon={<XCircle className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label={t("late")}
              value={counts.late}
              icon={<Clock className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              label={t("excused")}
              value={counts.excused}
              icon={<ShieldCheck className="h-5 w-5" />}
              tone="primary"
            />
          </div>
          <SectionCard className="mt-6">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : enrolled.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students enrolled in this class.
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-white p-4 text-slate-950 shadow-sm">
                <div className="mb-4 grid gap-3 border-b border-slate-300 pb-4 text-xs sm:grid-cols-[1fr_auto_1fr]">
                  <div className="space-y-1 font-semibold">
                    <p>Class: {selectedClassLabel}</p>
                    <p>Subject: {selectedSubject?.label ?? subjectCode}</p>
                    <p>Semester: {semester}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-black uppercase tracking-wide">
                      Student Attendance Sheet
                    </p>
                    <p className="mt-1 font-semibold text-slate-600">
                      {attendanceRangeLabel} · {attendanceSlots.length} sessions
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start justify-start gap-1.5 font-semibold sm:justify-end">
                    <button
                      onClick={() =>
                        printDocument("Attendance List", attendanceReportHtml(), "landscape")
                      }
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 hover:bg-slate-100"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print Attendance List
                    </button>
                    {STATUS_OPTIONS.map((status) => (
                      <span
                        key={status.value}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 ${status.className}`}
                      >
                        {status.short} = {status.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-400">
                  <table className="w-full min-w-[1480px] table-fixed border-collapse text-[11px]">
                    <thead>
                      <tr>
                        <th
                          rowSpan={3}
                          className="sticky left-0 z-30 w-12 border border-slate-500 bg-slate-100 px-2 py-2 text-center font-black"
                        >
                          ល.រ
                        </th>
                        <th
                          rowSpan={3}
                          className="sticky left-12 z-30 w-32 border border-slate-500 bg-slate-100 px-3 py-2 text-center font-black"
                        >
                          ID
                        </th>
                        <th
                          rowSpan={3}
                          className="sticky left-[11rem] z-30 w-48 border border-slate-500 bg-slate-100 px-2 py-2 text-center text-[10px] font-black"
                        >
                          Name
                        </th>
                        <th
                          rowSpan={3}
                          className="sticky left-[23rem] z-30 w-14 border border-slate-500 bg-slate-100 px-1.5 py-2 text-center text-[10px] font-black"
                        >
                          Sex
                        </th>
                        <th
                          colSpan={attendanceSlots.length}
                          className="border border-slate-500 bg-slate-100 px-3 py-2 text-center text-sm font-black uppercase tracking-wide"
                        >
                          Attendance Record
                        </th>
                      </tr>
                      <tr>
                        {attendanceSlots.map((slot, index) => (
                          <th
                            key={`${slot.week}-${slot.day}-date`}
                            className="h-28 w-14 border border-slate-500 bg-slate-50 px-1 py-1 text-center align-bottom text-[10px] font-black"
                          >
                            <input
                              type="date"
                              value={slotDateFor(slot.slot, index)}
                              onChange={(event) =>
                                setSlotDates((current) => ({
                                  ...current,
                                  [slot.slot]: event.currentTarget.value,
                                }))
                              }
                              className="mx-auto block h-7 w-28 origin-center -rotate-90 rounded border border-slate-300 bg-white px-1 text-[10px] font-black text-slate-950 outline-none focus:border-primary"
                              aria-label={`Date for attendance slot ${slot.slot}`}
                            />
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {attendanceSlots.map((slot) => (
                          <th
                            key={`${slot.week}-${slot.day}-slot`}
                            className="h-7 w-14 border border-slate-500 bg-slate-50 text-center text-[11px] font-black"
                            title={`Week ${slot.week}, ${slot.dayLabel}`}
                          >
                            {slot.slot}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {enrolled.map((student, index) => (
                        <tr
                          key={student.student_id}
                          className="odd:bg-white even:bg-slate-50 hover:bg-blue-50"
                        >
                          <td className="sticky left-0 z-20 border border-slate-400 bg-inherit px-2 py-2 text-center font-mono font-semibold">
                            {index + 1}
                          </td>
                          <td className="sticky left-12 z-20 border border-slate-400 bg-inherit px-2 py-2 text-center font-mono text-[11px] font-semibold">
                            {student.students.student_code}
                          </td>
                          <td className="sticky left-[11rem] z-20 border border-slate-400 bg-inherit px-2 py-2 text-[10px] font-semibold">
                            <p className="truncate">
                              {student.students.full_name_km || student.students.full_name}
                            </p>
                            {student.students.full_name_km && (
                              <p className="truncate text-[10px] font-semibold uppercase text-slate-500">
                                {student.students.full_name}
                              </p>
                            )}
                          </td>
                          <td className="sticky left-[23rem] z-20 border border-slate-400 bg-inherit px-1.5 py-2 text-center text-[10px] capitalize">
                            {student.students.gender || "-"}
                          </td>
                          {attendanceSlots.map((slot, slotIndex) => {
                            const status = attendanceFor(student.student_id, slot.week, slot.day);
                            const recordDate = slotDateFor(slot.slot, slotIndex);
                            return (
                              <td
                                key={`${student.student_id}-${slot.week}-${slot.day}`}
                                className="border border-slate-400 bg-white p-0"
                              >
                                <select
                                  value={status ?? ""}
                                  disabled={!canManageAttendance}
                                  onChange={(event) =>
                                    setStudentCellStatus(
                                      student.student_id,
                                      slot.week,
                                      slot.day,
                                      recordDate,
                                      event.currentTarget.value
                                        ? (event.currentTarget.value as Status)
                                        : null,
                                    )
                                  }
                                  className={`h-9 w-full min-w-14 appearance-none border-0 px-1 text-center text-xs font-black outline-none ring-inset transition-colors focus:ring-2 focus:ring-primary ${cellTone(status)}`}
                                  aria-label={`${student.students.full_name}, slot ${slot.slot}`}
                                >
                                  <option value="">-</option>
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {STATUS_LABELS[option.value]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
