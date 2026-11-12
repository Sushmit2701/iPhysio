-- Optional: call the send-reminders Edge Function every 5 minutes.
-- Needs the pg_cron and pg_net extensions (Database, Extensions in the dashboard).
-- Replace <PROJECT_REF> and <CRON_SECRET> (the same secret you set on the function) before running.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'elbow-send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
