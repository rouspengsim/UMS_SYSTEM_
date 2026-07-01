import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encodeTimetableCell } from "@/lib/timetable-cell";

const days = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Weekday = (typeof days)[number];

type ScheduleCellInput = {
  teacherId?: string;
  teacher?: string;
  teacherPhone?: string;
  subjectCode?: string;
  subject?: string;
  room?: string;
};

type ScheduleRowInput = {
  id: string;
  start: string;
  end: string;
  cells: Record<Weekday, ScheduleCellInput>;
};

type SaveScheduleInput = {
  accessToken: string;
  classId?: string;
  className: string;
  title: string;
  academicYear: string;
  issueDate: string;
  note: string;
  leftOffice: string;
  centerSignature: string;
  rightSignature: string;
  rows: ScheduleRowInput[];
};

type DeleteScheduleInput = {
  accessToken: string;
  classId?: string;
  className?: string;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

async function requireAdmin(accessToken: string) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    throw new Error("Your admin session expired. Please log in again.");
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role) throw new Error("Only admins can manage schedules.");
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function classKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function firstScheduleSubject(rows: ScheduleRowInput[]) {
  for (const row of rows ?? []) {
    for (const day of days) {
      const cell = row.cells?.[day];
      const subject = cleanOptional(cell?.subjectCode) || cleanOptional(cell?.subject);
      if (subject) return subject;
    }
  }
  return null;
}

function singleScheduleTeacherId(rows: ScheduleRowInput[]) {
  const teacherIds = new Set<string>();
  rows.forEach((row) => {
    days.forEach((day) => {
      const teacherId = cleanOptional(row.cells?.[day]?.teacherId);
      if (teacherId) teacherIds.add(teacherId);
    });
  });
  return teacherIds.size === 1 ? Array.from(teacherIds)[0] : null;
}

export const saveClassSchedule = createServerFn({ method: "POST" })
  .inputValidator((input: SaveScheduleInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const className = requireString(data.className, "Class name").toUpperCase();
    const rows = (data.rows ?? []).filter((row) => row.start && row.end && row.end > row.start);
    if (rows.length === 0) throw new Error("Please add at least one valid time row.");

    await requireAdmin(accessToken);

    const incomingClassId =
      typeof data.classId === "string" && data.classId.trim() && !data.classId.startsWith("student-class-")
        ? data.classId.trim()
        : "";

    let classRow: { id: string; name: string } | null = null;
    if (incomingClassId) {
      const { data: byId, error: byIdError } = await supabaseAdmin
        .from("classes")
        .select("id,name")
        .eq("id", incomingClassId)
        .maybeSingle();
      if (byIdError) throw byIdError;
      classRow = byId;
    }

    if (!classRow) {
      const { data: allClasses, error: classError } = await supabaseAdmin
        .from("classes")
        .select("id,name");
      if (classError) throw classError;
      classRow =
        (allClasses ?? []).find((row) => classKey(row.name) === classKey(className)) ?? null;
    }

    if (!classRow) {
      const { data: createdClass, error: createClassError } = await supabaseAdmin
        .from("classes")
        .insert({
          name: className,
          subject_code: firstScheduleSubject(rows) || className,
          capacity: 40,
        })
        .select("id,name")
        .single();
      if (createClassError) throw createClassError;
      classRow = createdClass;
    }

    const classId = classRow.id;
    const classTeacherId = singleScheduleTeacherId(rows);
    if (classTeacherId) {
      const { error: assignTeacherError } = await supabaseAdmin
        .from("classes")
        .update({ teacher_id: classTeacherId })
        .eq("id", classId);
      if (assignTeacherError) throw assignTeacherError;
    }

    const slotRows = rows.flatMap((row) =>
      days.flatMap((day) => {
        const cell = row.cells?.[day];
        if (!cell) return [];
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
            schedule_title: cleanOptional(data.title),
            academic_year: cleanOptional(data.academicYear),
            issue_date: cleanOptional(data.issueDate),
            note: cleanOptional(data.note),
            left_office: cleanOptional(data.leftOffice),
            center_signature: cleanOptional(data.centerSignature),
            right_signature: cleanOptional(data.rightSignature),
          },
        ];
      }),
    );
    const legacySlotRows = rows.flatMap((row) =>
      days.flatMap((day) => {
        const cell = row.cells?.[day];
        if (!cell) return [];
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
              title: cleanOptional(data.title),
              academicYear: cleanOptional(data.academicYear),
              issueDate: cleanOptional(data.issueDate),
              note: cleanOptional(data.note),
              leftOffice: cleanOptional(data.leftOffice),
              centerSignature: cleanOptional(data.centerSignature),
              rightSignature: cleanOptional(data.rightSignature),
            }),
          },
        ];
      }),
    );

    if (slotRows.length === 0) throw new Error("Please fill at least one schedule cell.");

    const { error: deleteError } = await supabaseAdmin
      .from("timetable_slots")
      .delete()
      .eq("class_id", classId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabaseAdmin.from("timetable_slots").insert(slotRows as never);
    if (insertError) {
      if (insertError.message.includes("schema cache") || insertError.message.includes("column")) {
        const { error: legacyInsertError } = await supabaseAdmin
          .from("timetable_slots")
          .insert(legacySlotRows as never);
        if (legacyInsertError) throw legacyInsertError;
        return { classId, className, count: legacySlotRows.length, legacy: true };
      }
      throw insertError;
    }

    return { classId, className, count: slotRows.length };
  });

export const deleteClassSchedule = createServerFn({ method: "POST" })
  .inputValidator((input: DeleteScheduleInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");

    await requireAdmin(accessToken);

    let classId =
      typeof data.classId === "string" && data.classId.trim() && !data.classId.startsWith("student-class-")
        ? data.classId.trim()
        : "";
    const className =
      typeof data.className === "string" && data.className.trim()
        ? data.className.trim().toUpperCase()
        : "";

    if (!classId && className) {
      const { data: allClasses, error: classError } = await supabaseAdmin
        .from("classes")
        .select("id,name");
      if (classError) throw classError;
      classId =
        (allClasses ?? []).find((row) => classKey(row.name) === classKey(className))?.id ?? "";
    }

    if (!classId) throw new Error("Class is required.");

    const { error } = await supabaseAdmin.from("timetable_slots").delete().eq("class_id", classId);
    if (error) throw error;

    return { classId };
  });
