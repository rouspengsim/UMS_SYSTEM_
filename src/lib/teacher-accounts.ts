import { createServerFn } from "@tanstack/react-start";
import { accountLoginEmail } from "@/lib/account-ids";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type TeacherInsert = Database["public"]["Tables"]["teachers"]["Insert"];

type CreateTeacherInput = {
  accessToken: string;
  teacher: Omit<TeacherInsert, "user_id"> & {
    password: string;
  };
};

type UpdateTeacherInput = {
  accessToken: string;
  teacherId: string;
  userId?: string | null;
  teacher: Omit<TeacherInsert, "user_id">;
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

  const { data: adminRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) throw roleError;
  if (!adminRole) {
    throw new Error("Only admins can manage teacher accounts.");
  }

  return authData.user;
}

async function requireUniqueTeacherCode(value?: string | null, excludeTeacherId?: string) {
  const code = requireString(value, "Teacher ID").toUpperCase();
  let query = supabaseAdmin.from("teachers").select("id").eq("staff_code", code).limit(1);
  if (excludeTeacherId) query = query.neq("id", excludeTeacherId);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (data) throw new Error(`Teacher ID ${code} already exists.`);
  return code;
}

export const createTeacherAccount = createServerFn({ method: "POST" })
  .inputValidator((input: CreateTeacherInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const password = requireString(data.teacher.password, "Password");
    const fullName = requireString(data.teacher.full_name, "Teacher name");

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    await requireAdmin(accessToken);

    const staffCode = await requireUniqueTeacherCode(data.teacher.staff_code);
    const loginEmail = accountLoginEmail("teacher", staffCode).toLowerCase();

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser(
      {
        email: loginEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
          login_code: staffCode,
          contact_email: data.teacher.email || null,
        },
      },
    );

    if (createUserError || !createdUser.user) {
      throw createUserError ?? new Error("Could not create teacher login account.");
    }

    const userId = createdUser.user.id;

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          full_name: fullName,
          email: data.teacher.email || null,
          avatar_url: data.teacher.avatar_url || null,
        },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;

      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "teacher" }, { onConflict: "user_id,role" });
      if (roleInsertError) throw roleInsertError;

      const { password: _password, ...teacherInput } = data.teacher;
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .insert({
          ...teacherInput,
          user_id: userId,
          staff_code: staffCode,
          full_name: fullName,
        } as TeacherInsert)
        .select()
        .single();

      if (teacherError) throw teacherError;

      return {
        user_id: userId,
        login_code: staffCode,
        login_email: loginEmail,
        teacher,
      };
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
  });

export const updateTeacherAccount = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateTeacherInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const teacherId = requireString(data.teacherId, "Teacher");
    const fullName = requireString(data.teacher.full_name, "Teacher name");

    await requireAdmin(accessToken);
    const staffCode = await requireUniqueTeacherCode(data.teacher.staff_code, teacherId);

    const { data: currentTeacher, error: currentTeacherError } = await supabaseAdmin
      .from("teachers")
      .select("user_id")
      .eq("id", teacherId)
      .maybeSingle();
    if (currentTeacherError) throw currentTeacherError;

    const userId = data.userId ?? currentTeacher?.user_id ?? null;
    const loginEmail = accountLoginEmail("teacher", staffCode).toLowerCase();

    if (userId) {
      const { data: authUser, error: authUserError } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUserError) throw authUserError;

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: loginEmail,
        email_confirm: true,
        user_metadata: {
          ...(authUser.user?.user_metadata ?? {}),
          full_name: fullName,
          role: "teacher",
          login_code: staffCode,
          contact_email: data.teacher.email || null,
        },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          full_name: fullName,
          email: data.teacher.email || null,
          avatar_url: data.teacher.avatar_url || null,
        },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;

      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "teacher" }, { onConflict: "user_id,role" });
      if (roleInsertError) throw roleInsertError;
    }

    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .update({
        ...data.teacher,
        user_id: userId,
        staff_code: staffCode,
        full_name: fullName,
      } as TeacherInsert)
      .eq("id", teacherId)
      .select()
      .single();

    if (teacherError) throw teacherError;

    return {
      login_email: userId ? loginEmail : null,
      teacher,
    };
  });
