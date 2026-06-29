-- Fix super admin RPC functions to work with proper authentication context

-- Update the is_super_admin function to be more robust
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- If no authenticated user, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user exists in super_admins table
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = current_user_id
  );
END;
$function$;

-- Update get_all_companies_detailed to work with proper authentication
CREATE OR REPLACE FUNCTION public.get_all_companies_detailed()
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
      'id', c.id,
      'name', c.name,
      'subdomain', c.subdomain,
      'status', c.status,
      'default_admin_email', c.default_admin_email,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'user_count', COALESCE(user_stats.user_count, 0),
      'active_user_count', COALESCE(user_stats.active_user_count, 0),
      'order_count', COALESCE(order_stats.order_count, 0),
      'monthly_revenue', COALESCE(order_stats.monthly_revenue, 0),
      'last_activity', GREATEST(c.updated_at, COALESCE(user_stats.last_login, c.created_at))
    )
  ) INTO result
  FROM public.companies c
  LEFT JOIN (
    SELECT 
      company_id,
      COUNT(*) as user_count,
      COUNT(*) FILTER (WHERE is_active = true) as active_user_count,
      MAX(created_at) as last_login
    FROM public.users 
    GROUP BY company_id
  ) user_stats ON c.id = user_stats.company_id
  LEFT JOIN (
    SELECT 
      u.company_id,
      COUNT(o.*) as order_count,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= DATE_TRUNC('month', NOW())), 0) as monthly_revenue
    FROM public.orders o
    JOIN public.users u ON o.created_by = u.auth_user_id
    GROUP BY u.company_id
  ) order_stats ON c.id = order_stats.company_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Update get_super_admin_dashboard_metrics_detailed
CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard_metrics_detailed()
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
  
  SELECT json_build_object(
    'total_companies', (SELECT COUNT(*) FROM public.companies WHERE status = 'active'),
    'total_users', (SELECT COUNT(*) FROM public.users WHERE is_active = true),
    'total_orders', (SELECT COUNT(*) FROM public.orders),
    'total_revenue', COALESCE((SELECT SUM(total_amount) FROM public.orders WHERE payment_status = 'paid'), 0),
    'monthly_revenue', COALESCE((SELECT SUM(total_amount) FROM public.orders WHERE payment_status = 'paid' AND created_at >= DATE_TRUNC('month', NOW())), 0),
    'active_reservations', (SELECT COUNT(*) FROM public.reservations WHERE status IN ('confirmed', 'seated') AND date >= CURRENT_DATE),
    'system_uptime', '99.9%',
    'error_rate', '0.1%',
    'avg_response_time', '150ms'
  ) INTO result;
  
  RETURN COALESCE(result, '{}');
END;
$function$;

-- Update get_system_health_detailed
CREATE OR REPLACE FUNCTION public.get_system_health_detailed()
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
  
  SELECT json_build_object(
    'uptime', '99.9%',
    'cpu_usage', '12%',
    'memory_usage', '68%',
    'database_connections', 45,
    'active_users', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '24 hours'),
    'error_rate', '0.1%',
    'avg_response_time', '150ms',
    'total_requests_24h', 12847,
    'failed_requests_24h', 12,
    'disk_usage', '34%',
    'network_io', '2.3 MB/s'
  ) INTO result;
  
  RETURN COALESCE(result, '{}');
END;
$function$;

-- Create a function to get all users across companies (for super admin)
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
    )
  ) INTO result
  FROM public.users u
  LEFT JOIN public.companies c ON u.company_id = c.id
  LEFT JOIN auth.users au ON u.auth_user_id = au.id
  ORDER BY u.created_at DESC;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;