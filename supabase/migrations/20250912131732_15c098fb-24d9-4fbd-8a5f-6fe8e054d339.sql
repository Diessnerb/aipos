-- Add POS sync fields to tables table
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS external_pos_id text,
ADD COLUMN IF NOT EXISTS pos_sync_status text DEFAULT 'not_synced',
ADD COLUMN IF NOT EXISTS pos_metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_pos_sync timestamp with time zone;

-- Add POS table sync logs table
CREATE TABLE IF NOT EXISTS public.pos_table_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  pos_system text NOT NULL,
  operation text NOT NULL,
  table_id uuid,
  external_table_id text,
  status text NOT NULL DEFAULT 'success',
  data_before jsonb,
  data_after jsonb,
  error_details text,
  processed_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.pos_table_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for pos_table_sync_logs
CREATE POLICY "pos_table_sync_logs_company_isolation" 
ON public.pos_table_sync_logs 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));