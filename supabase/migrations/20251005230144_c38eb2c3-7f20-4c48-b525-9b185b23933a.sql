-- Fix get_company_for_pin_user to use SHA-256 for user PINs (matching authenticate_by_pin_for_company_secure)
CREATE OR REPLACE FUNCTION public.get_company_for_pin_user(pin_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_uuid uuid;
  hashed_input_sha256 text;
  hashed_input_md5 text;
  password_hashed_input text;
  plain_md5_input text;
BEGIN
  -- Hash using SHA-256 (current standard for user PINs)
  hashed_input_sha256 := encode(extensions.digest(convert_to(pin_input, 'UTF8'), 'sha256'), 'hex');
  
  -- Legacy hashing for backwards compatibility
  hashed_input_md5 := public.hash_pin_md5(pin_input);
  password_hashed_input := public.hash_password_md5(pin_input);
  plain_md5_input := md5(pin_input);
  
  -- Check owner PIN with multiple hash attempts (owners might use various formats)
  SELECT id INTO company_uuid
  FROM companies
  WHERE (
    owner_pin = hashed_input_sha256 OR
    owner_pin = hashed_input_md5 OR 
    owner_pin = password_hashed_input OR 
    owner_pin = plain_md5_input OR
    owner_pin = pin_input
  )
  AND status = 'active';
    
  IF company_uuid IS NOT NULL THEN
    RETURN company_uuid;
  END IF;
  
  -- Check user PIN - prioritize SHA-256, fallback to MD5 for legacy
  SELECT company_id INTO company_uuid
  FROM users
  WHERE (pin_code = hashed_input_sha256 OR pin_code = hashed_input_md5)
    AND is_active = true;
    
  RETURN company_uuid;
END;
$$;