-- Create wrapper function for authenticate_by_pin_secure that delegates to v2
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to the v2 function which uses proper hashing
  RETURN QUERY
  SELECT * FROM public.authenticate_by_pin_secure_v2(pin_input);
END;
$function$;

-- Ensure tables have proper company_id and is_active defaults
CREATE OR REPLACE FUNCTION public.set_table_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Set company_id if not provided
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  
  -- Set is_active default
  IF NEW.is_active IS NULL THEN
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for table defaults
DROP TRIGGER IF EXISTS set_table_defaults_trigger ON public.tables;
CREATE TRIGGER set_table_defaults_trigger
  BEFORE INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_table_defaults();

-- Backfill existing tables with correct company_id and is_active for the bound company
UPDATE public.tables 
SET 
  company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731',
  is_active = COALESCE(is_active, true)
WHERE company_id IS NULL OR is_active IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tables_company_active 
ON public.tables(company_id, is_active) 
WHERE is_active = true;