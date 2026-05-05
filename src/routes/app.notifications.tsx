import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Bell, Plus, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — RULE" }] }),
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  kind: "info" | "warning" | "success" | "announcement";
  created_at: string;
};

const DEMO_NOTIFICATIONS_KEY = "studentsphere.demo.notifications";

function readDemoNotifications(): NotificationRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_NOTIFICATIONS_KEY);
    return raw ? (JSON.parse(raw) as NotificationRow[]) : [];
  } catch {
    return [];
  }
}

function writeDemoNotifications(notifications: NotificationRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function NotificationsPage() {
  const { t } = useI18n();
  const { primaryRole, isDemo } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const isAdmin = primaryRole === "admin";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications-list", isDemo ? "demo" : "remote"],
    queryFn: async () => {
      if (isDemo) return readDemoNotifications();

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title={t("notifications")}
        subtitle="Announcements and alerts"
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> Announce
            </button>
          )
        }
      />
      <SectionCard>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No notifications.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span
                  className={
                    "mt-1 h-2 w-2 shrink-0 rounded-full " +
                    (n.kind === "warning"
                      ? "bg-warning"
                      : n.kind === "success"
                        ? "bg-success"
                        : n.kind === "announcement"
                          ? "bg-primary"
                          : "bg-info")
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {showAdd && (
        <AddNotif
          isDemo={isDemo}
          onClose={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["notifications-list", isDemo ? "demo" : "remote"] });
            qc.invalidateQueries({ queryKey: ["topbar-notifications"] });
          }}
        />
      )}
    </div>
  );
}

function AddNotif({ isDemo, onClose }: { isDemo: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    title: "",
    body: "",
    kind: "announcement" as "info" | "warning" | "success" | "announcement",
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        writeDemoNotifications([
          {
            id: `demo-notification-${Date.now()}`,
            title: f.title,
            body: f.body || null,
            kind: f.kind,
            created_at: new Date().toISOString(),
          },
          ...readDemoNotifications(),
        ]);
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .insert({ title: f.title, body: f.body || null, kind: f.kind, target_user_id: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isDemo ? "Demo announcement added" : "Sent");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">New announcement</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.title) return toast.error("Title required");
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title *
            </label>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message
            </label>
            <textarea
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kind
            </label>
            <select
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="announcement">Announcement</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
