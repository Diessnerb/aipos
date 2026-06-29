-- Update get_company_for_pin_user to handle multiple hashing scenarios
CREATE OR REPLACE FUNCTION public.get_company_for_pin_user(pin_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_uuid uuid;
  hashed_input text;
  password_hashed_input text;
  plain_md5_input text;
BEGIN
  -- Try multiple hashing approaches for backwards compatibility
  hashed_input := public.hash_pin_md5(pin_input);
  password_hashed_input := public.hash_password_md5(pin_input);
  plain_md5_input := md5(pin_input);
  
  -- Check owner PIN with multiple hash attempts
  SELECT id INTO company_uuid
  FROM companies
  WHERE (
    owner_pin = hashed_input OR 
    owner_pin = password_hashed_input OR 
    owner_pin = plain_md5_input OR
    owner_pin = pin_input  -- fallback for unhashed pins
  )
  AND status = 'active';
    
  IF company_uuid IS NOT NULL THEN
    RETURN company_uuid;
  END IF;
  
  -- Check user PIN (should already be properly hashed)
  SELECT company_id INTO company_uuid
  FROM users
  WHERE pin_code = hashed_input
    AND is_active = true;
    
  RETURN company_uuid;
END;
$$;