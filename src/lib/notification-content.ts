const RICH_NOTIFICATION_PREFIX = "__STUDENTSPHERE_RICH_NOTIFICATION__:";

export type RichNotificationContent = {
  description: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  targetRole: "admin" | "teacher" | "student" | null;
};

export function encodeNotificationContent(content: RichNotificationContent) {
  return `${RICH_NOTIFICATION_PREFIX}${JSON.stringify(content)}`;
}

export function decodeNotificationContent(
  body: string | null | undefined,
): RichNotificationContent {
  if (!body?.startsWith(RICH_NOTIFICATION_PREFIX)) {
    return {
      description: body ?? "",
      mediaUrl: null,
      mediaType: null,
      targetRole: null,
    };
  }

  try {
    const parsed = JSON.parse(
      body.slice(RICH_NOTIFICATION_PREFIX.length),
    ) as RichNotificationContent;
    return {
      description: parsed.description ?? "",
      mediaUrl: parsed.mediaUrl ?? null,
      mediaType:
        parsed.mediaType === "image" || parsed.mediaType === "video" ? parsed.mediaType : null,
      targetRole: parsed.targetRole ?? null,
    };
  } catch {
    return { description: "", mediaUrl: null, mediaType: null, targetRole: null };
  }
}
