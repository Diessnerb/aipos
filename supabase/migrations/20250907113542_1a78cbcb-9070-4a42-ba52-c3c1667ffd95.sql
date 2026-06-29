-- Add idle timeout setting to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS pin_idle_timeout_seconds integer NOT NULL DEFAULT 30;