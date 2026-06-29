-- Add setup tracking fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_path text DEFAULT NULL, -- 'pos' or 'manual'
ADD COLUMN IF NOT EXISTS setup_started_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS first_admin_login_at timestamp with time zone DEFAULT NULL;

-- Update trigger to set first_admin_login_at when a company admin logs in for the first time
CREATE OR REPLACE FUNCTION public.track_first_admin_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update company's first login timestamp if this is the first admin login
  IF NEW.is_company_admin = true AND OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.companies 
    SET first_admin_login_at = NEW.last_sign_in_at
    WHERE id = NEW.company_id AND first_admin_login_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on users table to track first admin login
DROP TRIGGER IF EXISTS track_first_admin_login_trigger ON public.users;
CREATE TRIGGER track_first_admin_login_trigger
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.track_first_admin_login();