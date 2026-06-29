-- Drop and recreate the function with proper timestamp casting
DROP FUNCTION IF EXISTS get_all_users_cross_company();

CREATE OR REPLACE FUNCTION get_all_users_cross_company()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  company_name text,
  company_id uuid,
  is_company_admin boolean,
  created_at timestamp with time zone,
  last_login timestamp with time zone,
  pin_code text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only super admins can access cross-company user data
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized - not a super admin';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.role,
    u.is_active,
    c.name as company_name,
    u.company_id,
    u.is_company_admin,
    u.created_at AT TIME ZONE 'UTC' as created_at,
    au.last_sign_in_at as last_login,
    u.pin_code
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  WHERE u.is_active = true
  ORDER BY u.created_at DESC;
END;
$$;