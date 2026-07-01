-- Rich announcements targeted to students, teachers, or everyone.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_role public.app_role,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_media_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'video'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notification-media',
  'notification-media',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Read notifications" ON public.notifications;

CREATE POLICY "Read notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR target_user_id = auth.uid()
    OR (
      target_user_id IS NULL
      AND (
        target_role IS NULL
        OR public.has_role(auth.uid(), target_role)
      )
    )
  );

NOTIFY pgrst, 'reload schema';
