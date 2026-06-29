-- Add time-based risk assessment configuration to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS imminent_booking_threshold_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS short_term_horizon_minutes integer DEFAULT 120,
ADD COLUMN IF NOT EXISTS large_party_lead_time_threshold_minutes integer DEFAULT 240,
ADD COLUMN IF NOT EXISTS enable_time_based_group_protection boolean DEFAULT true;

COMMENT ON COLUMN public.company_settings.imminent_booking_threshold_minutes IS 'Threshold in minutes for considering a booking "imminent" (safe to use table groups)';
COMMENT ON COLUMN public.company_settings.short_term_horizon_minutes IS 'Short-term horizon in minutes for moderate table group protection';
COMMENT ON COLUMN public.company_settings.large_party_lead_time_threshold_minutes IS 'Typical lead time in minutes that large parties book ahead';
COMMENT ON COLUMN public.company_settings.enable_time_based_group_protection IS 'Enable time-based risk assessment for table group usage';