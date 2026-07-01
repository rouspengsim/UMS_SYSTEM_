import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, Globe, LogOut, ChevronDown, Moon, Sun, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { decodeNotificationContent } from "@/lib/notification-content";

type TopbarNotification = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
};

const DEMO_NOTIFICATIONS_KEY = "studentsphere.demo.notifications";

function readDemoNotifications(): TopbarNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_NOTIFICATIONS_KEY);
    return raw ? (JSON.parse(raw) as TopbarNotification[]) : [];
  } catch {
    return [];
  }
}

export function Topbar() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user, profile, primaryRole, isDemo, signOut } = useAuth();
  const navigate = useNavigate();
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [openQuickAdd, setOpenQuickAdd] = useState(false);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const { data: notifs = [] } = useQuery({
    queryKey: ["topbar-notifications", user?.id, isDemo ? "demo" : "remote"],
    enabled: !!user,
    queryFn: async () => {
      if (isDemo) return readDemoNotifications().slice(0, 5);

      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,kind,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const unread = notifs.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur lg:px-6">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex w-full max-w-xl items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder={t("search_placeholder")}
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-16 text-sm outline-none ring-0 transition-all focus:border-primary focus:bg-surface focus:shadow-soft"
          />
          <kbd className="absolute right-2 hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {primaryRole === "admin" && (
          <div className="relative">
            <button
              onClick={() => {
                setOpenQuickAdd((v) => !v);
                setOpenNotif(false);
                setOpenProfile(false);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("add")}
            </button>
            {openQuickAdd && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-popover p-2 shadow-card">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("quick_add")}
                </p>
                <div className="space-y-1">
                  {[
                    { to: "/app/students", label: t("student"), desc: t("create_student_profile") },
                    { to: "/app/teachers", label: t("teacher"), desc: t("add_faculty_member") },
                    {
                      to: "/app/classes",
                      label: t("class"),
                      desc: t("create_class_assign_teacher"),
                    },
                    { to: "/app/timetable", label: t("shift"), desc: t("add_timetable_slot") },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to as "/app/students"}
                      search={{ create: "1" } as never}
                      onClick={() => setOpenQuickAdd(false)}
                      className="block rounded-xl px-3 py-2 hover:bg-muted"
                    >
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          aria-label={theme === "dark" ? t("light_mode") : t("dark_mode")}
          title={theme === "dark" ? t("light_mode") : t("dark_mode")}
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === "dark" ? t("light_mode") : t("dark_mode")}
        </button>

        <button
          onClick={() => setLang(lang === "en" ? "km" : "en")}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Globe className="h-3.5 w-3.5" />
          {lang === "en" ? "EN" : "ខ្មែរ"}
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setOpenNotif((v) => !v);
              setOpenProfile(false);
              setOpenQuickAdd(false);
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-muted"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-surface" />
            )}
          </button>
          {openNotif && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl border border-border bg-popover p-2 shadow-card">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("notifications")}
              </p>
              {notifs.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("no_notifications_yet")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {notifs.map((n) => (
                    <li key={n.id} className="rounded-xl px-3 py-2 text-sm hover:bg-muted">
                      <p className="font-medium leading-tight">{n.title}</p>
                      {decodeNotificationContent(n.body).description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {decodeNotificationContent(n.body).description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/app/notifications"
                onClick={() => setOpenNotif(false)}
                className="mt-1 block rounded-xl bg-primary/10 px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/15"
              >
                {t("view_all")}
              </Link>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setOpenProfile((v) => !v);
              setOpenNotif(false);
              setOpenQuickAdd(false);
            }}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface pl-1 pr-2.5 text-left text-sm transition-colors hover:bg-muted"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-border"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-primary-foreground">
                {initials}
              </span>
            )}
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-xs font-semibold">{displayName}</span>
              <span className="text-[10px] capitalize text-muted-foreground">
                {primaryRole ?? "—"}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                openProfile && "rotate-180",
              )}
            />
          </button>
          {openProfile && (
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-border bg-popover shadow-card">
              <div className="border-b border-border bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-primary-foreground">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  setOpenProfile(false);
                  navigate({ to: "/" });
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> {t("sign_out")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
