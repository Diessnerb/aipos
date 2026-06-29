-- Fix idle timeout configuration for tablet stability
-- Update any companies with aggressive timeout (30 seconds or less) to minimum 15 minutes (900 seconds)
UPDATE company_settings 
SET pin_idle_timeout_seconds = 900 
WHERE pin_idle_timeout_seconds <= 30;

-- Add constraint to ensure minimum timeout is 60 seconds to prevent immediate logouts on mobile
ALTER TABLE company_settings 
ADD CONSTRAINT check_pin_idle_timeout_minimum 
CHECK (pin_idle_timeout_seconds >= 60);