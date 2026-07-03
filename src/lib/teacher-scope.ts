import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { decodeTimetableCell } from "@/lib/timetable-cell";

export type CurrentTeacher = {
  id: string;
  staff_code?: string | null;
  full_name?: string | null;
  full_name_en?: string | null;
  full_name_km?: string | null;
};

export type TeacherClassScope = {
  teacher: CurrentTeacher;
  classes: CurrentTeacherClassRow[];
  classIds: string[];
  classNames: string[];
  subjectCodes: string[];
};

export type CurrentTeacherClassRow = {
  id: string;
  name: string;
  subject_code: string | null;
  room?: string | null;
  capacity?: number | null;
  semester?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teachers?: { full_name: string } | null;
};

function metadataLoginCode(user: SupabaseUser | null | undefined) {
  const code = user?.user_metadata?.login_code;
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function generatedTeacherLoginPrefix(staffCode: string) {
  const normalized = staffCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return `teacher.${normalized}@`;
}

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function teacherMatchValues(teacher: CurrentTeacher | null | undefined) {
  return new Set(
    [
      teacher?.id,
      teacher?.staff_code,
      teacher?.full_name,
      teacher?.full_name_en,
      teacher?.full_name_km,
    ]
      .map(normalizeMatchValue)
      .filter(Boolean),
  );
}

type TimetableScopeSlot = {
  class_id: string;
  room: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  subject_code?: string | null;
  classes?: CurrentTeacherClassRow | null;
};

type CurrentTeacherClassesRpcClient = {
  rpc(functionName: "current_teacher_classes"): Promise<{
    data: CurrentTeacherClassRow[] | null;
    error: unknown;
  }>;
};

function slotMatchesTeacher(slot: TimetableScopeSlot, teacher: CurrentTeacher | null | undefined) {
  const values = teacherMatchValues(teacher);
  if (values.size === 0) return false;

  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeMatchValue(value)),
  );
}

function normalizeClassRow(classRow: CurrentTeacherClassRow): CurrentTeacherClassRow {
  return {
    ...classRow,
    teachers:
      classRow.teachers ?? (classRow.teacher_name ? { full_name: classRow.teacher_name } : null),
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

export async function findCurrentTeacher(user: SupabaseUser | null | undefined) {
  if (!user?.id) return null;

  const filters = [`user_id.eq.${user.id}`];
  const loginCode = metadataLoginCode(user);
  if (loginCode) filters.push(`staff_code.eq.${loginCode}`);
  if (user.email) filters.push(`email.eq.${user.email}`);

  const { data, error } = await supabase
    .from("teachers")
    .select("id,staff_code,full_name,full_name_en,full_name_km")
    .or(filters.join(","))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as CurrentTeacher;

  const email = user.email?.trim().toLowerCase();
  if (!email?.startsWith("teacher.")) return null;

  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id,staff_code,full_name,full_name_en,full_name_km");
  if (teachersError) throw teachersError;

  return ((teachers ?? []).find(
    (teacher) =>
      teacher.staff_code && email.startsWith(generatedTeacherLoginPrefix(teacher.staff_code)),
  ) ?? null) as CurrentTeacher | null;
}

export async function findTeacherClassScope(user: SupabaseUser | null | undefined) {
  const localTeacher = await findCurrentTeacher(user);

  let rpcClasses: CurrentTeacherClassRow[] = [];
  try {
    const { data, error } = await (supabase as unknown as CurrentTeacherClassesRpcClient).rpc(
      "current_teacher_classes",
    );
    if (error) throw error;
    rpcClasses = ((data ?? []) as CurrentTeacherClassRow[]).map(normalizeClassRow);
  } catch {
    rpcClasses = [];
  }

  const teacher =
    localTeacher ??
    (rpcClasses[0]?.teacher_id
      ? ({
          id: rpcClasses[0].teacher_id,
          full_name: rpcClasses[0].teacher_name ?? null,
        } satisfies CurrentTeacher)
      : null);
  if (!teacher) return null;

  const fallbackClasses: CurrentTeacherClassRow[] = [];

  const { data: directClasses, error: directClassesError } = await supabase
    .from("classes")
    .select("id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name)")
    .eq("teacher_id", teacher.id);
  if (!directClassesError) {
    fallbackClasses.push(...((directClasses ?? []) as unknown as CurrentTeacherClassRow[]));
  }

  const { data: timetableSlots, error: slotsError } = await supabase
    .from("timetable_slots")
    .select(
      "class_id,room,teacher_id,teacher_name,subject_code,classes(id,name,subject_code,room,capacity,semester,teacher_id,teachers(full_name))",
    );
  if (!slotsError) {
    const matchedSlots = ((timetableSlots ?? []) as unknown as TimetableScopeSlot[]).filter(
      (slot) => slotMatchesTeacher(slot, teacher),
    );
    fallbackClasses.push(
      ...matchedSlots
        .map((slot) => slot.classes ?? null)
        .filter((classRow): classRow is CurrentTeacherClassRow => !!classRow),
    );
  }

  const classes = uniqueClasses([...rpcClasses, ...fallbackClasses]);

  const subjectCodes = new Set<string>();
  classes.forEach((classRow) => {
    const code = classRow.subject_code?.trim();
    if (code) subjectCodes.add(code);
  });

  return {
    teacher,
    classes,
    classIds: classes.map((classRow) => classRow.id),
    classNames: classes.map((classRow) => classRow.name),
    subjectCodes: Array.from(subjectCodes),
  } satisfies TeacherClassScope;
}
