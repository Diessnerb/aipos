-- Create a standardized PIN validation function that returns user info
DROP FUNCTION IF EXISTS public.authenticate_by_pin_for_company_secure(pin_input text, company_id_input uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company_secure(pin_input text, company_id_input uuid)
RETURNS TABLE(user_id uuid, user_name text, company_id uuid, user_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate PIN against company users
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.full_name as user_name,
    u.company_id,
    u.role as user_role
  FROM public.users u
  WHERE u.pin_code = pin_input
    AND u.company_id = company_id_input  
    AND u.is_active = true;
    
  -- Log the validation attempt
  IF NOT FOUND THEN
    RAISE LOG 'PIN validation failed for company: %, pin provided: %', company_id_input, (pin_input IS NOT NULL);
  ELSE
    RAISE LOG 'PIN validation successful for company: %', company_id_input;
  END IF;
END;
$$;