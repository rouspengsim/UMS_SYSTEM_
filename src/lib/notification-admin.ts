import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { encodeNotificationContent } from "@/lib/notification-content";

type AppRole = Database["public"]["Enums"]["app_role"];
type NotificationKind = Database["public"]["Enums"]["notification_kind"];

type CreateUploadInput = {
  accessToken: string;
  fileName: string;
  contentType: string;
};

type CreateNotificationInput = {
  accessToken: string;
  title: string;
  body: string;
  kind: NotificationKind;
  targetRole: AppRole | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

async function requireAdmin(accessToken: string) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    throw new Error("Your admin session expired. Please log in again.");
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) throw new Error("Only admins can send announcements.");

  return authData.user;
}

export const createNotificationMediaUpload = createServerFn({ method: "POST" })
  .inputValidator((input: CreateUploadInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const fileName = requireString(data.fileName, "File name");
    const contentType = requireString(data.contentType, "File type");
    await requireAdmin(accessToken);

    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");
    if (!isImage && !isVideo) throw new Error("Choose an image or video file.");

    const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("notification-media")
      .createSignedUploadUrl(path);
    if (error) throw error;

    return {
      path,
      token: signed.token,
      mediaType: (isImage ? "image" : "video") as "image" | "video",
    };
  });

export const createAdminNotification = createServerFn({ method: "POST" })
  .inputValidator((input: CreateNotificationInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Admin session");
    const title = requireString(data.title, "Title");
    const user = await requireAdmin(accessToken);

    const richPayload = {
      title,
      body: data.body.trim() || null,
      kind: data.kind,
      target_user_id: null,
      target_role: data.targetRole,
      media_url: data.mediaUrl,
      media_type: data.mediaType,
      created_by: user.id,
    };
    const { error } = await supabaseAdmin.from("notifications").insert(richPayload);
    if (!error) return;

    const missingRichColumns =
      error.message.includes("media_type") ||
      error.message.includes("media_url") ||
      error.message.includes("target_role") ||
      error.code === "PGRST204";
    if (!missingRichColumns) throw error;

    const encodedBody = encodeNotificationContent({
      description: data.body.trim(),
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      targetRole: data.targetRole,
    });

    if (!data.targetRole) {
      const { error: fallbackError } = await supabaseAdmin.from("notifications").insert({
        title,
        body: encodedBody,
        kind: data.kind,
        target_user_id: null,
        created_by: user.id,
      });
      if (fallbackError) throw fallbackError;
      return;
    }

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", data.targetRole);
    if (recipientsError) throw recipientsError;
    if (!recipients?.length) throw new Error(`No ${data.targetRole} accounts found.`);

    const { error: fallbackError } = await supabaseAdmin.from("notifications").insert(
      recipients.map((recipient) => ({
        title,
        body: encodedBody,
        kind: data.kind,
        target_user_id: recipient.user_id,
        created_by: user.id,
      })),
    );
    if (fallbackError) throw fallbackError;
  });
