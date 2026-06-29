-- Fix RPC functions to exclude super admin users from company user listings

-- Update get_all_users_cross_company to exclude super admin users
DROP FUNCTION IF EXISTS public.get_all_users_cross_company();
CREATE OR REPLACE FUNCTION public.get_all_users_cross_company()
RETURNS TABLE(
  id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  role text,
  company_id uuid,
  company_name text,
  is_active boolean,
  is_company_admin boolean,
  pin_code text,
  created_at timestamp with time zone,
  last_login timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only super admins can access this function
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can access user data across companies';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.auth_user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    COALESCE(c.name, 'No Company') as company_name,
    u.is_active,
    u.is_company_admin,
    u.pin_code,
    u.created_at,
    au.last_sign_in_at as last_login
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  WHERE u.company_id IS NOT NULL  -- Exclude users without company assignment
    AND u.id NOT IN (SELECT user_id FROM public.super_admins WHERE user_id IS NOT NULL)  -- Exclude super admin users
  ORDER BY u.created_at DESC;
END;
$function$;

-- Update get_super_admin_dashboard_metrics_detailed to exclude super admin users from counts
CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard_metrics_detailed()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
  
  SELECT json_build_object(
    'total_companies', (
      SELECT COUNT(*) FROM public.companies WHERE status = 'active'
    ),
    'active_users', (
      SELECT COUNT(*) 
      FROM public.users u
      WHERE u.is_active = true 
        AND u.company_id IS NOT NULL  -- Only count company users
        AND u.id NOT IN (SELECT user_id FROM public.super_admins WHERE user_id IS NOT NULL)  -- Exclude super admin users
    ),
    'total_users', (
      SELECT COUNT(*) 
      FROM public.users u
      WHERE u.company_id IS NOT NULL  -- Only count company users
        AND u.id NOT IN (SELECT user_id FROM public.super_admins WHERE user_id IS NOT NULL)  -- Exclude super admin users
    ),
    'users_last_24h', (
      SELECT COUNT(*) 
      FROM auth.users au
      JOIN public.users u ON au.id = u.auth_user_id
      WHERE au.last_sign_in_at > NOW() - INTERVAL '24 hours'
        AND u.company_id IS NOT NULL  -- Only count company users
        AND u.id NOT IN (SELECT user_id FROM public.super_admins WHERE user_id IS NOT NULL)  -- Exclude super admin users
    ),
    'monthly_revenue', 0,  -- Placeholder
    'system_health', 'Excellent',
    'last_updated', NOW()
  ) INTO result;
  
  RETURN COALESCE(result, '{}');
END;
$function$;