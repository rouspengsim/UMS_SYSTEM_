import { createServerFn } from "@tanstack/react-start";
import { accountLoginEmail, generateSchoolAccountId } from "@/lib/account-ids";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];

type CreateStudentInput = {
  accessToken: string;
  student: Omit<StudentInsert, "user_id" | "status"> & {
    password: string;
  };
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function normalizeStudentCode(code: string | null | undefined, enrollmentYear?: number) {
  const normalized = code?.trim().toUpperCase().replaceAll(".", "-");
  return normalized || generateSchoolAccountId("student", enrollmentYear);
}

export const createStudentAccount = createServerFn({ method: "POST" })
  .inputValidator((input: CreateStudentInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const password = requireString(data.student.password, "Password");
    const fullName = requireString(data.student.full_name, "Student name");

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

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
      throw new Error("Only admins can create student accounts.");
    }

    const enrollmentYear = Number(data.student.enrollment_year) || new Date().getFullYear();
    const studentCode = normalizeStudentCode(data.student.student_code, enrollmentYear);
    const loginEmail = accountLoginEmail("student", studentCode).toLowerCase();

    const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("student_code", studentCode)
      .maybeSingle();

    if (existingStudentError) throw existingStudentError;
    if (existingStudent) {
      throw new Error(`Student ID ${studentCode} already exists.`);
    }

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "student",
        login_code: studentCode,
        contact_email: data.student.email || null,
      },
    });

    if (createUserError || !createdUser.user) {
      throw createUserError ?? new Error("Could not create student login account.");
    }

    const userId = createdUser.user.id;

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          full_name: fullName,
          email: data.student.email || null,
          avatar_url: data.student.avatar_url || null,
        },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;

      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "student" }, { onConflict: "user_id,role" });
      if (roleInsertError) throw roleInsertError;

      const { password: _password, ...studentInput } = data.student;
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          ...studentInput,
          user_id: userId,
          student_code: studentCode,
          full_name: fullName,
          enrollment_year: enrollmentYear,
          status: "active",
        } as StudentInsert)
        .select()
        .single();

      if (studentError) throw studentError;

      return {
        user_id: userId,
        login_code: studentCode,
        login_email: loginEmail,
        student,
      };
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
  });
