-- Final security fixes: Enable RLS on remaining tables and fix function search paths

-- Enable RLS on the remaining tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Fix remaining functions missing SET search_path
CREATE OR REPLACE FUNCTION public.create_channel_with_members(p_name text, p_description text DEFAULT NULL::text, p_member_ids uuid[] DEFAULT NULL::uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_channel_id UUID;
  member_id UUID;
BEGIN
  -- Create the channel
  INSERT INTO public.channels (name, description, created_by, type)
  VALUES (p_name, p_description, auth.uid(), 'public')
  RETURNING id INTO new_channel_id;

  -- Add the creator as a member
  INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
  VALUES (new_channel_id, auth.uid(), true);

  -- Add specified members if any
  IF p_member_ids IS NOT NULL THEN
    FOREACH member_id IN ARRAY p_member_ids
    LOOP
      INSERT INTO public.channel_memberships (channel_id, user_id, can_write)
      VALUES (new_channel_id, member_id, true)
      ON CONFLICT (channel_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN new_channel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pin_user(p_full_name text, p_role text, p_pin_code text, p_company_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_user_id uuid;
  generated_email text;
BEGIN
  -- Validate PIN format
  IF p_pin_code !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  -- Check if PIN already exists
  IF EXISTS (SELECT 1 FROM users WHERE pin_code = p_pin_code) THEN
    RAISE EXCEPTION 'PIN already exists';
  END IF;

  -- Generate a unique email-like identifier
  generated_email := lower(replace(p_full_name, ' ', '.')) || '.' || p_pin_code || '@internal.staff';

  -- Create the user record
  INSERT INTO public.users (
    full_name,
    email,
    role,
    pin_code,
    company_id
  ) VALUES (
    p_full_name,
    generated_email,
    p_role,
    p_pin_code,
    p_company_id
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_super_admin(admin_email text, admin_full_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- Insert into super_admins table with a placeholder user_id
  -- The actual user will be created through the Supabase dashboard/API
  INSERT INTO public.super_admins (
    user_id,
    email,
    full_name
  ) VALUES (
    gen_random_uuid(), -- Temporary UUID, will be updated when real user is created
    admin_email,
    admin_full_name
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Super admin placeholder created. Please create auth user through Supabase dashboard.',
    'email', admin_email
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_company()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.update_user_password(user_email text, new_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    user_id uuid;
    result json;
BEGIN
    -- Get the user ID from email
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Update the password
    UPDATE auth.users 
    SET 
        encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = user_id;
    
    RETURN json_build_object('success', true, 'message', 'Password updated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;