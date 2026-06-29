-- Fix the company isolation trigger to allow service role operations
-- This addresses the "No company association found" error when using external API

-- First, create a function that allows service role to bypass auth checks
CREATE OR REPLACE FUNCTION public.validate_company_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role or system migrations/cron jobs (auth.uid() is null) to bypass validation
  IF (current_setting('role', true) = 'service_role' AND NEW.company_id IS NOT NULL) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Regular user validation - require company association
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  
  -- If still null after trying to get from user, reject
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'No company association found for user';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS validate_company_isolation ON public.reservations;

-- Create new trigger for company isolation validation
CREATE TRIGGER validate_company_isolation
    BEFORE INSERT OR UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_company_isolation();