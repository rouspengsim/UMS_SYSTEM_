import { Link, createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard, Avatar } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  Plus,
  Loader2,
  Trash2,
  X,
  Phone,
  BookOpen,
  BadgeCheck,
  IdCard,
  Eye,
  Pencil,
  KeyRound,
  CalendarDays,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageTitle } from "@/lib/brand";
import { createTeacherAccount } from "@/lib/teacher-accounts";
import { ResetPasswordModal } from "@/components/app/reset-password-modal";
import {
  DEFAULT_SUBJECT_OPTIONS,
  mergeSubjectOptions,
  readDemoSubjects,
  subjectRowsToOptions,
} from "@/lib/subjects";
import { decodeTimetableCell } from "@/lib/timetable-cell";

export const Route = createFileRoute("/app/teachers")({
  head: () => ({ meta: [{ title: pageTitle("Teachers") }] }),
  component: TeachersPage,
});

type TeacherRow = {
  id: string;
  user_id?: string | null;
  staff_code: string;
  full_name: string;
  full_name_km: string | null;
  full_name_en: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  faculty: string | null;
  department: string | null;
  specialization: string | null;
};

const DEMO_TEACHERS_KEY = "studentsphere.demo.teachers";

const dayLabels: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function subjectFacultyName(description: string | null | undefined) {
  return (
    description
      ?.split(" / ")
      .map((part) => part.trim())
      .filter(Boolean)[0] ?? ""
  );
}

function filterSubjectsByFaculty(
  options: typeof DEFAULT_SUBJECT_OPTIONS,
  faculty: string | null | undefined,
) {
  const selectedFaculty = faculty?.trim();
  if (!selectedFaculty) return options;

  return options.filter(
    (subject) =>
      subjectFacultyName(subject.description) === selectedFaculty ||
      subject.description?.includes(selectedFaculty),
  );
}

type TeacherScheduleSlot = {
  id: string;
  class_id: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teacher_phone?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  classes?: { name: string; subject_code?: string | null } | null;
};

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function teacherMatchValues(teacher: TeacherRow) {
  return new Set(
    [
      teacher.id,
      teacher.staff_code,
      teacher.full_name,
      teacher.full_name_en,
      teacher.full_name_km,
      teacher.email,
    ]
      .map(normalizeMatchValue)
      .filter(Boolean),
  );
}

function slotMatchesTeacher(slot: TeacherScheduleSlot, teacher: TeacherRow) {
  const values = teacherMatchValues(teacher);
  const payload = decodeTimetableCell(slot.room);
  return [slot.teacher_id, slot.teacher_name, payload.teacherId, payload.teacher].some((value) =>
    values.has(normalizeMatchValue(value)),
  );
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function readDemoTeachers(): TeacherRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_TEACHERS_KEY);
    return raw ? (JSON.parse(raw) as TeacherRow[]) : [];
  } catch {
    return [];
  }
}

