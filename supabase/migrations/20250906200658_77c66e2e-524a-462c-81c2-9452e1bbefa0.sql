-- Harden company_settings schema for permanent persistence
-- Make optimization_enabled NOT NULL with default
ALTER TABLE public.company_settings 
ALTER COLUMN optimization_enabled SET DEFAULT false;

UPDATE public.company_settings 
SET optimization_enabled = false 
WHERE optimization_enabled IS NULL;

ALTER TABLE public.company_settings 
ALTER COLUMN optimization_enabled SET NOT NULL;

-- Make optimization_mode default to 'disabled'
ALTER TABLE public.company_settings 
ALTER COLUMN optimization_mode SET DEFAULT 'disabled';

UPDATE public.company_settings 
SET optimization_mode = 'disabled' 
WHERE optimization_mode IS NULL;

-- Add unique constraint on company_id to ensure one settings record per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_company_id 
ON public.company_settings(company_id);

-- Ensure auto_assign_tables has proper default
ALTER TABLE public.company_settings 
ALTER COLUMN auto_assign_tables SET DEFAULT false;