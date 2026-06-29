-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the continuous optimizer to run every 5 minutes
-- This will invoke the edge function to optimize table assignments across all companies
SELECT cron.schedule(
  'continuous-table-optimizer',        -- job name
  '*/5 * * * *',                      -- every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsc3Jwb3d2dXhjdmhxa2V5a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM5MjIsImV4cCI6MjA2NDM0OTkyMn0.UlbQLERTz2JTQCNu111gVaFj4PJn1DO4wO5w7x3JjrA"}'::jsonb,
      body := '{"automated": true}'::jsonb
    ) as request_id;
  $$
);