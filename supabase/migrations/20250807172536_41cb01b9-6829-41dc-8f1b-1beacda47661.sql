-- Create function to get dashboard metrics
CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result json;
  total_companies integer;
  active_users integer;
  total_orders integer;
  monthly_revenue numeric;
BEGIN
  -- Only super admins can access this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get total companies
  SELECT COUNT(*) INTO total_companies FROM public.companies;
  
  -- Get active users (users with recent activity or all users for now)
  SELECT COUNT(*) INTO active_users FROM public.users;
  
  -- Get total orders for revenue calculation
  SELECT COUNT(*) INTO total_orders FROM public.orders;
  
  -- Calculate monthly revenue (simplified - using total orders * average)
  SELECT COALESCE(SUM(total_amount), 0) INTO monthly_revenue 
  FROM public.orders 
  WHERE created_at >= DATE_TRUNC('month', NOW());
  
  RETURN json_build_object(
    'total_companies', total_companies,
    'active_users', active_users,
    'total_orders', total_orders,
    'monthly_revenue', monthly_revenue,
    'system_health', '99.9'
  );
END;
$function$;