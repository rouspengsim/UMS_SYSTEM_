import type { Role } from "@/lib/auth";

const rolePaths: Record<Role, string[]> = {
  admin: [
    "/app",
    "/app/students",
    "/app/teachers",
    "/app/classes",
    "/app/subjects",
    "/app/attendance",
    "/app/exams",
    "/app/timetable",
    "/app/payments",
    "/app/reports",
    "/app/notifications",
    "/app/roles",
    "/app/certificates",
  ],
  teacher: [
    "/app",
    "/app/students",
    "/app/classes",
    "/app/subjects",
    "/app/attendance",
    "/app/exams",
    "/app/timetable",
    "/app/notifications",
  ],
  student: [
    "/app",
    "/app/students",
    "/app/classes",
    "/app/attendance",
    "/app/exams",
    "/app/timetable",
    "/app/payments",
    "/app/notifications",
    "/app/certificates",
  ],
};

export function canAccessPath(role: Role | null, pathname: string) {
  if (!role) return false;
  const allowed = rolePaths[role];
  return allowed.some((path) => {
    if (path === "/app") return pathname === "/app" || pathname === "/app/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function allowedPathSet(role: Role | null) {
  return new Set(rolePaths[role ?? "student"]);
}
