-- Enable replica identity for company_settings to capture full row data in realtime
ALTER TABLE public.company_settings REPLICA IDENTITY FULL;

-- Add company_settings to the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'company_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;
  END IF;
END $$;