SELECT cron.unschedule('payday_sync_all_15min');

SELECT cron.schedule(
  'payday_sync_all_15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://whhckmzqeniizdkwgznf.supabase.co/functions/v1/payday-sync-all',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaGNrbXpxZW5paXpka3dnem5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDU4MjIsImV4cCI6MjA5MjcyMTgyMn0.diNYsixfHFXraEdu8EnrIZu-5Wb_6O1uD46zNlxy9ls',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaGNrbXpxZW5paXpka3dnem5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDU4MjIsImV4cCI6MjA5MjcyMTgyMn0.diNYsixfHFXraEdu8EnrIZu-5Wb_6O1uD46zNlxy9ls'
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
  $$
);