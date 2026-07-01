import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decodeTimetableCell } from "@/lib/timetable-cell";
import type {
  CurrentTeacher,
  CurrentTeacherClassRow,
  TeacherClassScope,
} from "@/lib/teacher-scope";

type TeacherScopeInput = {
  accessToken: string;
};

type TimetableScopeSlot = {
  class_id: string;
  room: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  classes?: CurrentTeacherClassRow | null;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function generatedTeacherLoginPrefix(staffCode: string) {
  const normalized = staffCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".");
  return `teacher.${normalized}@`;
}

function teacherMatchValues(teacher: CurrentTeacher | null | undefined) {
  return new Set(
    [teacher?.id, teacher?.staff_code, teacher?.full_name, teacher?.full_name_en, teacher?.full_name_km]
      .map(normalizeMatchValue)
      .filter(Boolean),
  );
}

function slotMatchesTeacher(slot: TimetableScopeSlot, teacher: CurrentTeacher) {
  const values = teacherMatchValues(teacher);
  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeMatchValue(value)),
  );
}

function normalizeClassRow(classRow: CurrentTeacherClassRow): CurrentTeacherClassRow {
  return {
    ...classRow,
    teachers: classRow.teachers ?? (classRow.teacher_name ? { full_name: classRow.teacher_name } : null),
  };
}

function uniqueClasses(classes: CurrentTeacherClassRow[]) {
  const byId = new Map<string, CurrentTeacherClassRow>();
  classes.forEach((classRow) => {
    if (!classRow?.id) return;
    byId.set(classRow.id, normalizeClassRow(classRow));
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function findTeacherForUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  const filters = [`user_id.eq.${user.id}`];
  const loginCode =
    typeof user.user_metadata?.login_code === "string"
      ? user.user_metadata.login_code.trim().toUpperCase()
      : "";
  if (loginCode) filters.push(`staff_code.eq.${loginCode}`);
  if (user.email) filters.push(`email.eq.${user.email}`);

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id,staff_code,full_name,full_name_en,full_name_km")
    .or(filters.join(","))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as CurrentTeacher;

  const email = user.email?.trim().toLowerCase();
  if (!email?.startsWith("teacher.")) return null;

  const { data: teachers, error: teachersError } = await supabaseAdmin
    .from("teachers")
    .select("id,staff_code,full_name,full_name_en,full_name_km");
  if (teachersError) throw teachersError;

  return (
    (teachers ?? []).find(
      (teacher) =>
        teacher.staff_code && email.startsWith(generatedTeacherLoginPrefix(teacher.staff_code)),
    ) ?? null
  ) as CurrentTeacher | null;
}

function buildScope(teacher: CurrentTeacher, classes: CurrentTeacherClassRow[]) {
  const unique = uniqueClasses(classes);
  const subjectCodes = new Set<string>();
  unique.forEach((classRow) => {
    const code = classRow.subject_code?.trim();
    if (code) subjectCodes.add(code);
  });

  return {
    teacher,
    classes: unique,
    classIds: unique.map((classRow) => classRow.id),
    classNames: unique.map((classRow) => classRow.name),
    subjectCodes: Array.from(subjectCodes),
  } satisfies TeacherClassScope;
}

export const getTeacherClassScope = createServerFn({ method: "POST" })
  .inputValidator((input: TeacherScopeInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Teacher session");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      throw new Error("Your teacher session expired. Please log in again.");
    }

    const teacher = await findTeacherForUser(authData.user);
    if (!teacher) return null;

    const matchedClasses: CurrentTeacherClassRow[] = [];

    const { data: directClasses, error: directError } = await supabaseAdmin
      .from("classes")
      .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)")
      .eq("teacher_id", teacher.id);
    if (directError) throw directError;
    matchedClasses.push(...((directClasses ?? []) as unknown as CurrentTeacherClassRow[]));

    const { data: slots, error: slotsError } = await supabaseAdmin
      .from("timetable_slots")
      .select(
        "class_id,room,teacher_id,teacher_name,classes(id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name))",
      );
    if (slotsError) throw slotsError;

    ((slots ?? []) as unknown as TimetableScopeSlot[])
      .filter((slot) => slotMatchesTeacher(slot, teacher))
      .forEach((slot) => {
        if (slot.classes) matchedClasses.push(slot.classes);
      });

    return buildScope(teacher, matchedClasses);
  });
