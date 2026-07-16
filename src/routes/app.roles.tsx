import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { pageTitle } from "@/lib/brand";
import { updateUserPassword } from "@/lib/user-accounts";

export const Route = createFileRoute("/app/roles")({
  head: () => ({ meta: [{ title: pageTitle("Roles & Permissions") }] }),
  component: RolesPage,
});

type RoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "teacher" | "student";
  profiles: { full_name: string; email: string | null } | null;
};

const ROLE_REPORT_PAGE_SIZE = 10;

function roleLabel(role: RoleRow["role"], t: (key: string) => string) {
  return t(role);
}

function RolesPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo, profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = primaryRole === "admin";
  const [page, setPage] = useState(1);
  const [passwordUser, setPasswordUser] = useState<RoleRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["user-roles", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) {
        return [
          {
            id: "demo-role",
            user_id: profile?.user_id ?? "demo-user",
            role: primaryRole ?? "admin",
            profiles: {
              full_name: profile?.full_name ?? "Demo Admin",
              email: profile?.email ?? "admin@gmail.com",
            },
          },
        ] as RoleRow[];
      }

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("id,user_id,role")
        .order("created_at", { ascending: false });
      // Fetch matching profiles
      const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("user_id,full_name,email").in("user_id", userIds)
        : { data: [] as { user_id: string; full_name: string; email: string | null }[] };
      const profMap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (roles ?? []).map((r) => ({
        ...r,
        profiles: profMap.get(r.user_id)
          ? { full_name: profMap.get(r.user_id)!.full_name, email: profMap.get(r.user_id)!.email }
          : null,
      })) as RoleRow[];
    },
  });

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => roleLabel(a.role, t).localeCompare(roleLabel(b.role, t))),
    [rows, t],
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / ROLE_REPORT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = sortedRows.slice(
    (safePage - 1) * ROLE_REPORT_PAGE_SIZE,
    safePage * ROLE_REPORT_PAGE_SIZE,
  );

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-roles", isDemo ? "demo" : "remote"] });
      toast.success(t("role_removed"));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={t("roles")} subtitle={t("roles_subtitle")} />
      <SectionCard
        title={t("roles")}
        action={
          isAdmin &&
          !isDemo && (
            <AssignRoleButton
              onAdded={() =>
                qc.invalidateQueries({ queryKey: ["user-roles", isDemo ? "demo" : "remote"] })
              }
            />
          )
        }
      >
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("no_role_assignments_yet")}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-slate-800 text-left text-xs font-semibold text-white">
                    <th className="w-16 px-3 py-2">{t("id")}</th>
                    <th className="px-3 py-2">{t("user_name")}</th>
                    <th className="px-3 py-2">{t("email")}</th>
                    <th className="px-3 py-2">{t("role_as")}</th>
                    {isAdmin && <th className="w-36 px-3 py-2">{t("password")}</th>}
                    {isAdmin && <th className="w-24 px-3 py-2">{t("actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r, index) => {
                    const displayId =
                      sortedRows.length - ((safePage - 1) * ROLE_REPORT_PAGE_SIZE + index);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/70 text-xs hover:bg-muted/40"
                      >
                        <td className="px-3 py-2 font-mono">{displayId}</td>
                        <td className="px-3 py-2 font-semibold">{r.profiles?.full_name ?? "—"}</td>
                        <td className="px-3 py-2">{r.profiles?.email ?? "—"}</td>
                        <td className="px-3 py-2">{roleLabel(r.role, t)}</td>
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setPasswordUser(r)}
                              disabled={isDemo}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              {t("update")}
                            </button>
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <button
                              onClick={() => {
                                if (confirm(t("remove_role_confirm"))) del.mutate(r.id);
                              }}
                              disabled={isDemo || del.isPending || r.role === "admin"}
                              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {t("delete")}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Showing {visibleRows.length} of {sortedRows.length}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={
                      "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors " +
                      (safePage === pageNumber
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface text-muted-foreground hover:bg-muted")
                    }
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </SectionCard>
      {passwordUser && (
        <UpdatePasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      )}
    </div>
  );
}

function UpdatePasswordModal({ user, onClose }: { user: RoleRow; onClose: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error(t("password_min_6"));
      if (password !== confirmPassword) throw new Error(t("passwords_do_not_match"));

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(t("admin_session_expired_login"));
      }

      return updateUserPassword({
        data: {
          accessToken: session.access_token,
          userId: user.user_id,
          password,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("password_updated"));
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">{t("update_password")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.profiles?.full_name ?? t("user")} · {roleLabel(user.role, t)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          {t("secure_password_hash_notice")}
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updatePassword.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              {t("new_password")}
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="new-password"
                minLength={6}
                required
                className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label={showPassword ? t("hide_password") : t("show_password")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              {t("confirm_password")}
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              autoComplete="new-password"
              minLength={6}
              required
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={updatePassword.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {updatePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("update_password")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignRoleButton({ onAdded }: { onAdded: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ user_id: "", role: "teacher" as "teacher" | "student" });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,full_name,email")
        .order("full_name");
      return data ?? [];
    },
  });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: f.user_id, role: f.role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("role_assigned"));
      setOpen(false);
      onAdded();
    },
    onError: (e) => toast.error(e.message),
  });
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> {t("assign_role")}
      </button>
    );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 font-display text-lg font-bold">{t("assign_role")}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.user_id) return toast.error(t("pick_user"));
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("user")}
            </label>
            <select
              value={f.user_id}
              onChange={(e) => setF({ ...f, user_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">— {t("select")} —</option>
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name} ({p.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("role")}
            </label>
            <select
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as typeof f.role })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="teacher">{t("teacher")}</option>
              <option value="student">{t("student")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("assign_role")}
          </button>
        </form>
      </div>
    </div>
  );
}
