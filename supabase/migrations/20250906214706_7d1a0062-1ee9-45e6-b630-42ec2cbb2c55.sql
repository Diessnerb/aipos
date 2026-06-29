-- Fix get_company_for_pin_user to hash PIN input before comparison
CREATE OR REPLACE FUNCTION public.get_company_for_pin_user(pin_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_uuid uuid;
  hashed_input text;
BEGIN
  -- Hash the input PIN for comparison
  hashed_input := public.hash_pin_md5(pin_input);
  
  -- Check owner PIN first
  SELECT id INTO company_uuid
  FROM companies
  WHERE owner_pin = hashed_input
    AND status = 'active';
    
  IF company_uuid IS NOT NULL THEN
    RETURN company_uuid;
  END IF;
  
  -- Check user PIN
  SELECT company_id INTO company_uuid
  FROM users
  WHERE pin_code = hashed_input
    AND is_active = true;
    
  RETURN company_uuid;
END;
$$;