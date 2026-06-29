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

-- Create function to generate unique PIN codes
CREATE OR REPLACE FUNCTION public.generate_unique_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    -- Generate a random 4-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if PIN already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE pin_code = new_pin) INTO pin_exists;
    
    -- If PIN doesn't exist, return it
    IF NOT pin_exists THEN
      RETURN new_pin;
    END IF;
  END LOOP;
END;
$function$;

-- Create function to update company admin credentials
CREATE OR REPLACE FUNCTION public.update_company_admin_credentials(
  p_company_id uuid,
  p_new_email text,
  p_new_password text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_user_id uuid;
  auth_user_id uuid;
BEGIN
  -- Only super admins can update company admin credentials
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get the company admin user
  SELECT id, auth_user_id INTO admin_user_id, auth_user_id
  FROM public.users 
  WHERE company_id = p_company_id AND is_company_admin = true
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Company admin not found');
  END IF;
  
  -- Update email in public.users
  UPDATE public.users 
  SET email = p_new_email
  WHERE id = admin_user_id;
  
  -- Update email in auth.users if auth_user_id exists
  IF auth_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET email = p_new_email
    WHERE id = auth_user_id;
    
    -- Update password if provided
    IF p_new_password IS NOT NULL THEN
      UPDATE auth.users 
      SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
      WHERE id = auth_user_id;
    END IF;
  END IF;
  
  -- Update company default credentials
  UPDATE public.companies 
  SET 
    default_admin_email = p_new_email,
    default_admin_password = COALESCE(p_new_password, default_admin_password)
  WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Admin credentials updated successfully');
END;
$function$;

-- Create function to update user PIN
CREATE OR REPLACE FUNCTION public.update_user_pin(
  p_user_id uuid,
  p_new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only super admins can update user PINs
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  
  -- Check if PIN already exists for another user
  IF EXISTS (SELECT 1 FROM public.users WHERE pin_code = p_new_pin AND id != p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'PIN already exists');
  END IF;
  
  -- Update the PIN
  UPDATE public.users 
  SET pin_code = p_new_pin
  WHERE id = p_user_id;
  
  RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$function$;