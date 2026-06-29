-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule check-course-duration-timers edge function to run every 1 minute
-- This automatically transitions reservations from eating → clear status based on party size durations
SELECT cron.schedule(
  'check-course-duration-timers-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/check-course-duration-timers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsc3Jwb3d2dXhjdmhxa2V5a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM5MjIsImV4cCI6MjA2NDM0OTkyMn0.UlbQLERTz2JTQCNu111gVaFj4PJn1DO4wO5w7x3JjrA'
      ),
      body := jsonb_build_object('automated', true)
    ) as request_id;
  $$
);