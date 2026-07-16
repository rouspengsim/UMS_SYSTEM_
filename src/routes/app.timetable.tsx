import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t as translate, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Loader2, Plus, X, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageTitle } from "@/lib/brand";
import {
  DEFAULT_SUBJECT_OPTIONS,
  groupSubjectOptionsByMajor,
  mergeSubjectOptions,
  readDemoSubjects,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { deleteClassSchedule, saveClassSchedule } from "@/lib/timetable-admin";
import { decodeTimetableCell, encodeTimetableCell } from "@/lib/timetable-cell";
import { findTeacherClassScope, type CurrentTeacher } from "@/lib/teacher-scope";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export const Route = createFileRoute("/app/timetable")({
  head: () => ({ meta: [{ title: pageTitle("Timetable") }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    teacherId: typeof search.teacherId === "string" ? search.teacherId : undefined,
  }),
  component: TimetablePage,
});

const days = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
const dayLabels: Record<(typeof days)[number], string> = {
  mon: "ថ្ងៃចន្ទ",
  tue: "ថ្ងៃអង្គារ",
  wed: "ថ្ងៃពុធ",
  thu: "ថ្ងៃព្រហស្បតិ៍",
  fri: "ថ្ងៃសុក្រ",
  sat: "ថ្ងៃសៅរ៍",
};
const shiftOptions = [
  { value: "morning", label: "Morning", time: "07:00 - 11:00", start: "07:00", end: "11:00" },
  {
    value: "afternoon",
    label: "Afternoon",
    time: "13:00 - 17:00",
    start: "13:00",
    end: "17:00",
  },
  { value: "evening", label: "Evening", time: "17:30 - 20:30", start: "17:30", end: "20:30" },
  { value: "custom", label: "Custom", time: "Set manually", start: "", end: "" },
] as const;

function shiftLabelFor(startTime: string, shift?: string | null) {
  const direct = shiftOptions.find((option) => option.value === shift);
  if (direct) return direct.label;

  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

type TimetableSlot = {
  id: string;
  class_id?: string;
  day: string;
  shift?: string | null;
  start_time: string;
  end_time: string;
  room: string | null;
  classes: { name: string; subject_code: string; teachers?: { full_name: string } | null } | null;
};

type ScheduleCell = {
  teacherId?: string;
  teacher: string;
  teacherPhone: string;
  subjectCode?: string;
  subject: string;
  className?: string;
  room: string;
};

type ScheduleTimeRow = {
  id: string;
  start: string;
  end: string;
  cells: Record<(typeof days)[number], ScheduleCell>;
};

type ScheduleBuilderData = {
  id?: string;
  classId?: string;
  className: string;
  title: string;
  academicYear: string;
  issueDate: string;
  note: string;
  leftOffice: string;
  centerSignature: string;
  rightSignature: string;
  rows: ScheduleTimeRow[];
};

const EMPTY_SCHEDULES: ScheduleBuilderData[] = [];

type TimetableScheduleSlot = {
  id: string;
  class_id: string;
  day: (typeof days)[number];
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teacher_phone?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  schedule_title?: string | null;
  academic_year?: string | null;
  issue_date?: string | null;
  note?: string | null;
  left_office?: string | null;
  center_signature?: string | null;
  right_signature?: string | null;
  classes?: { name: string; subject_code?: string | null } | null;
};

const DEMO_TIMETABLE_KEY = "studentsphere.demo.timetable";
const MANUAL_SCHEDULES_KEY = "studentsphere.manual.schedules";

function emptyScheduleCells(): Record<(typeof days)[number], ScheduleCell> {
  return days.reduce(
    (acc, day) => {
      acc[day] = {
        teacherId: "",
        teacher: "",
        teacherPhone: "",
        subjectCode: "",
        subject: "",
        room: "",
      };
      return acc;
    },
    {} as Record<(typeof days)[number], ScheduleCell>,
  );
}

function createScheduleRow(id: string, start: string, end: string): ScheduleTimeRow {
  return {
    id,
    start,
    end,
    cells: emptyScheduleCells(),
  };
}

function createDefaultScheduleBuilder(): ScheduleBuilderData {
  const year = new Date().getFullYear();
  return {
    classId: "",
    className: "IT1A01",
    title: "កាលវិភាគសិក្សា ថ្នាក់ទី ១",
    academicYear: `${year} - ${year + 1}`,
    issueDate: new Date().toISOString().slice(0, 10),
    note: "សម្គាល់៖ ការកែប្រែកាលវិភាគ ត្រូវជូនដំណឹងជាមុន។\nសូមនិស្សិតគោរពពេលវេលាសិក្សា។",
    leftOffice: "សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្ត្រ\nនិងវិទ្យាសាស្ត្រសេដ្ឋកិច្ច\nការិយាល័យសិក្សា",
    centerSignature: "ប្រធានការិយាល័យសិក្សា",
    rightSignature: "អ្នករៀបចំកាលវិភាគ",
    rows: [
      createScheduleRow("row-1", "07:00", "09:30"),
      createScheduleRow("row-2", "09:30", "12:00"),
    ],
  };
}

function readManualSchedules(): ScheduleBuilderData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MANUAL_SCHEDULES_KEY);
    return raw ? (JSON.parse(raw) as ScheduleBuilderData[]) : [];
  } catch {
    return [];
  }
}

function writeManualSchedules(schedules: ScheduleBuilderData[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MANUAL_SCHEDULES_KEY, JSON.stringify(schedules));
}

function readDemoTimetable(): TimetableSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_TIMETABLE_KEY);
    return raw ? (JSON.parse(raw) as TimetableSlot[]) : [];
  } catch {
    return [];
  }
}

function writeDemoTimetable(slots: TimetableSlot[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_TIMETABLE_KEY, JSON.stringify(slots));
}

