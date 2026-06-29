-- Extend menu_items table with POS sync fields
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS external_pos_id text,
ADD COLUMN IF NOT EXISTS pos_sync_status text DEFAULT 'not_synced' CHECK (pos_sync_status IN ('not_synced', 'syncing', 'synced', 'conflict', 'error')),
ADD COLUMN IF NOT EXISTS last_pos_sync timestamp with time zone,
ADD COLUMN IF NOT EXISTS sync_conflicts jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pos_metadata jsonb DEFAULT '{}';

-- Extend menu_categories table with POS sync fields  
ALTER TABLE public.menu_categories
ADD COLUMN IF NOT EXISTS external_pos_id text,
ADD COLUMN IF NOT EXISTS pos_sync_status text DEFAULT 'not_synced' CHECK (pos_sync_status IN ('not_synced', 'syncing', 'synced', 'conflict', 'error')),
ADD COLUMN IF NOT EXISTS last_pos_sync timestamp with time zone,
ADD COLUMN IF NOT EXISTS sync_conflicts jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pos_metadata jsonb DEFAULT '{}';

-- Create pos_sync_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.pos_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  pos_system text NOT NULL,
  sync_direction text NOT NULL CHECK (sync_direction IN ('to_pos', 'from_pos', 'bidirectional')),
  entity_type text NOT NULL CHECK (entity_type IN ('menu_item', 'menu_category', 'full_menu')),
  entity_id uuid,
  external_entity_id text,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'import')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'conflict')),
  data_before jsonb,
  data_after jsonb,
  error_details text,
  conflict_reason text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'
);

-- Create pos_credentials table for secure credential storage
CREATE TABLE IF NOT EXISTS public.pos_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  pos_system text NOT NULL,
  connection_status text NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected', 'connecting', 'connected', 'error')),
  encrypted_credentials jsonb NOT NULL,
  connection_metadata jsonb DEFAULT '{}',
  last_connected_at timestamp with time zone,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, pos_system)
);

-- Create pos_sync_queue table for managing sync operations
CREATE TABLE IF NOT EXISTS public.pos_sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  pos_system text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('sync_to_pos', 'sync_from_pos', 'initial_import')),
  entity_type text NOT NULL CHECK (entity_type IN ('menu_item', 'menu_category', 'full_menu')),
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  error_details text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.pos_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sync_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pos_sync_logs
CREATE POLICY "pos_sync_logs_company_isolation" ON public.pos_sync_logs
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create RLS policies for pos_credentials
CREATE POLICY "pos_credentials_company_isolation" ON public.pos_credentials
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create RLS policies for pos_sync_queue
CREATE POLICY "pos_sync_queue_company_isolation" ON public.pos_sync_queue
FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_pos_sync ON public.menu_items(company_id, pos_sync_status, external_pos_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_pos_sync ON public.menu_categories(company_id, pos_sync_status, external_pos_id);
CREATE INDEX IF NOT EXISTS idx_pos_sync_logs_company_entity ON public.pos_sync_logs(company_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pos_sync_logs_status ON public.pos_sync_logs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pos_credentials_company_system ON public.pos_credentials(company_id, pos_system);
CREATE INDEX IF NOT EXISTS idx_pos_sync_queue_processing ON public.pos_sync_queue(status, priority, scheduled_at);

-- Create trigger for updated_at on pos_credentials
CREATE TRIGGER update_pos_credentials_updated_at
BEFORE UPDATE ON public.pos_credentials
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();