function writeDemoTeachers(teachers: TeacherRow[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEMO_TEACHERS_KEY, JSON.stringify(teachers));
  } catch {
    const compact = teachers.map((teacher) => ({
      ...teacher,
      avatar_url:
        teacher.avatar_url?.startsWith("data:") && teacher.avatar_url.length > 250_000
          ? null
          : teacher.avatar_url,
    }));
    localStorage.setItem(DEMO_TEACHERS_KEY, JSON.stringify(compact));
  }
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        const maxSize = 640;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare image"));
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function TeachersPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [viewTeacher, setViewTeacher] = useState<TeacherRow | null>(null);
  const [editTeacher, setEditTeacher] = useState<TeacherRow | null>(null);
  const [passwordTeacher, setPasswordTeacher] = useState<TeacherRow | null>(null);
  const isAdmin = primaryRole === "admin";

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoTeachers();

      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeacherRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) {
        writeDemoTeachers(readDemoTeachers().filter((teacher) => teacher.id !== id));
        return;
      }

      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers", isDemo ? "demo" : "remote"] });
      toast.success(t("teacher_removed"));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("teachers")}
        subtitle={t("teachers_subtitle")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("add")} {t("teacher")}
            </button>
          )
        }
      />
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : teachers.length === 0 ? (
        <SectionCard>
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("no_teachers_yet")}</p>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_first_teacher")}
              </button>
            )}
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {teachers.map((tc) => (
            <div
              key={tc.id}
              className="group relative overflow-hidden rounded-[2rem] border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-[1.6rem] bg-muted">
                {tc.avatar_url ? (
                  <img
                    src={tc.avatar_url}
                    alt={tc.full_name_en || tc.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Avatar name={tc.full_name_en || tc.full_name} className="h-24 w-24 text-2xl" />
                  </div>
                )}
              </div>

              <div className="px-2 pb-1 pt-5">
                <div className="flex items-center justify-center gap-1.5">
                  <h3 className="truncate text-lg font-bold leading-tight">
                    {tc.full_name_en || tc.full_name}
                  </h3>
                  <BadgeCheck className="h-5 w-5 shrink-0 fill-success text-success" />
                </div>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  {tc.full_name_km || "Khmer name not set"}
                </p>
                <p className="mx-auto mt-2 line-clamp-2 max-w-[16rem] text-center text-xs text-muted-foreground">
                  {tc.faculty || tc.department || "Faculty not set"}
                  {tc.specialization ? ` · Teaches ${tc.specialization}` : ""}
                </p>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-4 text-[11px] font-semibold text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <IdCard className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tc.staff_code}</span>
                    </span>
                    {tc.phone && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{tc.phone}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setViewTeacher(tc)}
                      className="inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-xs font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("view")}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEditTeacher(tc)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                          aria-label={t("update_teacher")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          to="/app/timetable"
                          search={{ teacherId: tc.id }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                          aria-label={t("view_schedule")}
                          title={t("view_schedule")}
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setPasswordTeacher(tc)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-warning transition-colors hover:bg-warning/10"
                          aria-label={t("reset_teacher_password")}
                          title={t("reset_password")}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t("remove_teacher_confirm"))) del.mutate(tc.id);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-destructive transition-colors hover:bg-destructive/10"
                          aria-label={t("delete_teacher")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && <TeacherFormModal isDemo={isDemo} onClose={() => setShowAdd(false)} />}
      {editTeacher && (
        <TeacherFormModal
          isDemo={isDemo}
          teacher={editTeacher}
          onClose={() => setEditTeacher(null)}
        />
      )}
      {viewTeacher && (
        <TeacherViewModal
          teacher={viewTeacher}
          isAdmin={isAdmin}
          onClose={() => setViewTeacher(null)}
        />
      )}
      {passwordTeacher && (
        <ResetPasswordModal
          title={t("reset_teacher_password")}
          subtitle={`${passwordTeacher.full_name_en || passwordTeacher.full_name} · ${passwordTeacher.staff_code}`}
          userId={passwordTeacher.user_id}
          isDemo={isDemo}
          onClose={() => setPasswordTeacher(null)}
        />
      )}
    </div>
  );
}

