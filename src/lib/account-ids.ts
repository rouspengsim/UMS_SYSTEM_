import type { Role } from "@/lib/auth";
import { UNIVERSITY_ACCOUNT_DOMAIN } from "@/lib/brand";

export type LoginRole = "admin" | "student" | "teacher";

const LEGACY_ACCOUNT_DOMAIN = "studentsphere.local";

function normalizeLoginId(loginId: string) {
  return loginId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function schoolAccountEmail(role: Exclude<Role, "admin">, loginId: string, domain: string) {
  return `${role}.${normalizeLoginId(loginId)}@${domain}`;
}

function pushUnique(list: string[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized && !list.includes(normalized)) list.push(normalized);
}

export function accountLoginEmail(role: Exclude<Role, "admin">, loginId: string) {
  return schoolAccountEmail(role, loginId, UNIVERSITY_ACCOUNT_DOMAIN);
}

export function accountLoginEmailCandidates(role: Exclude<Role, "admin">, loginId: string) {
  const candidates: string[] = [];
  const trimmedLogin = loginId.trim();

  if (trimmedLogin.includes("@")) {
    pushUnique(candidates, trimmedLogin);
  }

  pushUnique(candidates, schoolAccountEmail(role, trimmedLogin, UNIVERSITY_ACCOUNT_DOMAIN));

  if (UNIVERSITY_ACCOUNT_DOMAIN.toLowerCase() !== LEGACY_ACCOUNT_DOMAIN) {
    pushUnique(candidates, schoolAccountEmail(role, trimmedLogin, LEGACY_ACCOUNT_DOMAIN));
  }

  return candidates;
}

export function generateDemoAccountId(role: Exclude<Role, "admin">) {
  return generateSchoolAccountId(role);
}

export function generateSchoolAccountId(role: Exclude<Role, "admin">, enrollmentYear?: number) {
  const year = String(enrollmentYear || new Date().getFullYear()).slice(-2);
  const studentSuffix = String(Math.floor(1000 + Math.random() * 9000));
  const teacherSuffix = String(Math.floor(100 + Math.random() * 900));
  return role === "student" ? `RULE${year}-${studentSuffix}` : `RULE-TH${teacherSuffix}`;
}
