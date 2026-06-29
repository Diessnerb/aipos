-- Create index for performance on active users queries
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Update the authenticate_by_pin function to only allow active users
CREATE OR REPLACE FUNCTION public.authenticate_by_pin(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id
  FROM users u
  WHERE u.pin_code = pin_input 
    AND u.is_active = true
  LIMIT 1;
END;
$function$;