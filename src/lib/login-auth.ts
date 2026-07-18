import type { User as SupabaseUser } from "@supabase/supabase-js";
import { accountLoginEmail, accountLoginEmailCandidates, type LoginRole } from "@/lib/account-ids";
import { supabase } from "@/integrations/supabase/client";

export function isNetworkAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  );
}

export function authErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : "Authentication failed";
  if (isNetworkAuthError(err)) {
    return "Cannot reach Supabase. Check internet/DNS and make sure your Supabase project is active.";
  }

  if (msg.toLowerCase().includes("invalid login credentials")) {
    return "The account information is incorrect or access is not allowed.";
  }

  if (msg.toLowerCase().includes("database error querying schema")) {
    return "Supabase Auth is rejecting this account. Repair the admin Auth user with npm run repair:admin, then try again.";
  }

  if (msg !== "Authentication failed") return msg;

  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }

  return msg;
}

export function roleDisplayName(role: LoginRole) {
  if (role === "admin") return "admin";
  if (role === "teacher") return "teacher";
  return "student";
}

export function accountEmailForLogin(role: LoginRole, loginId: string, email: string) {
  return role === "admin" ? email.trim() : accountLoginEmail(role, loginId);
}

function isInvalidLoginCredentials(err: unknown) {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("invalid login credentials");
}

export async function signInWithRoleCredentials(
  role: LoginRole,
  loginId: string,
  email: string,
  password: string,
) {
  if (role === "admin") {
    return supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  }

  let lastError: unknown = null;
  const emails = accountLoginEmailCandidates(role, loginId);

  for (const candidateEmail of emails) {
    const result = await supabase.auth.signInWithPassword({
      email: candidateEmail,
      password,
    });

    if (!result.error) return result;
    if (!isInvalidLoginCredentials(result.error)) return result;
    lastError = result.error;
  }

  return {
    data: { user: null, session: null },
    error: lastError instanceof Error ? lastError : new Error("Invalid login credentials"),
  };
}

export async function verifySignedInRole(user: SupabaseUser, role: LoginRole) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

  if (error) throw error;

  const hasRole = data?.some((row) => row.role === role);
  if (hasRole) return;

  const metadataRole = user.user_metadata?.role;
  if (metadataRole === role) return;

  if (role === "student") {
    const { data: studentRow, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (studentError) throw studentError;
    if (studentRow) return;
  }

  if (role === "teacher") {
    const { data: teacherRow, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (teacherError) throw teacherError;
    if (teacherRow) return;
  }

  await supabase.auth.signOut();
  throw new Error(`This account is not registered as ${roleDisplayName(role)}.`);
}
