-- Add owner_pin field to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS owner_pin text;

-- Add unique constraint to ensure owner PIN is unique across all companies
CREATE UNIQUE INDEX idx_companies_owner_pin ON public.companies(owner_pin) 
WHERE owner_pin IS NOT NULL;

-- Update authenticate_by_pin function to check both user PINs and owner PINs
DROP FUNCTION IF EXISTS public.authenticate_by_pin(pin_input text);
CREATE OR REPLACE FUNCTION public.authenticate_by_pin(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- First check for regular user PINs
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  FROM users u
  WHERE u.pin_code = pin_input 
    AND u.is_active = true
  LIMIT 1;

  -- If no user found, check for owner PIN
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      gen_random_uuid() as user_id, -- Generate temporary ID for owner
      c.default_admin_email as email,
      'Restaurant Owner' as full_name,
      'owner' as role,
      c.id as company_id,
      true as is_owner
    FROM companies c
    WHERE c.owner_pin = pin_input
      AND c.status = 'active'
    LIMIT 1;
  END IF;
END;
$function$;