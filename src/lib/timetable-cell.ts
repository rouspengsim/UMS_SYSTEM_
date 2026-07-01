export const TIMETABLE_CELL_PREFIX = "__STUDENTSPHERE_TIMETABLE_CELL__:";

export type TimetableCellPayload = {
  room?: string | null;
  teacherId?: string | null;
  teacher?: string | null;
  teacherPhone?: string | null;
  subjectCode?: string | null;
  subject?: string | null;
  title?: string | null;
  academicYear?: string | null;
  issueDate?: string | null;
  note?: string | null;
  leftOffice?: string | null;
  centerSignature?: string | null;
  rightSignature?: string | null;
};

export function encodeTimetableCell(payload: TimetableCellPayload) {
  return `${TIMETABLE_CELL_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeTimetableCell(room: string | null | undefined): TimetableCellPayload {
  const value = room ?? "";
  const trimmedValue = value.trimStart();
  if (!trimmedValue.startsWith(TIMETABLE_CELL_PREFIX)) return { room: value };
  try {
    const payload = JSON.parse(
      trimmedValue.slice(TIMETABLE_CELL_PREFIX.length),
    ) as TimetableCellPayload;
    return { ...payload, room: payload.room ?? "" };
  } catch {
    return { room: "" };
  }
}
