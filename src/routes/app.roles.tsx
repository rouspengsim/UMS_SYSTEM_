import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, GraduationCap, User, Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

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

function RolesPage() {
  const { t } = useI18n();
  const { primaryRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = primaryRole === "admin";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
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

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Role removed");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title={t("roles")} subtitle="Who has access to what" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { role: "admin", icon: ShieldCheck, desc: "Full access to all data and management" },
          { role: "teacher", icon: GraduationCap, desc: "Manage attendance, exams, scores" },
          { role: "student", icon: User, desc: "View own data and certificates" },
        ].map((r) => (
          <div key={r.role} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="h-5 w-5" />
              </div>
              <p className="font-semibold capitalize">{r.role}</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{r.desc}</p>
            <p className="mt-2 text-xs">
              <span className="font-semibold">{rows.filter((x) => x.role === r.role).length}</span>{" "}
              users
            </p>
          </div>
        ))}
      </div>
      <SectionCard
        title="User roles"
        action={
          isAdmin && (
            <AssignRoleButton onAdded={() => qc.invalidateQueries({ queryKey: ["user-roles"] })} />
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{r.profiles?.full_name ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">{r.profiles?.email ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                      {r.role}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (confirm("Remove this role?")) del.mutate(r.id);
                        }}
                        className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