function slotsToSchedules(slots: TimetableScheduleSlot[]): ScheduleBuilderData[] {
  const byClass = new Map<string, TimetableScheduleSlot[]>();
  slots.forEach((slot) => {
    const key = slot.class_id;
    byClass.set(key, [...(byClass.get(key) ?? []), slot]);
  });

  return Array.from(byClass.entries())
    .map(([classId, classSlots]) => {
      const first = classSlots[0];
      const className = (first.classes?.name || "").toUpperCase();
      const rowMap = new Map<string, ScheduleTimeRow>();

      classSlots.forEach((slot) => {
        const payload = decodeTimetableCell(slot.room);
        const start = formatTime(slot.start_time);
        const end = formatTime(slot.end_time);
        const rowKey = `${start}-${end}`;
        const row =
          rowMap.get(rowKey) ?? createScheduleRow(`row-${classId}-${start}-${end}`, start, end);

        row.cells[slot.day] = {
          teacherId: slot.teacher_id ?? payload.teacherId ?? "",
          teacher: slot.teacher_name ?? payload.teacher ?? "",
          teacherPhone: slot.teacher_phone ?? payload.teacherPhone ?? "",
          subjectCode: slot.subject_code ?? payload.subjectCode ?? "",
          subject:
            slot.subject_name ??
            payload.subject ??
            payload.subjectCode ??
            slot.subject_code ??
            first.classes?.subject_code ??
            "",
          className,
          room: payload.room ?? slot.room ?? "",
        };
        rowMap.set(rowKey, row);
      });

      return {
        id: `remote-schedule-${classId}`,
        classId,
        className,
        title:
          first.schedule_title ||
          decodeTimetableCell(first.room).title ||
          `កាលវិភាគសិក្សា ${className}`,
        academicYear:
          first.academic_year ||
          decodeTimetableCell(first.room).academicYear ||
          `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
        issueDate:
          first.issue_date ||
          decodeTimetableCell(first.room).issueDate ||
          new Date().toISOString().slice(0, 10),
        note:
          first.note || decodeTimetableCell(first.room).note || createDefaultScheduleBuilder().note,
        leftOffice:
          first.left_office ||
          decodeTimetableCell(first.room).leftOffice ||
          createDefaultScheduleBuilder().leftOffice,
        centerSignature:
          first.center_signature ||
          decodeTimetableCell(first.room).centerSignature ||
          createDefaultScheduleBuilder().centerSignature,
        rightSignature:
          first.right_signature ||
          decodeTimetableCell(first.room).rightSignature ||
          createDefaultScheduleBuilder().rightSignature,
        rows: Array.from(rowMap.values()).sort((a, b) => a.start.localeCompare(b.start)),
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));
}

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function teacherMatchValues(teacher: CurrentTeacher | null | undefined) {
  return new Set(
    [
      teacher?.id,
      teacher?.full_name,
      teacher?.full_name_en,
      teacher?.full_name_km,
      teacher?.staff_code,
    ]
      .map(normalizeMatchValue)
      .filter(Boolean),
  );
}

function slotMatchesTeacher(
  slot: TimetableScheduleSlot,
  teacher: CurrentTeacher | null | undefined,
) {
  const values = teacherMatchValues(teacher);
  if (values.size === 0) return false;

  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeMatchValue(value)),
  );
}

function scheduleForTeacher(
  schedule: ScheduleBuilderData,
  teacher: CurrentTeacher | null | undefined,
) {
  const values = teacherMatchValues(teacher);
  if (values.size === 0) return null;

  const rows = schedule.rows
    .map((row) => {
      const cells = emptyScheduleCells();
      let hasTeacherCell = false;

      days.forEach((day) => {
        const cell = row.cells[day];
        const matches = [cell.teacherId, cell.teacher].some((value) =>
          values.has(normalizeMatchValue(value)),
        );
        if (matches) {
          cells[day] = { ...cell, className: cell.className || schedule.className };
          hasTeacherCell = true;
        }
      });

      return hasTeacherCell ? { ...row, cells } : null;
    })
    .filter((row): row is ScheduleTimeRow => !!row);

  return rows.length > 0 ? { ...schedule, rows } : null;
}

function normalizeScheduleClass(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function scheduleMatchesClassScope(
  schedule: ScheduleBuilderData,
  classIds: Set<string>,
  classNames: Set<string>,
) {
  return (
    (!!schedule.classId && classIds.has(schedule.classId)) ||
    classNames.has(normalizeScheduleClass(schedule.className))
  );
}

function teacherScheduleTitle(teacher: CurrentTeacher | null | undefined) {
  return teacher?.full_name || teacher?.full_name_en || teacher?.full_name_km || "Teacher";
}

function combineTeacherSchedules(
  schedules: ScheduleBuilderData[],
  teacher: CurrentTeacher | null | undefined,
  scopeClassIds: string[] = [],
  scopeClassNames: string[] = [],
) {
  const classIds = new Set(scopeClassIds);
  const classNames = new Set(scopeClassNames.map(normalizeScheduleClass).filter(Boolean));
  const teacherSchedules = schedules
    .map((schedule) => {
      if (scheduleMatchesClassScope(schedule, classIds, classNames)) return schedule;
      return scheduleForTeacher(schedule, teacher);
    })
    .filter((schedule): schedule is ScheduleBuilderData => !!schedule);
  if (teacherSchedules.length === 0) return [];

  const first = teacherSchedules[0];
  const rowMap = new Map<string, ScheduleTimeRow>();

  teacherSchedules.forEach((schedule) => {
    schedule.rows.forEach((row) => {
      const rowKey = `${row.start}-${row.end}`;
      const mergedRow =
        rowMap.get(rowKey) ?? createScheduleRow(`teacher-row-${rowKey}`, row.start, row.end);
      days.forEach((day) => {
        const cell = row.cells[day];
        if (cell.teacher || cell.teacherPhone || cell.subject || cell.room || cell.className) {
          mergedRow.cells[day] = { ...cell, className: cell.className || schedule.className };
        }
      });
      rowMap.set(rowKey, mergedRow);
    });
  });

  return [
    {
      ...first,
      id: `teacher-schedule-${teacher?.id ?? teacherScheduleTitle(teacher)}`,
      classId: "",
      className: teacherScheduleTitle(teacher),
      title: "កាលវិភាគសម្រាប់គ្រូ",
      rows: Array.from(rowMap.values()).sort((a, b) => a.start.localeCompare(b.start)),
    },
  ];
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function printDocument(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=1200,height=800");
  if (!printWindow) {
    toast.error(translate("allow_popups_print_report"));
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #4b5563;
            font-family: "Noto Sans Khmer", "Khmer OS Battambang", Arial, sans-serif;
            font-size: 11px;
            background: #fff;
          }
          .no-print {
            display: inline-flex;
            margin: 0 0 12px;
            border: 0;
            border-radius: 2px;
            background: #1d9bf0;
            color: white;
            padding: 7px 12px;
            font-size: 12px;
            cursor: pointer;
          }
          .report {
            width: 100%;
            max-width: 1080px;
            margin: 0 auto;
          }
          .report-top {
            display: grid;
            grid-template-columns: 1fr 1.8fr 1fr;
            align-items: start;
            gap: 18px;
            margin-bottom: 8px;
          }
          .left-note {
            padding-top: 20px;
            text-align: center;
            line-height: 1.9;
          }
          .title {
            text-align: center;
            color: #374151;
            line-height: 1.55;
          }
          .title h1,
          .title h2,
          .title h3,
          .title p {
            margin: 0;
          }
          .title h1 {
            font-size: 14px;
            font-weight: 700;
          }
          .title h2 {
            font-size: 13px;
            font-weight: 700;
          }
          .title h3 {
            margin-top: 7px;
            font-size: 14px;
            font-weight: 700;
          }
          .title p {
            font-size: 11px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th,
          td {
            border: 1px solid #6b7280;
            text-align: center;
            vertical-align: top;
          }
          th {
            height: 24px;
            padding: 3px 4px;
            color: #111827;
            font-weight: 700;
            background: #f9fafb;
          }
          td {
            height: 92px;
            padding: 0;
          }
          .time {
            border-bottom: 1px solid #d1d5db;
            padding: 3px;
            font-size: 9px;
            color: #6b7280;
          }
          .slot {
            padding: 10px 5px 5px;
            line-height: 1.45;
            color: #4b5563;
          }
          .teacher {
            color: #111827;
            font-weight: 700;
          }
          .phone {
            font-size: 9px;
          }
          .subject {
            font-weight: 700;
          }
          .footer {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr 1.1fr;
            gap: 12px;
            margin-top: 8px;
            line-height: 1.75;
            color: #4b5563;
          }
          .footer-center,
          .footer-right {
            text-align: center;
          }
          .signature-title {
            margin-top: 2px;
            color: #111827;
            font-weight: 700;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()">${escapeHtml(translate("print_schedule"))}</button>
        ${html}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function scheduleReportHtml(className: string, slots: TimetableSlot[]) {
  const timeRanges = Array.from(
    new Set(slots.map((slot) => `${formatTime(slot.start_time)}-${formatTime(slot.end_time)}`)),
  ).sort((a, b) => a.localeCompare(b));
  const today = new Date().toISOString().slice(0, 10);

  const rows = timeRanges
    .map((range) => {
      const [start, end] = range.split("-");
      return `
        <tr>
          ${days
            .map((day) => {
              const slot = slots.find(
                (item) =>
                  item.day === day &&
                  formatTime(item.start_time) === start &&
                  formatTime(item.end_time) === end,
              );
              const payload = decodeTimetableCell(slot?.room);
              const displayRoom = payload.room || "";
              return `
                <td>
                  <div class="time">${escapeHtml(start)}-${escapeHtml(end)}</div>
                  ${
                    slot
                      ? `<div class="slot">
                          ${
                            slot.classes?.teachers?.full_name
                              ? `<div class="teacher">${escapeHtml(slot.classes.teachers.full_name)}</div>`
                              : ""
                          }
                          <div class="subject">${escapeHtml(slot.classes?.subject_code)}</div>
                          <div>${escapeHtml(slot.classes?.name)}</div>
                          ${displayRoom ? `<div>${escapeHtml(displayRoom)}</div>` : ""}
                        </div>`
                      : ""
                  }
                </td>
              `;
            })
            .join("")}
        </tr>
      `;
    })
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
          <h3>កាលវិភាគសិក្សា ថ្នាក់ទី ១</h3>
          <h2>${escapeHtml(className)}</h2>
          <p>ឆ្នាំសិក្សា ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}</p>
          <p>កាលបរិច្ឆេទចេញផ្សាយ ${escapeHtml(today)}</p>
        </div>
        <div></div>
      </section>
      <table>
        <thead>
          <tr>
            ${days.map((day) => `<th>${dayLabels[day]}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="footer">
        <div>
          សម្គាល់៖ ការកែប្រែកាលវិភាគ ត្រូវជូនដំណឹងជាមុន។<br />
          សូមនិស្សិតគោរពពេលវេលាសិក្សា។
        </div>
        <div class="footer-center">
          បានឃើញ និងឯកភាព<br />
          <div class="signature-title">ប្រធានការិយាល័យសិក្សា</div>
        </div>
        <div class="footer-right">
          រាជធានីភ្នំពេញ ថ្ងៃទី ${escapeHtml(today)}<br />
          ការិយាល័យសិក្សា
          <div class="signature-title">អ្នករៀបចំកាលវិភាគ</div>
        </div>
      </section>
    </main>
  `;
}

function manualScheduleReportHtml(data: ScheduleBuilderData, showClassInCells = false) {
  const rows = data.rows
    .map(
      (row) => `
        <tr>
          ${days
            .map((day) => {
              const cell = row.cells[day];
              return `
                <td>
                  <div class="time">${escapeHtml(row.start)}-${escapeHtml(row.end)}</div>
                  ${
                    cell.teacher ||
                    cell.subject ||
                    cell.room ||
                    (showClassInCells && cell.className)
                      ? `<div class="slot">
                          ${cell.teacher ? `<div class="teacher">${escapeHtml(cell.teacher)}</div>` : ""}
                          ${cell.teacherPhone ? `<div class="phone">${escapeHtml(cell.teacherPhone)}</div>` : ""}
                          ${cell.subject ? `<div class="subject">${escapeHtml(cell.subject)}</div>` : ""}
                          ${cell.room ? `<div>${escapeHtml(cell.room)}</div>` : ""}
                          ${showClassInCells && cell.className ? `<div>${escapeHtml(cell.className)}</div>` : ""}
                        </div>`
                      : ""
                  }
                </td>
              `;
            })
            .join("")}
        </tr>
      `,
    )
    .join("");

  return `
    <main class="report">
      <section class="report-top">
        <div class="left-note">${escapeHtml(data.leftOffice).replaceAll("\n", "<br />")}</div>
        <div class="title">
          <h1>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h2>ជាតិ សាសនា ព្រះមហាក្សត្រ</h2>
          <h3>${escapeHtml(data.title)}</h3>
          <h2>${escapeHtml(data.className)}</h2>
          <p>ឆ្នាំសិក្សា ${escapeHtml(data.academicYear)}</p>
          <p>កាលបរិច្ឆេទចេញផ្សាយ ${escapeHtml(data.issueDate)}</p>
        </div>
        <div></div>
      </section>
      <table>
        <thead>
          <tr>${days.map((day) => `<th>${dayLabels[day]}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="footer">
        <div>${escapeHtml(data.note).replaceAll("\n", "<br />")}</div>
        <div class="footer-center">
          បានឃើញ និងឯកភាព<br />
          <div class="signature-title">${escapeHtml(data.centerSignature)}</div>
        </div>
        <div class="footer-right">
          រាជធានីភ្នំពេញ ថ្ងៃទី ${escapeHtml(data.issueDate)}<br />
          ការិយាល័យសិក្សា
          <div class="signature-title">${escapeHtml(data.rightSignature)}</div>
        </div>
      </section>
    </main>
  `;
}

function readDemoClassesMin(
  isStudent = false,
  isTeacher = false,
): Array<{ id: string; name: string; subject_code: string }> {
  if (typeof window === "undefined") return [];
  try {
    const teacherRaw = localStorage.getItem("studentsphere.demo.teachers");
    const teacher = teacherRaw ? (JSON.parse(teacherRaw) as Array<{ id: string }>)[0] : null;
    const raw = localStorage.getItem("studentsphere.demo.classes");
    const classes = raw
      ? (JSON.parse(raw) as Array<{
          id: string;
          name: string;
          subject_code: string;
          teacher_id?: string | null;
        }>)
      : [];
    const classItems = classes
      .filter((item) => !isTeacher || !teacher || item.teacher_id === teacher.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        subject_code: item.subject_code,
      }));

    const studentsRaw = localStorage.getItem("studentsphere.demo.students");
    const students = studentsRaw
      ? (JSON.parse(studentsRaw) as Array<{ class_name?: string | null; major?: string | null }>)
      : [];
    const visibleStudents =
      isStudent && students.length > 0
        ? students.filter((student) => student.class_name === students[0]?.class_name)
        : students;
    const studentClasses = Array.from(
      new Set(visibleStudents.map((student) => student.class_name).filter(Boolean) as string[]),
    )
      .filter((className) => !classItems.some((item) => item.name === className))
      .map((className) => ({
        id: `student-class-${className}`,
        name: className,
        subject_code: className,
      }));

    const ownClassNames = new Set(studentClasses.map((item) => item.name));
    visibleStudents.forEach((student) => {
      if (student.class_name) ownClassNames.add(student.class_name);
    });

    return [...classItems, ...studentClasses]
      .filter(
        (item) =>
          (!isStudent || ownClassNames.has(item.name)) &&
          (!isTeacher || classItems.some((classItem) => classItem.name === item.name)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

type TimetableClassOption = {
  id: string;
  name: string;
  subject_code: string;
};

const EMPTY_CLASS_OPTIONS: TimetableClassOption[] = [];

async function readRemoteClassesMin(
  isStudent = false,
  teacherUser?: SupabaseUser | null,
): Promise<TimetableClassOption[]> {
  const scope = teacherUser ? await findTeacherClassScope(teacherUser) : null;
  if (teacherUser && (!scope || scope.classIds.length === 0)) return [];

  let classQuery = supabase
    .from("classes")
    .select("id,name,subject_code")
    .order("name", { ascending: true });
  if (scope) classQuery = classQuery.in("id", scope.classIds);

  const [{ data: classRows, error: classError }, { data: studentRows, error: studentError }] =
    await Promise.all([
      classQuery,
      isStudent
        ? supabase.rpc("list_student_classmates")
        : supabase.from("students").select("class_name,major").not("class_name", "is", null),
    ]);

  if (classError) throw classError;
  if (studentError) throw studentError;

  const classItems = ((classRows ?? []) as TimetableClassOption[]).map((item) => ({
    id: item.id,
    name: item.name,
    subject_code: item.subject_code ?? "",
  }));
  const classNameKeys = new Set(classItems.map((item) => item.name.trim().toUpperCase()));
  const ownClassNames = new Set(
    (studentRows ?? [])
      .map((student) => student.class_name?.trim().toUpperCase())
      .filter((name): name is string => !!name),
  );

  const studentClasses = Array.from(
    new Map(
      (studentRows ?? [])
        .map((student) => ({
          name: student.class_name?.trim() ?? "",
          subject_code: student.major?.trim() ?? "",
        }))
        .filter((student) => student.name)
        .filter((student) => !classNameKeys.has(student.name.toUpperCase()))
        .map((student) => [
          student.name,
          {
            id: `student-class-${student.name}`,
            name: student.name,
            subject_code: student.subject_code,
          },
        ]),
    ).values(),
  );

  return [...classItems, ...studentClasses]
    .filter(
      (item) =>
        (!isStudent || ownClassNames.has(item.name.trim().toUpperCase())) &&
        (!teacherUser ||
          classItems.some(
            (classItem) => classItem.name.trim().toUpperCase() === item.name.trim().toUpperCase(),
          )),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

type TimetableTeacherOption = {
  id: string;
  staff_code?: string | null;
  full_name: string;
  full_name_en?: string | null;
  full_name_km?: string | null;
  phone: string | null;
};

const EMPTY_TEACHER_OPTIONS: TimetableTeacherOption[] = [];

function readDemoTeachersMin(): TimetableTeacherOption[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("studentsphere.demo.teachers");
    const teachers = raw
      ? (JSON.parse(raw) as Array<{ id: string; full_name: string; phone?: string | null }>)
      : [];
    return teachers.map((teacher) => ({
      id: teacher.id,
      full_name: teacher.full_name,
      phone: teacher.phone ?? null,
    }));
  } catch {
    return [];
  }
}

function timeOverlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

function slotLabel(className: string, day: (typeof days)[number], start: string, end: string) {
  return `${className} ${dayLabels[day]} ${start}-${end}`;
}

function sameScheduleList(first: ScheduleBuilderData[], second: ScheduleBuilderData[]) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function classKey(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").trim().toUpperCase();
}

function firstScheduleSubject(rows: ScheduleTimeRow[]) {
  for (const row of rows) {
    for (const day of days) {
      const cell = row.cells[day];
      const subject = cleanOptional(cell.subjectCode) || cleanOptional(cell.subject);
      if (subject) return subject;
    }
  }
  return null;
}

function singleScheduleTeacherId(rows: ScheduleTimeRow[]) {
  const teacherIds = new Set<string>();
  rows.forEach((row) => {
    days.forEach((day) => {
      const teacherId = cleanOptional(row.cells[day]?.teacherId);
      if (teacherId) teacherIds.add(teacherId);
    });
  });
  return teacherIds.size === 1 ? Array.from(teacherIds)[0] : null;
}

async function findOrCreateScheduleClass(schedule: ScheduleBuilderData, selectedClassId: string) {
  const incomingClassId =
    selectedClassId && !selectedClassId.startsWith("student-class-") ? selectedClassId : "";

  if (incomingClassId) {
    const { data, error } = await supabase
      .from("classes")
      .select("id,name")
      .eq("id", incomingClassId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const { data: allClasses, error: classError } = await supabase.from("classes").select("id,name");
  if (classError) throw classError;

  const existingClass =
    (allClasses ?? []).find((row) => classKey(row.name) === classKey(schedule.className)) ?? null;
  if (existingClass) return existingClass;

  const { data: createdClass, error: createClassError } = await supabase
    .from("classes")
    .insert({
      name: schedule.className,
      subject_code: firstScheduleSubject(schedule.rows) || schedule.className,
      capacity: 40,
    })
    .select("id,name")
    .single();
  if (createClassError) throw createClassError;
  return createdClass;
}

async function saveScheduleWithUserSession(schedule: ScheduleBuilderData, selectedClassId: string) {
  const classRow = await findOrCreateScheduleClass(schedule, selectedClassId);
  const classId = classRow.id;
  const classTeacherId = singleScheduleTeacherId(schedule.rows);
  if (classTeacherId) {
    const { error: assignTeacherError } = await supabase
      .from("classes")
      .update({ teacher_id: classTeacherId })
      .eq("id", classId);
    if (assignTeacherError) throw assignTeacherError;
  }

  const rows = schedule.rows.filter((row) => row.start && row.end && row.end > row.start);
  const slotRows = rows.flatMap((row) =>
    days.flatMap((day) => {
      const cell = row.cells[day];
      const hasContent =
        cleanOptional(cell.teacherId) ||
        cleanOptional(cell.teacher) ||
        cleanOptional(cell.subjectCode) ||
        cleanOptional(cell.subject) ||
        cleanOptional(cell.room);
      if (!hasContent) return [];

      return [
        {
          class_id: classId,
          day,
          start_time: row.start,
          end_time: row.end,
          room: cleanOptional(cell.room),
          teacher_id: cleanOptional(cell.teacherId),
          teacher_name: cleanOptional(cell.teacher),
          teacher_phone: cleanOptional(cell.teacherPhone),
          subject_code: cleanOptional(cell.subjectCode),
          subject_name: cleanOptional(cell.subject),
          schedule_title: cleanOptional(schedule.title),
          academic_year: cleanOptional(schedule.academicYear),
          issue_date: cleanOptional(schedule.issueDate),
          note: cleanOptional(schedule.note),
          left_office: cleanOptional(schedule.leftOffice),
          center_signature: cleanOptional(schedule.centerSignature),
          right_signature: cleanOptional(schedule.rightSignature),
        },
      ];
    }),
  );
  const legacySlotRows = rows.flatMap((row) =>
    days.flatMap((day) => {
      const cell = row.cells[day];
      const hasContent =
        cleanOptional(cell.teacherId) ||
        cleanOptional(cell.teacher) ||
        cleanOptional(cell.subjectCode) ||
        cleanOptional(cell.subject) ||
        cleanOptional(cell.room);
      if (!hasContent) return [];

      return [
        {
          class_id: classId,
          day,
          start_time: row.start,
          end_time: row.end,
          room: encodeTimetableCell({
            room: cleanOptional(cell.room),
            teacherId: cleanOptional(cell.teacherId),
            teacher: cleanOptional(cell.teacher),
            teacherPhone: cleanOptional(cell.teacherPhone),
            subjectCode: cleanOptional(cell.subjectCode),
            subject: cleanOptional(cell.subject),
            title: cleanOptional(schedule.title),
            academicYear: cleanOptional(schedule.academicYear),
            issueDate: cleanOptional(schedule.issueDate),
            note: cleanOptional(schedule.note),
            leftOffice: cleanOptional(schedule.leftOffice),
            centerSignature: cleanOptional(schedule.centerSignature),
            rightSignature: cleanOptional(schedule.rightSignature),
          }),
        },
      ];
    }),
  );

  if (slotRows.length === 0) throw new Error("Please fill at least one schedule cell.");

  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("class_id", classId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("timetable_slots").insert(slotRows as never);
  if (insertError) {
    if (insertError.message.includes("schema cache") || insertError.message.includes("column")) {
      const { error: legacyInsertError } = await supabase
        .from("timetable_slots")
        .insert(legacySlotRows as never);
      if (legacyInsertError) throw legacyInsertError;
      return { classId, className: schedule.className, count: legacySlotRows.length };
    }
    throw insertError;
  }

  return { classId, className: schedule.className, count: slotRows.length };
}

async function verifyScheduleRows(classId: string) {
  const { count, error } = await supabase
    .from("timetable_slots")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

function findScheduleConflict(draft: ScheduleBuilderData, savedSchedules: ScheduleBuilderData[]) {
  type FilledSlot = {
    scheduleId?: string;
    className: string;
    rowId: string;
    day: (typeof days)[number];
    start: string;
    end: string;
    teacherKey: string;
    teacherName: string;
    roomKey: string;
    room: string;
  };

  const collectSlots = (schedule: ScheduleBuilderData): FilledSlot[] =>
    schedule.rows.flatMap((row) =>
      days.flatMap((day) => {
        const cell = row.cells[day];
        const teacherKey = (cell.teacherId || cell.teacher).trim().toLowerCase();
        const roomKey = cell.room.trim().toLowerCase();
        if (!teacherKey && !roomKey) return [];
        return [
          {
            scheduleId: schedule.id,
            className: schedule.className.trim().toUpperCase(),
            rowId: row.id,
            day,
            start: row.start,
            end: row.end,
            teacherKey,
            teacherName: cell.teacher.trim(),
            roomKey,
            room: cell.room.trim(),
          },
        ];
      }),
    );

  const current = collectSlots(draft);
  const others = savedSchedules
    .filter((schedule) => schedule.id !== draft.id)
    .flatMap((schedule) => collectSlots(schedule));
  const allSlots = [...current, ...others];

  for (let index = 0; index < allSlots.length; index += 1) {
    const first = allSlots[index];
    if (first.end <= first.start) {
      return `Invalid time in ${slotLabel(first.className, first.day, first.start, first.end)}. End time must be after start time.`;
    }

    for (let compareIndex = index + 1; compareIndex < allSlots.length; compareIndex += 1) {
      const second = allSlots[compareIndex];
      if (first.day !== second.day) continue;
      if (!timeOverlaps(first.start, first.end, second.start, second.end)) continue;
      if (first.className === second.className && first.rowId === second.rowId) continue;

      if (first.teacherKey && first.teacherKey === second.teacherKey) {
        return `Teacher ${first.teacherName || second.teacherName} is busy: ${slotLabel(
          first.className,
          first.day,
          first.start,
          first.end,
        )} conflicts with ${slotLabel(second.className, second.day, second.start, second.end)}.`;
      }

      if (first.roomKey && first.roomKey === second.roomKey) {
        return `Room ${first.room || second.room} is busy: ${slotLabel(
          first.className,
          first.day,
          first.start,
          first.end,
        )} conflicts with ${slotLabel(second.className, second.day, second.start, second.end)}.`;
      }
    }
  }

  return null;
}

function TimetablePage() {
  const { t } = useI18n();
  const timetableSearch = Route.useSearch();
  const { user, primaryRole, isDemo, session } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [scheduleBuilder, setScheduleBuilder] = useState<ScheduleBuilderData>(() =>
    createDefaultScheduleBuilder(),
  );
  const [manualSchedules, setManualSchedules] = useState<ScheduleBuilderData[]>([]);
  const [selectedManualScheduleId, setSelectedManualScheduleId] = useState("");
  const [scheduleAudience, setScheduleAudience] = useState<"student" | "teacher">(() =>
    timetableSearch.teacherId || primaryRole === "teacher" ? "teacher" : "student",
  );
  const [adminTeacherScheduleId, setAdminTeacherScheduleId] = useState(
    () => timetableSearch.teacherId ?? "",
  );
  const [scheduleAlert, setScheduleAlert] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ open: false, type: "success", title: "", message: "" });
  const isAdmin = primaryRole === "admin";
  const isStudent = primaryRole === "student";
  const isTeacher = primaryRole === "teacher";

  useEffect(() => {
    if (isAdmin && timetableSearch.teacherId) {
      setScheduleAudience("teacher");
      setAdminTeacherScheduleId(timetableSearch.teacherId);
    }
  }, [isAdmin, timetableSearch.teacherId]);

  const { data: teacherOptions = EMPTY_TEACHER_OPTIONS } = useQuery({
    queryKey: ["teachers-min-timetable-builder", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoTeachersMin();

      const { data, error } = await supabase
        .from("teachers")
        .select("id,staff_code,full_name,full_name_en,full_name_km,phone")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimetableTeacherOption[];
    },
  });

  const selectedAdminTeacher = adminTeacherScheduleId
    ? (teacherOptions.find((teacher) => teacher.id === adminTeacherScheduleId) ?? null)
    : null;

  const { data: classOptions = EMPTY_CLASS_OPTIONS } = useQuery({
    queryKey: ["classes-min-timetable-builder", primaryRole, user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoClassesMin(isStudent, isTeacher);
      return readRemoteClassesMin(isStudent, isTeacher ? user : undefined);
    },
  });

  const { data: teacherScope = null } = useQuery({
    queryKey: ["teacher-timetable-scope", user?.id, isDemo ? "demo" : "remote"],
    queryFn: async () => findTeacherClassScope(user),
    enabled: !isDemo && isTeacher && !!user?.id,
  });

  const {
    data: remoteSchedules = EMPTY_SCHEDULES,
    isLoading: schedulesLoading,
    isError: schedulesError,
    error: schedulesLoadError,
  } = useQuery({
    queryKey: [
      "manual-schedules",
      primaryRole,
      isDemo ? "demo" : "remote",
      classOptions,
      teacherScope?.teacher?.id,
    ],
    queryFn: async () => {
      if (isDemo) {
        const schedules = readManualSchedules();
        if (!isStudent && !isTeacher) return schedules;

        const classNames = new Set(
          classOptions.map((item) => item.name.trim().toUpperCase()).filter(Boolean),
        );
        const scopedSchedules = schedules.filter((schedule) =>
          classNames.has(schedule.className.trim().toUpperCase()),
        );
        if (!isTeacher) return scopedSchedules;

        const teacher = readDemoTeachersMin()[0] as CurrentTeacher | undefined;
        return scopedSchedules
          .map((schedule) => scheduleForTeacher(schedule, teacher))
          .filter((schedule): schedule is ScheduleBuilderData => !!schedule);
      }

      let { data, error } = await supabase
        .from("timetable_slots")
        .select(
          "id,class_id,day,start_time,end_time,room,teacher_id,teacher_name,teacher_phone,subject_code,subject_name,schedule_title,academic_year,issue_date,note,left_office,center_signature,right_signature,classes(name,subject_code)",
        )
        .order("start_time", { ascending: true });
      if (
        error &&
        (error.message.includes("schema cache") ||
          error.message.includes("column") ||
          error.message.includes("Could not find"))
      ) {
        const fallback = await supabase
          .from("timetable_slots")
          .select("id,class_id,day,start_time,end_time,room,classes(name,subject_code)")
          .order("start_time", { ascending: true });
        data = fallback.data as typeof data;
        error = fallback.error;
      }
      if (error) throw error;

      const allSlots = (data ?? []) as unknown as TimetableScheduleSlot[];
      if (!isStudent && !isTeacher) return slotsToSchedules(allSlots);

      if (isTeacher) {
        const classIds = new Set(teacherScope?.classIds ?? []);
        const classNames = new Set(
          (teacherScope?.classNames ?? []).map(normalizeScheduleClass).filter(Boolean),
        );
        const scopedClassesById = new Map(
          (teacherScope?.classes ?? []).map((classRow) => [classRow.id, classRow]),
        );
        const teacherSlots = allSlots
          .filter(
            (slot) =>
              classIds.has(slot.class_id) ||
              classNames.has(normalizeScheduleClass(slot.classes?.name)) ||
              slotMatchesTeacher(slot, teacherScope?.teacher),
          )
          .map((slot) => {
            if (slot.classes?.name) return slot;
            const scopedClass = scopedClassesById.get(slot.class_id);
            if (!scopedClass) return slot;
            return {
              ...slot,
              classes: {
                name: scopedClass.name,
                subject_code: scopedClass.subject_code,
              },
            };
          });
        return slotsToSchedules(teacherSlots);
      }

      const classNames = new Set(
        classOptions.map((item) => item.name.trim().toUpperCase()).filter(Boolean),
      );
      return slotsToSchedules(
        allSlots.filter((slot) => classNames.has((slot.classes?.name ?? "").trim().toUpperCase())),
      );
    },
    enabled:
      isDemo ||
      (!isStudent && !isTeacher) ||
      (isStudent && classOptions.length > 0) ||
      (isTeacher && !!teacherScope?.teacher),
  });

  useEffect(() => {
    if (isDemo || schedulesLoading || schedulesError) return;
    setManualSchedules((current) =>
      sameScheduleList(current, remoteSchedules) ? current : remoteSchedules,
    );
  }, [isDemo, remoteSchedules, schedulesLoading, schedulesError]);

  const isTeacherScheduleView =
    scheduleAudience === "teacher" && (isTeacher || (isAdmin && !!selectedAdminTeacher));
  const visibleSchedules = useMemo(() => {
    if (scheduleAudience !== "teacher") return manualSchedules;
    if (isTeacher) {
      return combineTeacherSchedules(
        manualSchedules,
        teacherScope?.teacher,
        teacherScope?.classIds,
        teacherScope?.classNames,
      );
    }
    if (isAdmin && selectedAdminTeacher) {
      return combineTeacherSchedules(manualSchedules, selectedAdminTeacher);
    }
    return [];
  }, [
    isAdmin,
    isTeacher,
    manualSchedules,
    selectedAdminTeacher,
    teacherScope?.teacher,
    teacherScope?.classIds,
    teacherScope?.classNames,
    scheduleAudience,
  ]);
  const selectedManualSchedule =
    visibleSchedules.find((schedule) => schedule.id === selectedManualScheduleId) ??
    visibleSchedules[0] ??
    null;
  const selectedFullSchedule = isTeacherScheduleView
    ? null
    : (manualSchedules.find((schedule) => schedule.id === selectedManualSchedule?.id) ?? null);

  useEffect(() => {
    if (visibleSchedules.length === 0) {
      if (selectedManualScheduleId) setSelectedManualScheduleId("");
      return;
    }

    if (!visibleSchedules.some((schedule) => schedule.id === selectedManualScheduleId)) {
      setSelectedManualScheduleId(visibleSchedules[0]?.id ?? "");
    }
  }, [visibleSchedules, selectedManualScheduleId]);

  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["subject-options", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return mergeSubjectOptions(subjectRowsToOptions(readDemoSubjects()));

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
      return mergeSubjectOptions(options);
    },
  });
  const subjectOptionGroups = useMemo(
    () => groupSubjectOptionsByMajor(subjectOptions),
    [subjectOptions],
  );

  const updateBuilderCell = (
    rowId: string,
    day: (typeof days)[number],
    field: keyof ScheduleCell,
    value: string,
  ) => {
    setScheduleBuilder((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [day]: {
                  ...row.cells[day],
                  [field]: value,
                },
              },
            }
          : row,
      ),
    }));
  };

  const setBuilderTeacher = (rowId: string, day: (typeof days)[number], teacherId: string) => {
    const teacher = teacherOptions.find((item) => item.id === teacherId);
    setScheduleBuilder((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [day]: {
                  ...row.cells[day],
                  teacherId,
                  teacher: teacher?.full_name ?? "",
                  teacherPhone: teacher?.phone ?? "",
                },
              },
            }
          : row,
      ),
    }));
  };

  const setBuilderSubject = (rowId: string, day: (typeof days)[number], subjectCode: string) => {
    const subject = subjectOptions.find((item) => item.code === subjectCode);
    setScheduleBuilder((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [day]: {
                  ...row.cells[day],
                  subjectCode,
                  subject: subject?.label ?? "",
                },
              },
            }
          : row,
      ),
    }));
  };

  const updateBuilderRow = (rowId: string, field: "start" | "end", value: string) => {
    setScheduleBuilder((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
  };

  const selectedBuilderClassId =
    scheduleBuilder.classId ||
    classOptions.find(
      (item) => item.name.trim().toUpperCase() === scheduleBuilder.className.trim().toUpperCase(),
    )?.id ||
    "";

  const setBuilderClass = (classId: string) => {
    const selectedClass = classOptions.find((item) => item.id === classId);
    setScheduleBuilder((current) => ({
      ...current,
      classId,
      className: selectedClass?.name ?? "",
      title: selectedClass?.name ? `កាលវិភាគសិក្សា ${selectedClass.name}` : current.title,
    }));
  };

  const createManualSchedule = async () => {
    if (!isAdmin) {
      toast.error(t("admins_create_schedules"));
      return;
    }
    if (!scheduleBuilder.className.trim()) {
      toast.error(t("class_required"));
      return;
    }
    if (!isDemo && !session?.access_token) {
      toast.error(t("admin_session_expired_login"));
      return;
    }
    const conflict = findScheduleConflict(scheduleBuilder, manualSchedules);
    if (conflict) {
      toast.error(conflict);
      return;
    }

    const schedule: ScheduleBuilderData = {
      ...scheduleBuilder,
      id: scheduleBuilder.id ?? `manual-schedule-${Date.now()}`,
      classId: selectedBuilderClassId,
      className: scheduleBuilder.className.trim().toUpperCase(),
    };

    if (!isDemo) {
      try {
        let saved: { classId: string; className: string; count: number };
        try {
          saved = await saveClassSchedule({
            data: {
              accessToken: session?.access_token ?? "",
              classId: selectedBuilderClassId,
              className: schedule.className,
              title: schedule.title,
              academicYear: schedule.academicYear,
              issueDate: schedule.issueDate,
              note: schedule.note,
              leftOffice: schedule.leftOffice,
              centerSignature: schedule.centerSignature,
              rightSignature: schedule.rightSignature,
              rows: schedule.rows,
            },
          });
          const persisted = await verifyScheduleRows(saved.classId);
          if (!persisted) {
            saved = await saveScheduleWithUserSession(schedule, selectedBuilderClassId);
          }
        } catch {
          saved = await saveScheduleWithUserSession(schedule, selectedBuilderClassId);
        }
        const savedSchedule = {
          ...schedule,
          id: `remote-schedule-${saved.classId}`,
          classId: saved.classId,
        };
        const next = [
          savedSchedule,
          ...manualSchedules.filter(
            (item) =>
              item.id !== savedSchedule.id &&
              item.className.toUpperCase() !== savedSchedule.className.toUpperCase(),
          ),
        ];
        setManualSchedules(next);
        setScheduleBuilder(savedSchedule);
        setAdminTeacherScheduleId("");
        setSelectedManualScheduleId(savedSchedule.id ?? "");
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["manual-schedules"] }),
          qc.invalidateQueries({ queryKey: ["timetable"] }),
          qc.invalidateQueries({ queryKey: ["student-dashboard"] }),
          qc.invalidateQueries({ queryKey: ["teacher-dashboard"] }),
        ]);
        setScheduleAlert({
          open: true,
          type: "success",
          title: t("schedule_saved"),
          message: t("schedule_saved_for", { className: savedSchedule.className }),
        });
      } catch (error) {
        setScheduleAlert({
          open: true,
          type: "error",
          title: t("could_not_save_schedule"),
          message: error instanceof Error ? error.message : t("could_not_save_schedule"),
        });
      }
      return;
    }

    const next = [
      schedule,
      ...manualSchedules.filter(
        (item) =>
          item.id !== schedule.id &&
          item.className.toUpperCase() !== schedule.className.toUpperCase(),
      ),
    ];
    setManualSchedules(next);
    writeManualSchedules(next);
    setScheduleBuilder(schedule);
    setSelectedManualScheduleId(schedule.id ?? "");
    setScheduleAlert({
      open: true,
      type: "success",
      title: t("schedule_saved"),
      message: t("schedule_saved_for", { className: schedule.className }),
    });
  };

  return (
    <div>
      <PageHeader
        title={t("timetable")}
        subtitle={t("timetable_subtitle")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("add_time_shift_title")}
            </button>
          )
        }
      />
      {isAdmin && (
        <SectionCard
          title={t("create_printable_schedule")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={createManualSchedule}
                disabled={!scheduleBuilder.className.trim() || scheduleBuilder.rows.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {t("create_schedule")}
              </button>
              <button
                onClick={() => {
                  const conflict = findScheduleConflict(scheduleBuilder, manualSchedules);
                  if (conflict) {
                    toast.error(conflict);
                    return;
                  }
                  printDocument(
                    `Schedule - ${scheduleBuilder.className}`,
                    manualScheduleReportHtml(scheduleBuilder),
                  );
                }}
                disabled={!scheduleBuilder.className.trim() || scheduleBuilder.rows.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> {t("print_preview")}
              </button>
            </div>
          }
          className="mb-5"
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label={t("class")}>
              {classOptions.length > 0 ? (
                <select
                  value={selectedBuilderClassId}
                  onChange={(event) => setBuilderClass(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">{t("select_created_class")}</option>
                  {classOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.subject_code ? ` (${item.subject_code})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={scheduleBuilder.className}
                  onChange={(event) =>
                    setScheduleBuilder({
                      ...scheduleBuilder,
                      className: event.target.value.toUpperCase(),
                    })
                  }
                  placeholder={t("create_class_first")}
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
              )}
            </Field>
            <Field label={t("schedule_title")}>
              <input
                value={scheduleBuilder.title}
                onChange={(event) =>
                  setScheduleBuilder({ ...scheduleBuilder, title: event.target.value })
                }
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label={t("academic_year")}>
              <input
                value={scheduleBuilder.academicYear}
                onChange={(event) =>
                  setScheduleBuilder({ ...scheduleBuilder, academicYear: event.target.value })
                }
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label={t("issue_date")}>
              <input
                type="date"
                value={scheduleBuilder.issueDate}
                onChange={(event) =>
                  setScheduleBuilder({ ...scheduleBuilder, issueDate: event.target.value })
                }
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Field label={t("left_header")}>
              <textarea
                value={scheduleBuilder.leftOffice}
                onChange={(event) =>
                  setScheduleBuilder({ ...scheduleBuilder, leftOffice: event.target.value })
                }
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label={t("footer_note")}>
              <textarea
                value={scheduleBuilder.note}
                onChange={(event) =>
                  setScheduleBuilder({ ...scheduleBuilder, note: event.target.value })
                }
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <div className="grid gap-3">
              <Field label={t("center_signature")}>
                <input
                  value={scheduleBuilder.centerSignature}
                  onChange={(event) =>
                    setScheduleBuilder({ ...scheduleBuilder, centerSignature: event.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label={t("right_signature")}>
                <input
                  value={scheduleBuilder.rightSignature}
                  onChange={(event) =>
                    setScheduleBuilder({ ...scheduleBuilder, rightSignature: event.target.value })
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[1180px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-36 px-3 py-3">{t("time")}</th>
                  {days.map((day) => (
                    <th key={day} className="px-3 py-3 text-center">
                      {dayLabels[day]}
                    </th>
                  ))}
                  <th className="w-14 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {scheduleBuilder.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="px-3 py-3">
                      <div className="grid gap-2">
                        <input
                          type="time"
                          value={row.start}
                          onChange={(event) =>
                            updateBuilderRow(row.id, "start", event.target.value)
                          }
                          className="h-9 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                        />
                        <input
                          type="time"
                          value={row.end}
                          onChange={(event) => updateBuilderRow(row.id, "end", event.target.value)}
                          className="h-9 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                        />
                      </div>
                    </td>
                    {days.map((day) => (
                      <td key={`${row.id}-${day}`} className="px-2 py-3">
                        <div className="grid gap-1.5">
                          <select
                            value={row.cells[day].teacherId || ""}
                            onChange={(event) => setBuilderTeacher(row.id, day, event.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                          >
                            <option value="">{t("select_teacher")}</option>
                            {teacherOptions.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.full_name}
                                {teacher.phone ? ` · ${teacher.phone}` : ""}
                              </option>
                            ))}
                          </select>
                          <input
                            value={row.cells[day].teacherPhone}
                            onChange={(event) =>
                              updateBuilderCell(row.id, day, "teacherPhone", event.target.value)
                            }
                            placeholder={t("teacher_phone")}
                            className="h-8 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                          />
                          <select
                            value={row.cells[day].subjectCode || ""}
                            onChange={(event) => setBuilderSubject(row.id, day, event.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                          >
                            <option value="">{t("select_created_subject")}</option>
                            {subjectOptionGroups.map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.options.map((subject) => (
                                  <option key={subject.code} value={subject.code}>
                                    {subject.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <input
                            value={row.cells[day].room}
                            onChange={(event) =>
                              updateBuilderCell(row.id, day, "room", event.target.value)
                            }
                            placeholder={t("room")}
                            className="h-8 rounded-lg border border-border bg-background px-2 outline-none focus:border-primary"
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() =>
                          setScheduleBuilder((current) => ({
                            ...current,
                            rows: current.rows.filter((item) => item.id !== row.id),
                          }))
                        }
                        disabled={scheduleBuilder.rows.length === 1}
                        className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              setScheduleBuilder((current) => ({
                ...current,
                rows: [
                  ...current.rows,
                  createScheduleRow(
                    `row-${Date.now()}`,
                    current.rows.at(-1)?.end ?? "12:00",
                    "12:00",
                  ),
                ],
              }))
            }
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> {t("add_time_row")}
          </button>
        </SectionCard>
      )}
      <SectionCard
        title={
          selectedManualSchedule
            ? isTeacherScheduleView
              ? `កាលវិភាគគ្រូ ${selectedManualSchedule.className}`
              : `កាលវិភាគ ${selectedManualSchedule.className}`
            : "កាលវិភាគ"
        }
        action={
          <button
            onClick={() => {
              if (!selectedManualSchedule) return;
              const conflict = findScheduleConflict(selectedManualSchedule, manualSchedules);
              if (conflict) {
                toast.error(conflict);
                return;
              }
              printDocument(
                `Schedule - ${selectedManualSchedule.className}`,
                manualScheduleReportHtml(selectedManualSchedule, isTeacherScheduleView),
              );
            }}
            disabled={!selectedManualSchedule}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> {t("print_schedule")}
          </button>
        }
        className="mb-5"
      >
        {(isAdmin || isTeacher) && (
          <div className="mb-5 grid gap-3 md:max-w-3xl md:grid-cols-2">
            <Field label={t("schedule_type")}>
              <div className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleAudience("student");
                    setAdminTeacherScheduleId("");
                  }}
                  className={
                    "h-9 rounded-lg px-3 text-sm font-semibold transition " +
                    (scheduleAudience === "student"
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted")
                  }
                >
                  {t("student_schedule")}
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleAudience("teacher")}
                  className={
                    "h-9 rounded-lg px-3 text-sm font-semibold transition " +
                    (scheduleAudience === "teacher"
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted")
                  }
                >
                  {t("teacher_schedule")}
                </button>
              </div>
            </Field>

            {isAdmin && scheduleAudience === "teacher" && (
              <Field label={t("select_teacher")}>
                <select
                  value={adminTeacherScheduleId}
                  onChange={(event) => setAdminTeacherScheduleId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">{t("select_teacher")}</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                      {teacher.staff_code ? ` (${teacher.staff_code})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {isAdmin && selectedManualSchedule && !isTeacherScheduleView && (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <button
              onClick={() =>
                (selectedFullSchedule || selectedManualSchedule) &&
                setScheduleBuilder(selectedFullSchedule || selectedManualSchedule)
              }
              disabled={!selectedManualSchedule}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("edit_latest")}
            </button>
            <button
              onClick={async () => {
                if (!selectedManualSchedule) return;
                if (!isDemo && !session?.access_token) {
                  toast.error(t("admin_session_expired_login"));
                  return;
                }
                const scheduleToDelete = selectedFullSchedule || selectedManualSchedule;
                if (!isDemo && scheduleToDelete.classId) {
                  try {
                    await deleteClassSchedule({
                      data: {
                        accessToken: session?.access_token ?? "",
                        classId: scheduleToDelete.classId,
                        className: scheduleToDelete.className,
                      },
                    });
                    await Promise.all([
                      qc.invalidateQueries({ queryKey: ["manual-schedules"] }),
                      qc.invalidateQueries({ queryKey: ["timetable"] }),
                      qc.invalidateQueries({ queryKey: ["student-dashboard"] }),
                      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] }),
                    ]);
                    setSelectedManualScheduleId("");
                    toast.success(t("schedule_deleted"));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : t("could_not_delete"));
                  }
                  return;
                }
                const next = manualSchedules.filter(
                  (schedule) => schedule.id !== scheduleToDelete.id,
                );
                setManualSchedules(next);
                writeManualSchedules(next);
                setSelectedManualScheduleId(next[0]?.id ?? "");
                toast.success(t("schedule_deleted"));
              }}
              disabled={!selectedManualSchedule}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("delete_latest")}
            </button>
          </div>
        )}

        {visibleSchedules.length > 1 && !isTeacherScheduleView && (
          <div className="mb-5 grid gap-3 md:max-w-3xl md:grid-cols-2">
            <Field label={t("class_schedule")}>
              <select
                value={selectedManualSchedule?.id ?? ""}
                onChange={(event) => setSelectedManualScheduleId(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              >
                {visibleSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.className}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {schedulesLoading ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("loading_saved_schedules")}
          </p>
        ) : schedulesError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
            {t("could_not_load_saved_schedules")}{" "}
            {schedulesLoadError instanceof Error ? schedulesLoadError.message : t("unknown_error")}
          </div>
        ) : !selectedManualSchedule ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {isTeacherScheduleView
              ? t("no_teacher_schedule")
              : isAdmin
                ? t("no_schedule_create_first")
                : t("no_schedule_published")}
          </p>
        ) : (
          <ManualSchedulePaper
            schedule={selectedManualSchedule}
            showClassInCells={isTeacherScheduleView}
          />
        )}
      </SectionCard>
      {showAdd && (
        <AddTimeShift
          isDemo={isDemo}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["timetable", isDemo ? "demo" : "remote"] });
            qc.invalidateQueries({ queryKey: ["manual-schedules"] });
          }}
        />
      )}
      <Dialog
        open={scheduleAlert.open}
        onOpenChange={(open) => setScheduleAlert((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-sm rounded-2xl text-center">
          <DialogHeader>
            <div
              className={
                "mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full text-2xl font-bold " +
                (scheduleAlert.type === "success"
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive")
              }
            >
              {scheduleAlert.type === "success" ? "✓" : "!"}
            </div>
            <DialogTitle className="text-center font-display text-xl">
              {scheduleAlert.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{scheduleAlert.message}</p>
          <button
            type="button"
            onClick={() => setScheduleAlert((current) => ({ ...current, open: false }))}
            className="mt-3 h-10 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            OK
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddTimeShift({
  isDemo,
  onClose,
  onCreated,
}: {
  isDemo: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    class_id: "",
    day: "mon",
    shift: "morning",
    start_time: "07:00",
    end_time: "11:00",
    room: "",
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-min-timetable", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoClassesMin();
      return readRemoteClassesMin();
    },
  });

  const createSlot = useMutation({
    mutationFn: async () => {
      if (!form.class_id) throw new Error(t("class_required"));
      if (form.end_time <= form.start_time) throw new Error(t("end_after_start"));

      if (isDemo) {
        const classRow = classes.find((item) => item.id === form.class_id);
        writeDemoTimetable([
          {
            id: `demo-slot-${Date.now()}`,
            class_id: form.class_id,
            day: form.day,
            shift: form.shift,
            start_time: form.start_time,
            end_time: form.end_time,
            room: form.room || null,
            classes: classRow ? { name: classRow.name, subject_code: classRow.subject_code } : null,
          } as TimetableSlot,
          ...readDemoTimetable(),
        ]);
        return;
      }

      const { error } = await supabase.from("timetable_slots").insert({
        class_id: form.class_id,
        day: form.day as "mon" | "tue" | "wed" | "thu" | "fri" | "sat",
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      onCreated();
      toast.success(isDemo ? t("demo_time_shift_added") : t("time_shift_added"));
      onClose();
    },
    onError: (error) => toast.error(error.message),
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
          <h3 className="font-display text-lg font-bold">{t("add_time_shift_title")}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSlot.mutate();
          }}
          className="space-y-3"
        >
          <Field label={`${t("class")} *`}>
            <select
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">{t("select_class")}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.subject_code ? `(${item.subject_code})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`${t("day")} *`}>
            <select
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              {days.map((day) => (
                <option key={day} value={day}>
                  {day.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`${t("time_shift")} *`}>
            <div className="grid grid-cols-2 gap-2">
              {shiftOptions.map((shift) => (
                <button
                  key={shift.value}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      shift: shift.value,
                      start_time: shift.start || form.start_time,
                      end_time: shift.end || form.end_time,
                    })
                  }
                  className={
                    "rounded-xl border px-3 py-2 text-left text-xs transition-colors " +
                    (form.shift === shift.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface hover:bg-muted")
                  }
                >
                  <span className="block font-semibold">{shift.label}</span>
                  <span className="text-[10px] text-muted-foreground">{shift.time}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("start_time")} *`}>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, shift: "custom", start_time: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label={`${t("end_time")} *`}>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, shift: "custom", end_time: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>

          <Field label={t("room")}>
            <input
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder={t("room")}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>

          <button
            type="submit"
            disabled={createSlot.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {createSlot.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("save_time_shift")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ManualSchedulePaper({
  schedule,
  showClassInCells = false,
}: {
  schedule: ScheduleBuilderData;
  showClassInCells?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white p-4">
      <div className="min-w-[980px] text-[11px] text-slate-600">
        <div className="mb-2 grid grid-cols-[1fr_1.8fr_1fr] items-start gap-5">
          <div className="pt-5 text-center leading-8 whitespace-pre-line">
            {schedule.leftOffice}
          </div>
          <div className="text-center leading-6 text-slate-700">
            <h2 className="m-0 text-sm font-bold">ព្រះរាជាណាចក្រកម្ពុជា</h2>
            <h3 className="m-0 text-[13px] font-bold">ជាតិ សាសនា ព្រះមហាក្សត្រ</h3>
            <p className="m-0">---------</p>
            <h3 className="mt-1 text-sm font-bold">{schedule.title}</h3>
            <h2 className="text-sm font-bold">{schedule.className}</h2>
            <p>ឆ្នាំសិក្សា {schedule.academicYear}</p>
            <p>កាលបរិច្ឆេទចេញផ្សាយ {schedule.issueDate}</p>
          </div>
          <div />
        </div>

        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {days.map((day) => (
                <th
                  key={day}
                  className="border border-slate-500 bg-slate-50 px-2 py-1 text-center font-bold text-slate-900"
                >
                  {dayLabels[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row) => (
              <tr key={row.id}>
                {days.map((day) => {
                  const cell = row.cells[day];
                  return (
                    <td
                      key={`${row.id}-${day}`}
                      className="h-24 border border-slate-500 p-0 text-center align-top"
                    >
                      <div className="border-b border-slate-300 px-2 py-1 font-mono text-[9px] text-slate-500">
                        {row.start}-{row.end}
                      </div>
                      {(cell.teacher ||
                        cell.teacherPhone ||
                        cell.subject ||
                        cell.room ||
                        (showClassInCells && cell.className)) && (
                        <div className="px-2 py-2 leading-5">
                          {cell.teacher && (
                            <p className="font-bold text-slate-900">{cell.teacher}</p>
                          )}
                          {cell.teacherPhone && (
                            <p className="font-mono text-[10px] text-slate-500">
                              {cell.teacherPhone}
                            </p>
                          )}
                          {cell.subject && <p className="font-semibold">{cell.subject}</p>}
                          {cell.room && <p>{cell.room}</p>}
                          {showClassInCells && cell.className && (
                            <p className="font-semibold text-slate-900">{cell.className}</p>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 grid grid-cols-[1.1fr_0.9fr_1.1fr] gap-4 leading-7">
          <div className="whitespace-pre-line">{schedule.note}</div>
          <div className="text-center">
            បានឃើញ និងឯកភាព
            <div className="font-bold text-slate-900">{schedule.centerSignature}</div>
          </div>
          <div className="text-center">
            រាជធានីភ្នំពេញ ថ្ងៃទី {schedule.issueDate}
            <div>ការិយាល័យសិក្សា</div>
            <div className="font-bold text-slate-900">{schedule.rightSignature}</div>
          </div>
        </div>
      </div>
    </div>
  );
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
