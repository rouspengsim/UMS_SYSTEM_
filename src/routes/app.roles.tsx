import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/app/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions — RULE" }] }),
  component: RolesPage,
});

type RoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "teacher" | "student";
  profiles: { full_name: string; email: string | null } | null;
};

const ROLE_REPORT_PAGE_SIZE = 10;

function roleLabel(role: RoleRow["role"]) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Teacher";
  return "Student";
}

function RolesPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo, profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = primaryRole === "admin";
  const [page, setPage] = useState(1);

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
    () => [...rows].sort((a, b) => roleLabel(a.role).localeCompare(roleLabel(b.role))),
    [rows],
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
      toast.success("Role removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={t("roles")} subtitle="User role report and access assignments" />
      <SectionCard
        title="របាយការណ៍ អ្នកប្រើប្រាស់"
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
          <p className="py-8 text-center text-sm text-muted-foreground">No role assignments yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-slate-800 text-left text-xs font-semibold text-white">
                    <th className="w-16 px-3 py-2">ID</th>
                    <th className="px-3 py-2">User Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role as</th>
                    {isAdmin && <th className="w-32 px-3 py-2">Actions</th>}
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
                        <td className="px-3 py-2">{roleLabel(r.role)}</td>
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <button
                              onClick={() => {
                                if (confirm("Remove this role?")) del.mutate(r.id);
                              }}
                              disabled={isDemo || del.isPending}
                              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
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
    </div>
  );
}

function AssignRoleButton({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ user_id: "", role: "teacher" as "admin" | "teacher" | "student" });
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
      toast.success("Role assigned");
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
        <Plus className="h-3.5 w-3.5" /> Assign role
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
        <h3 className="mb-4 font-display text-lg font-bold">Assign role</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.user_id) return toast.error("Pick a user");
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              User
            </label>
            <select
              value={f.user_id}
              onChange={(e) => setF({ ...f, user_id: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">— Select —</option>
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name} ({p.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Role
            </label>
            <select
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as typeof f.role })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
          </button>
        </form>
      </div>
    </div>
  );
}
