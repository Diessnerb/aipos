-- Add continuous optimization settings to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS optimization_horizon_days integer DEFAULT 90;
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS optimization_mode text DEFAULT 'continuous';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS quiet_hours_start time DEFAULT '00:00:00';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS quiet_hours_end time DEFAULT '06:00:00';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS strategic_optimization_enabled boolean DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN public.company_settings.optimization_horizon_days IS 'How many days ahead to optimize (default: 90)';
COMMENT ON COLUMN public.company_settings.optimization_mode IS 'continuous, reactive, or disabled';
COMMENT ON COLUMN public.company_settings.quiet_hours_start IS 'Start time for heavy optimization processing';
COMMENT ON COLUMN public.company_settings.quiet_hours_end IS 'End time for heavy optimization processing';
COMMENT ON COLUMN public.company_settings.strategic_optimization_enabled IS 'Enable heavy lifting during quiet hours';