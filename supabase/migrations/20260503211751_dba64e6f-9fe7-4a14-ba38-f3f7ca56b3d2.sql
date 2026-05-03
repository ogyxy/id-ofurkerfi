-- Avatars storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (avatars are public images shown across the app)
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to a folder named by their user id
CREATE POLICY "avatars user insert own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_sala_user()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars user update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND public.is_sala_user()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars user delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND public.is_sala_user()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );