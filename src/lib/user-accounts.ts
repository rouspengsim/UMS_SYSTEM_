import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type UpdateUserPasswordInput = {
  accessToken: string;
  userId: string;
  password: string;
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
