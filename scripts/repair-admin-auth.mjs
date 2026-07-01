#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "admin@gmail.com";
const FALLBACK_ADMIN_EMAIL = "admin.work@gmail.com";
const ADMIN_PASSWORD = "Admin@123";

function parseEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    const env = {};
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

function getEnv(name, fallbackName) {
  return process.env[name] || process.env[fallbackName || name] || fileEnv[name] || fileEnv[fallbackName || name];
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const fileEnv = parseEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = getEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
const anonKey = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl) fail("Missing SUPABASE_URL or VITE_SUPABASE_URL in .env.");
if (!anonKey) fail("Missing SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in .env.");
if (!serviceRoleKey) {
  fail(
    [
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env.",
      "Get it from Supabase Dashboard > Project Settings > API > service_role key.",
      "Add it to .env as SUPABASE_SERVICE_ROLE_KEY=...",
      "Do not put the service role key in Vercel client env or commit it to git.",
    ].join("\n"),
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findAdminUserIdsFromPublicTables(email) {
  const ids = new Set();

  const { data: profileRows, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id")
    .ilike("email", email);
  if (profileError) throw profileError;

  for (const row of profileRows || []) {
    if (row.user_id) ids.add(row.user_id);
  }

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (roleError) throw roleError;

  for (const row of roleRows || []) {
    if (row.user_id) ids.add(row.user_id);
  }

  return [...ids];
}

async function main() {
  console.log("Repairing hosted Supabase admin auth user...");

  let targetEmail = ADMIN_EMAIL;
  const existingUserIds = await findAdminUserIdsFromPublicTables(ADMIN_EMAIL);
  for (const userId of existingUserIds) {
    console.log(`Deleting existing ${ADMIN_EMAIL} auth user ${userId}...`);
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`Could not delete broken ${ADMIN_EMAIL}: ${error.message}`);
      console.warn(`Using fresh hosted Auth admin instead: ${FALLBACK_ADMIN_EMAIL}`);
      targetEmail = FALLBACK_ADMIN_EMAIL;
      break;
    }
  }

  let userId;
  const existingSignIn = await anonClient.auth.signInWithPassword({
    email: targetEmail,
    password: ADMIN_PASSWORD,
  });

  if (existingSignIn.data.user?.id) {
    userId = existingSignIn.data.user.id;
    await anonClient.auth.signOut();
    console.log(`Using existing working admin Auth user ${targetEmail}.`);
  } else {
    console.log(`Creating ${targetEmail} through Supabase Admin API...`);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: targetEmail,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Admin", role: "admin" },
    });
    if (createError) throw createError;

    userId = created.user?.id;
    if (!userId) throw new Error("Supabase did not return a created admin user id.");
  }

  console.log("Attaching public profile and admin role...");
  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      user_id: userId,
      full_name: "Admin",
      email: targetEmail,
      avatar_url: null,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: userId,
      role: "admin",
    },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  const { error: deleteOtherRolesError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .neq("role", "admin");
  if (deleteOtherRolesError) throw deleteOtherRolesError;

  console.log("Testing password login...");
  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: targetEmail,
    password: ADMIN_PASSWORD,
  });
  if (signInError) throw signInError;

  await anonClient.auth.signOut();

  console.log("\nAdmin login is working.");
  console.log(`Email: ${targetEmail}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
}

main().catch((error) => {
  console.error("\nRepair failed.");
  console.error(error.message || error);
  process.exit(1);
});
