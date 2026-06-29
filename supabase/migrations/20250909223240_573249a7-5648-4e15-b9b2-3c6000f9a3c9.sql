-- Add accessible_spare_target to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS accessible_spare_target integer DEFAULT 1 CHECK (accessible_spare_target >= 0 AND accessible_spare_target <= 10);

COMMENT ON COLUMN public.company_settings.accessible_spare_target IS 'Number of accessible tables to keep as spare for accessibility needs (0-10)';