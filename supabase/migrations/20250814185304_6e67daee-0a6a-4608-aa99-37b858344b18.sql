-- Fix the get_all_users_cross_company function to properly handle timestamp types
-- and add session validation for super admin functions

-- Create or replace the get_all_users_cross_company function with correct timestamp handling
DROP FUNCTION IF EXISTS public.get_all_users_cross_company();
CREATE OR REPLACE FUNCTION public.get_all_users_cross_company()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  role text,
  is_company_admin boolean,
  is_active boolean,
  company_id uuid,
  company_name text,
  pin_code text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_login timestamp with time zone,
  remaining_holiday_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is a super admin
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = current_user_id) THEN
    RAISE EXCEPTION 'Unauthorized - not a super admin';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.role,
    u.is_company_admin,
    u.is_active,
    u.company_id,
    c.name as company_name,
    u.pin_code,
    u.created_at,
    u.updated_at,
    au.last_sign_in_at as last_login,
    COALESCE(u.remaining_holiday_days, 0) as remaining_holiday_days
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  WHERE u.company_id IS NOT NULL -- Exclude users without company (super admins)
  ORDER BY c.name ASC, u.full_name ASC;
END;
$function$;

-- Create a function to validate and refresh session
CREATE OR REPLACE FUNCTION public.validate_super_admin_session()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  session_valid boolean;
  user_email text;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'No authentication session found',
      'user_id', null,
      'email', null,
      'is_super_admin', false
    );
  END IF;
  
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  
  -- Check if user is a super admin
  session_valid := EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = current_user_id);
  
  RETURN json_build_object(
    'valid', session_valid,
    'error', CASE WHEN session_valid THEN null ELSE 'User is not a super admin' END,
    'user_id', current_user_id,
    'email', user_email,
    'is_super_admin', session_valid,
    'timestamp', now()
  );
END;
$function$;