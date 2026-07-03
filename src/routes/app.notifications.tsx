import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, SectionCard } from "@/components/app/ui";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Bell, Plus, Loader2, X, ImageIcon, Video, Upload } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pageTitle } from "@/lib/brand";
import { decodeNotificationContent, encodeNotificationContent } from "@/lib/notification-content";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: pageTitle("Notifications") }] }),
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  kind: "info" | "warning" | "success" | "announcement";
  created_at: string;
  target_role: "admin" | "teacher" | "student" | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read media."));
    reader.readAsDataURL(file);
  });
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
        subtitle={t("announcements_alerts")}
        actions={
          isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow"
            >
              <Plus className="h-4 w-4" /> {t("announce")}
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
            <p className="mt-2 text-sm text-muted-foreground">{t("no_notifications_yet")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="py-4">
                {(() => {
                  const content = decodeNotificationContent(n.body);
                  const targetRole = n.target_role ?? content.targetRole;
                  const mediaUrl = n.media_url ?? content.mediaUrl;
                  const mediaType = n.media_type ?? content.mediaType;
                  return (
                <div className="flex items-start gap-3">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {targetRole && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">
                          {t(targetRole)}
                        </span>
                      )}
                    </div>
                    {mediaUrl && mediaType === "image" && (
                      <img
                        src={mediaUrl}
                        alt={n.title}
                        className="mt-3 max-h-[420px] w-full max-w-3xl rounded-lg border border-border object-contain bg-muted/30"
                      />
                    )}
                    {mediaUrl && mediaType === "video" && (
                      <video
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        className="mt-3 max-h-[460px] w-full max-w-3xl rounded-lg border border-border bg-black"
                      />
                    )}
                    {content.description && (
                      <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {content.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
                  );
                })()}
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
  const { t } = useI18n();
  const { session } = useAuth();
  const [f, setF] = useState({
    title: "",
    body: "",
    kind: "announcement" as "info" | "warning" | "success" | "announcement",
    targetRole: "student" as "all" | "student" | "teacher",
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const mediaType = mediaFile?.type.startsWith("video/") ? "video" : mediaFile ? "image" : null;

  const mut = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        const mediaUrl = mediaFile
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error(t("upload")));
              reader.readAsDataURL(mediaFile);
            })
          : null;
        writeDemoNotifications([
          {
            id: `demo-notification-${Date.now()}`,
            title: f.title,
            body: f.body || null,
            kind: f.kind,
            created_at: new Date().toISOString(),
            target_role: f.targetRole === "all" ? null : f.targetRole,
            media_url: mediaUrl,
            media_type: mediaType,
          },
          ...readDemoNotifications(),
        ]);
        return;
      }

      if (!session?.access_token || !session.user?.id) {
        throw new Error(t("admin_session_expired_login"));
      }

      let mediaUrl: string | null = null;
      let uploadedMediaType: "image" | "video" | null = null;
      if (mediaFile) {
        if (mediaFile.size > 25 * 1024 * 1024) {
          throw new Error(t("media_size_limit"));
        }
        mediaUrl = await fileToDataUrl(mediaFile);
        uploadedMediaType = mediaType;
      }

      const targetRole = f.targetRole === "all" ? null : f.targetRole;
      const richPayload = {
        title: f.title,
        body: f.body || null,
        kind: f.kind,
        target_user_id: null,
        target_role: targetRole,
        media_url: mediaUrl,
        media_type: uploadedMediaType,
        created_by: session.user.id,
      };
      const { error } = await supabase.from("notifications").insert(richPayload);
      if (!error) return;

      const missingRichColumns =
        error.message.includes("media_type") ||
        error.message.includes("media_url") ||
        error.message.includes("target_role") ||
        error.code === "PGRST204";
      if (!missingRichColumns) throw error;

      const encodedBody = encodeNotificationContent({
        description: f.body,
        mediaUrl,
        mediaType: uploadedMediaType,
        targetRole,
      });

      if (!targetRole) {
        const { error: fallbackError } = await supabase.from("notifications").insert({
          title: f.title,
          body: encodedBody,
          kind: f.kind,
          target_user_id: null,
          created_by: session.user.id,
        });
        if (fallbackError) throw fallbackError;
        return;
      }

      const { data: recipients, error: recipientsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", targetRole);
      if (recipientsError) throw recipientsError;
      if (!recipients?.length) throw new Error(`No ${targetRole} accounts found.`);

      const { error: fallbackError } = await supabase.from("notifications").insert(
        recipients.map((recipient) => ({
          title: f.title,
          body: encodedBody,
          kind: f.kind,
          target_user_id: recipient.user_id,
          created_by: session.user.id,
        })),
      );
      if (fallbackError) throw fallbackError;
    },
    onSuccess: () => {
      toast.success(isDemo ? t("demo_announcement_added") : t("sent"));
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
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">{t("new_announcement")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("send_media_notice")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.title) return toast.error(t("title_required"));
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("send_to")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "teacher", "all"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setF({ ...f, targetRole: role })}
                  className={
                    "h-10 rounded-lg border text-xs font-semibold capitalize transition-colors " +
                    (f.targetRole === role
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface hover:bg-muted")
                  }
                >
                  {role === "all" ? t("everyone") : t(role)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("title")} *
            </label>
            <input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("message")}
            </label>
            <textarea
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
              rows={5}
              placeholder={t("write_description_media")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("image_or_video")}
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-sm font-semibold hover:bg-muted">
              <Upload className="h-4 w-4" />
              {t("choose_image_or_video")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  if (file && file.size > 25 * 1024 * 1024) {
                    toast.error(t("media_size_limit"));
                    return;
                  }
                  setMediaFile(file);
                  setMediaPreview(file ? URL.createObjectURL(file) : "");
                }}
              />
            </label>
            {mediaPreview && mediaType === "image" && (
              <div className="relative mt-3">
                <img
                  src={mediaPreview}
                  alt={t("new_announcement")}
                  className="max-h-64 w-full rounded-lg border border-border object-contain bg-muted/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview("");
                  }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-black/65 text-white"
                  aria-label={t("remove_image")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {mediaPreview && mediaType === "video" && (
              <div className="relative mt-3">
                <video
                  src={mediaPreview}
                  controls
                  className="max-h-64 w-full rounded-lg border border-border bg-black"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview("");
                  }}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-black/65 text-white"
                  aria-label={t("remove_video")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {mediaFile && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                {mediaType === "video" ? (
                  <Video className="h-3.5 w-3.5" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {mediaFile.name} · {(mediaFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("kind")}
            </label>
            <select
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="announcement">{t("announcement")}</option>
              <option value="info">{t("info")}</option>
              <option value="warning">{t("warning")}</option>
              <option value="success">{t("success")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("send")}
          </button>
        </form>
      </div>
    </div>
  );
}
