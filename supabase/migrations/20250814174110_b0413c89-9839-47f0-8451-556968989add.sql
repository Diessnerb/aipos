-- Fix the SQL GROUP BY error in get_all_users_cross_company function
CREATE OR REPLACE FUNCTION public.get_all_users_cross_company()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  
  -- Check if user is a super admin
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = current_user_id) THEN
    RETURN json_build_object('error', 'Unauthorized - not a super admin');
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'role', u.role,
      'is_company_admin', u.is_company_admin,
      'is_active', u.is_active,
      'company_id', u.company_id,
      'company_name', c.name,
      'pin_code', u.pin_code,
      'created_at', u.created_at,
      'updated_at', u.updated_at,
      'last_login', COALESCE(au.last_sign_in_at, u.created_at),
      'remaining_holiday_days', COALESCE(u.remaining_holiday_days, 25)
    ) ORDER BY u.created_at DESC
  ) INTO result
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;