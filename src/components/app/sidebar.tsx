import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  Wallet,
  BarChart3,
  Bell,
  ShieldCheck,
  Award,
  Settings,
  UserRound,
} from "lucide-react";
import { UNIVERSITY_LOGO_URL, UNIVERSITY_NAME_EN, UNIVERSITY_SHORT_NAME } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { allowedPathSet } from "@/lib/role-access";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof LayoutDashboard; key: string; end?: boolean };
export const navItems: NavItem[] = [
  { to: "/app", icon: LayoutDashboard, key: "dashboard", end: true },
  { to: "/app/students", icon: Users, key: "students" },
  { to: "/app/teachers", icon: GraduationCap, key: "teachers" },
  { to: "/app/classes", icon: School, key: "classes" },
  { to: "/app/subjects", icon: BookOpen, key: "subjects" },
  { to: "/app/attendance", icon: CalendarCheck, key: "attendance" },
  { to: "/app/exams", icon: ClipboardList, key: "exams" },
  { to: "/app/timetable", icon: CalendarDays, key: "timetable" },
  { to: "/app/payments", icon: Wallet, key: "payments" },
  { to: "/app/reports", icon: BarChart3, key: "reports" },
  { to: "/app/notifications", icon: Bell, key: "notifications" },
  { to: "/app/roles", icon: ShieldCheck, key: "roles" },
  { to: "/app/certificates", icon: Award, key: "certificates" },
];

function navItemsForRole(role: ReturnType<typeof useAuth>["primaryRole"]) {
  const allowed = allowedPathSet(role);
  return navItems.filter((item) => allowed.has(item.to));
}

export function Sidebar() {
  const { t } = useI18n();
  const { primaryRole, profile } = useAuth();
  const { pathname } = useLocation();
  const visibleNavItems = navItemsForRole(primaryRole);
  const isStudent = primaryRole === "student";
  const profileName = profile?.full_name || t("my_information");

  return (
    <aside className={cn("hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex", isStudent ? "w-60" : "w-64")}>
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-soft ring-1 ring-border/70">
          <img
            src={UNIVERSITY_LOGO_URL}
            alt="University logo"
            className="h-full w-full object-contain p-1"
          />
        </div>
        <div className="leading-tight">
          <p className="font-display text-base font-bold tracking-tight">{UNIVERSITY_SHORT_NAME}</p>
          <p className="text-[10px] tracking-wide text-muted-foreground">
            {UNIVERSITY_NAME_EN}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isStudent ? t("student_portal") : t("dashboard")}
        </p>
        <ul className="space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to as "/app"}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {isStudent ? (
        <Link
          to="/app/students"
          className="m-3 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-foreground shadow-soft hover:bg-muted"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profileName}
              className="h-9 w-9 rounded-md object-cover ring-1 ring-border"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <UserRound className="h-4 w-4" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">{profileName}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {t("view_student_profile")}
            </span>
          </span>
        </Link>
      ) : (
        <div className="m-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground shadow-soft">
          <p className="text-sm font-semibold capitalize">{primaryRole ?? t("dashboard")}</p>
          <p className="mt-1 text-xs opacity-80">
            {primaryRole === "admin"
              ? t("customize_workspace")
              : t("focused_teaching_workspace")}
          </p>
          <Link
            to="/app"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
          >
            <Settings className="h-3 w-3" /> {t("open")}
          </Link>
        </div>
      )}
    </aside>
  );
}

export function MobileNav() {
  const { t } = useI18n();
  const { primaryRole } = useAuth();
  const { pathname } = useLocation();
  const items =
    primaryRole === "student"
      ? navItemsForRole(primaryRole).filter((item) =>
          ["/app", "/app/timetable", "/app/exams", "/app/students"].includes(item.to),
        )
      : navItemsForRole(primaryRole).slice(0, 5);
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-40 flex items-center justify-around rounded-xl border border-border bg-surface/95 px-2 py-1.5 shadow-card backdrop-blur lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to as "/app"}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "scale-110")} />
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