function TeacherFormModal({
  isDemo,
  teacher,
  onClose,
}: {
  isDemo: boolean;
  teacher?: TeacherRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { t } = useI18n();
  const isEdit = !!teacher;
  const [f, setF] = useState(() => ({
    full_name_en: teacher?.full_name_en ?? teacher?.full_name ?? "",
    full_name_km: teacher?.full_name_km ?? "",
    staff_code: teacher?.staff_code ?? "",
    avatar_url: teacher?.avatar_url ?? "",
    email: teacher?.email ?? "",
    phone: teacher?.phone ?? "",
    faculty: teacher?.faculty ?? teacher?.department ?? "",
    specialization: teacher?.specialization ?? "",
    password: "",
  }));

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
  const facultyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          subjectOptions.map((subject) => subjectFacultyName(subject.description)).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [subjectOptions],
  );
  const filteredSubjectOptions = useMemo(
    () => filterSubjectsByFaculty(subjectOptions, f.faculty),
    [subjectOptions, f.faculty],
  );
  const subjectDatalistId = `teacher-subject-options-${teacher?.id ?? "new"}`;

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("image_file_required"));
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      setF((current) => ({ ...current, avatar_url: compressed }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    }
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const teacherCode = f.staff_code.trim().toUpperCase();
        const nextTeacher: TeacherRow = {
          id: teacher?.id ?? `demo-teacher-${Date.now()}`,
          user_id: teacher?.user_id ?? `demo-teacher-user-${Date.now()}`,
          full_name: f.full_name_en || f.full_name_km,
          full_name_en: f.full_name_en || null,
          full_name_km: f.full_name_km || null,
          staff_code: teacherCode,
          avatar_url: f.avatar_url || null,
          email: f.email || null,
          phone: f.phone || null,
          faculty: f.faculty || null,
          department: f.faculty || null,
          specialization: f.specialization || null,
        };
        const existing = readDemoTeachers();
        writeDemoTeachers(
          isEdit
            ? existing.map((item) => (item.id === nextTeacher.id ? nextTeacher : item))
            : [nextTeacher, ...existing],
        );
        return;
      }

      const userId = teacher?.user_id ?? null;
      const staffCode = f.staff_code.trim();

      if (!isEdit) {
        if (!session?.access_token) {
          throw new Error(t("admin_session_expired_login"));
        }

        await createTeacherAccount({
          data: {
            accessToken: session.access_token,
            teacher: {
              password: f.password,
              staff_code: staffCode,
              full_name: f.full_name_en || f.full_name_km,
              full_name_en: f.full_name_en || null,
              full_name_km: f.full_name_km || null,
              avatar_url: f.avatar_url || null,
              email: f.email || null,
              phone: f.phone || null,
              faculty: f.faculty || null,
              department: f.faculty || null,
              specialization: f.specialization || null,
            },
          },
        });
        return;
      }

      const payload = {
        user_id: userId,
        full_name: f.full_name_en || f.full_name_km,
        full_name_en: f.full_name_en || null,
        full_name_km: f.full_name_km || null,
        staff_code: staffCode,
        avatar_url: f.avatar_url || null,
        email: f.email || null,
        phone: f.phone || null,
        faculty: f.faculty || null,
        department: f.faculty || null,
        specialization: f.specialization || null,
      };
      const { error } = isEdit
        ? await supabase.from("teachers").update(payload).eq("id", teacher.id)
        : await supabase.from("teachers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers", isDemo ? "demo" : "remote"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(
        isEdit
          ? isDemo
            ? t("update_teacher")
            : t("update_teacher")
          : isDemo
            ? t("add_teacher")
            : t("add_teacher"),
      );
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
          <h3 className="font-display text-lg font-bold">
            {isEdit ? t("update_teacher") : t("add_teacher")}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.full_name_en.trim()) return toast.error(t("english_name_required"));
            if (!f.full_name_km.trim()) return toast.error(t("khmer_name_required"));
            if (!f.staff_code.trim()) return toast.error(t("teacher_id_required"));
            if (!f.phone.trim()) return toast.error(t("phone_required"));
            if (!f.faculty.trim()) return toast.error(t("faculty_required"));
            if (!f.specialization.trim()) return toast.error(t("teaching_subject_required"));
            if (!isEdit && !f.password.trim()) return toast.error(t("password_required"));
            mut.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input
            type="text"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("profile_image")}
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              {f.avatar_url ? (
                <img
                  src={f.avatar_url}
                  alt={t("teacher_profile_preview")}
                  className="h-16 w-16 rounded-xl object-cover ring-1 ring-border"
                />
              ) : (
                <Avatar
                  name={f.full_name_en || f.full_name_km || t("teacher")}
                  className="h-16 w-16"
                />
              )}
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                />
                <input
                  value={f.avatar_url.startsWith("data:") ? "" : f.avatar_url}
                  onChange={(e) => setF({ ...f, avatar_url: e.target.value })}
                  placeholder={t("paste_image_url")}
                  autoComplete="off"
                  name="teacher-profile-image-url"
                  className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
          {(
            [
              [`${t("teacher_id")} *`, "staff_code"],
              [`${t("name_in_english")} *`, "full_name_en"],
              [`${t("name_in_khmer")} *`, "full_name_km"],
              [`${t("phone_number")} *`, "phone"],
              [t("email"), "email"],
            ] as const
          ).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </label>
              <input
                value={f[key]}
                onChange={(e) =>
                  setF({
                    ...f,
                    [key]: key === "staff_code" ? e.target.value.toUpperCase() : e.target.value,
                  })
                }
                autoComplete="off"
                name={
                  key === "staff_code"
                    ? "manual-teacher-id"
                    : key === "email"
                      ? "teacher-contact-email"
                      : `teacher-${key}`
                }
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("faculty")} *
            </label>
            <select
              value={f.faculty}
              onChange={(e) => {
                const faculty = e.target.value;
                const nextSubjects = filterSubjectsByFaculty(subjectOptions, faculty);
                const currentSubjectIsKnown = subjectOptions.some(
                  (subject) => subject.label === f.specialization,
                );
                const currentSubjectStillAvailable = nextSubjects.some(
                  (subject) => subject.label === f.specialization,
                );
                setF({
                  ...f,
                  faculty,
                  specialization:
                    currentSubjectIsKnown && !currentSubjectStillAvailable ? "" : f.specialization,
                });
              }}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">
                {t("select")} {t("faculty")}
              </option>
              {facultyOptions.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
              {f.faculty && !facultyOptions.includes(f.faculty) && (
                <option value={f.faculty}>{f.faculty}</option>
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("teaches_subject")} *
            </label>
            <input
              key={f.faculty || "all-subjects"}
              value={f.specialization}
              onChange={(e) => setF({ ...f, specialization: e.target.value })}
              list={subjectDatalistId}
              placeholder={t("select_subject_option")}
              autoComplete="off"
              name="teacher-teaching-subject"
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <datalist id={subjectDatalistId}>
              {filteredSubjectOptions.map((subject) => (
                <option
                  key={subject.code}
                  value={subject.label}
                  label={`${subject.code}${subject.description ? ` · ${subject.description}` : ""}`}
                />
              ))}
            </datalist>
          </div>
          {!isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("password")} *
              </label>
              <input
                type="password"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                autoComplete="one-time-code"
                name="manual-teacher-passcode"
                data-lpignore="true"
                data-1p-ignore="true"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60 sm:col-span-2"
          >
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              t("update_teacher")
            ) : (
              t("save_teacher")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function TeacherViewModal({
  teacher,
  isAdmin,
  onClose,
}: {
  teacher: TeacherRow;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const {
    data: scheduleSlots = [],
    isLoading: scheduleLoading,
    isError: scheduleError,
    error: scheduleLoadError,
  } = useQuery({
    queryKey: ["teacher-profile-schedule", teacher.id],
    queryFn: async () => {
      let { data, error } = await supabase
        .from("timetable_slots")
        .select(
          "id,class_id,day,start_time,end_time,room,teacher_id,teacher_name,teacher_phone,subject_code,subject_name,classes(name,subject_code)",
        )
        .order("day", { ascending: true })
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
          .order("day", { ascending: true })
          .order("start_time", { ascending: true });
        data = fallback.data as typeof data;
        error = fallback.error;
      }

      if (error) throw error;
      return ((data ?? []) as unknown as TeacherScheduleSlot[]).filter((slot) =>
        slotMatchesTeacher(slot, teacher),
      );
    },
  });

  const scheduleByClass = Array.from(
    scheduleSlots.reduce((groups, slot) => {
      const className = slot.classes?.name || "Class";
      groups.set(className, [...(groups.get(className) ?? []), slot]);
      return groups;
    }, new Map<string, TeacherScheduleSlot[]>()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-border bg-card p-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-[1.6rem] bg-muted">
          {teacher.avatar_url ? (
            <img
              src={teacher.avatar_url}
              alt={teacher.full_name_en || teacher.full_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Avatar
                name={teacher.full_name_en || teacher.full_name}
                className="h-24 w-24 text-2xl"
              />
            </div>
          )}
        </div>
        <div className="px-2 py-5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <h3 className="text-xl font-bold">{teacher.full_name_en || teacher.full_name}</h3>
            <BadgeCheck className="h-5 w-5 fill-success text-success" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{teacher.full_name_km ?? "—"}</p>
        </div>
        <div className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm">
          <InfoRow label="Teacher ID" value={teacher.staff_code} />
          <InfoRow label="Faculty" value={teacher.faculty || teacher.department || "—"} />
          <InfoRow label="Teaches" value={teacher.specialization || "—"} />
          <InfoRow label="Phone" value={teacher.phone || "—"} />
          <InfoRow label="Email" value={teacher.email || "—"} />
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="inline-flex items-center gap-2 text-sm font-bold">
              <BookOpen className="h-4 w-4 text-primary" />
              Classes & schedule
            </h4>
            <span className="text-xs font-semibold text-muted-foreground">
              {scheduleSlots.length} lesson{scheduleSlots.length === 1 ? "" : "s"}
            </span>
          </div>
          {scheduleLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : scheduleError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
              Could not load teacher schedule:{" "}
              {scheduleLoadError instanceof Error ? scheduleLoadError.message : "Unknown error"}
            </p>
          ) : scheduleByClass.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              No class schedule assigned to this teacher yet.
            </p>
          ) : (
            <div className="space-y-3">
              {scheduleByClass.map(([className, slots]) => (
                <div key={className} className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">{className}</p>
                    <span className="text-xs text-muted-foreground">
                      {slots.length} lesson{slots.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {slots.map((slot) => {
                      const payload = decodeTimetableCell(slot.room);
                      const subject =
                        slot.subject_name ||
                        payload.subject ||
                        slot.subject_code ||
                        payload.subjectCode ||
                        slot.classes?.subject_code ||
                        "Subject";
                      const room = payload.room || "";
                      return (
                        <div
                          key={slot.id}
                          className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs"
                        >
                          <div className="font-semibold text-foreground">
                            {dayLabels[slot.day] ?? slot.day.toUpperCase()} ·{" "}
                            {formatTime(slot.start_time)}-{formatTime(slot.end_time)}
                          </div>
                          <div className="mt-1 text-muted-foreground">{subject}</div>
                          {room && <div className="mt-1 text-muted-foreground">Room {room}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {isAdmin && (
          <Link
            to="/app/timetable"
            search={{ teacherId: teacher.id }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <CalendarDays className="h-4 w-4" /> View schedule
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
