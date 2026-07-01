import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type UpdateUserPasswordInput = {
  accessToken: string;
  userId: string;
  password: string;
};

type UploadStudentAvatarInput = {
  accessToken: string;
  studentId: string;
  imageBase64: string;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export const updateUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateUserPasswordInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const userId = requireString(data.userId, "User");
    const password = requireString(data.password, "New password");

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
      throw new Error("Only admins can update user passwords.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;

    return { userId };
  });

export const uploadStudentAvatar = createServerFn({ method: "POST" })
  .inputValidator((input: UploadStudentAvatarInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Session");
    const studentId = requireString(data.studentId, "Student");
    const imageBase64 = requireString(data.imageBase64, "Image");

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      throw new Error("Your session expired. Please log in again.");
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id,user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("Student not found.");

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;

    if (!adminRole && student.user_id !== authData.user.id) {
      throw new Error("You cannot update this student profile image.");
    }

    const imageBytes = Buffer.from(imageBase64, "base64");
    if (imageBytes.length === 0 || imageBytes.length > 5 * 1024 * 1024) {
      throw new Error("Profile image must be smaller than 5 MB.");
    }

    const folder = student.user_id || `student-${student.id}`;
    const path = `${folder}/${student.id}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("student-avatars")
      .upload(path, imageBytes, {
        contentType: "image/webp",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabaseAdmin.storage.from("student-avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

    const { error: updateStudentError } = await supabaseAdmin
      .from("students")
      .update({ avatar_url: avatarUrl })
      .eq("id", student.id);
    if (updateStudentError) throw updateStudentError;

    if (student.user_id) {
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", student.user_id);
      if (updateProfileError) throw updateProfileError;
    }

    return { avatarUrl };
  });
