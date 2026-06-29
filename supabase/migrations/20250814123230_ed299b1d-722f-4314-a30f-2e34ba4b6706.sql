-- Add auto_assign_tables field to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS auto_assign_tables boolean NOT NULL DEFAULT false;