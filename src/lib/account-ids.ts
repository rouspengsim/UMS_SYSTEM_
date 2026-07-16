import type { Role } from "@/lib/auth";
import { UNIVERSITY_ACCOUNT_DOMAIN } from "@/lib/brand";

export type LoginRole = "admin" | "student" | "teacher";

export function accountLoginEmail(role: Exclude<Role, "admin">, loginId: string) {
  const normalizedId = loginId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return `${role}.${normalizedId}@${UNIVERSITY_ACCOUNT_DOMAIN}`;
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
