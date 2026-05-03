
CREATE POLICY "staff read thumbnails" ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails' AND public.is_sala_user());
CREATE POLICY "staff insert thumbnails" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND public.is_sala_user());
CREATE POLICY "staff update thumbnails" ON storage.objects FOR UPDATE
  USING (bucket_id = 'thumbnails' AND public.is_sala_user());
CREATE POLICY "staff delete thumbnails" ON storage.objects FOR DELETE
  USING (bucket_id = 'thumbnails' AND public.is_sala_user());
