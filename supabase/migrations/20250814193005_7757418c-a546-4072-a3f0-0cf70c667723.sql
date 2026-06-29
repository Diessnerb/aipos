-- Fix the create_company_with_admin function column name mismatch and improve error handling
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
  p_company_name text,
  p_subdomain text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text,
  p_owner_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_auth_user_id uuid;
  v_public_user_id uuid;
  v_admin_pin text;
BEGIN
  -- Only super admins can create companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
  END IF;

  -- Validate inputs
  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Company name is required');
  END IF;

  IF p_subdomain IS NULL OR trim(p_subdomain) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain is required');
  END IF;

  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Admin email is required');
  END IF;

  IF p_admin_password IS NULL OR trim(p_admin_password) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Admin password is required');
  END IF;

  IF p_owner_pin IS NULL OR trim(p_owner_pin) = '' OR length(trim(p_owner_pin)) != 4 THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN must be exactly 4 digits');
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE subdomain = p_subdomain) THEN
    RETURN json_build_object('success', false, 'error', 'Subdomain already exists');
  END IF;

  -- Check if admin email already exists in companies
  IF EXISTS (SELECT 1 FROM public.companies WHERE default_admin_email = p_admin_email) THEN
    RETURN json_build_object('success', false, 'error', 'Admin email already exists for another company');
  END IF;

  -- Check if owner PIN already exists
  IF EXISTS (SELECT 1 FROM public.companies WHERE owner_pin = p_owner_pin) THEN
    RETURN json_build_object('success', false, 'error', 'Owner PIN already exists');
  END IF;

  BEGIN
    -- Create the company
    INSERT INTO public.companies (
      name,
      subdomain,
      status,
      default_admin_email,
      default_admin_password,
      owner_pin
    ) VALUES (
      p_company_name,
      p_subdomain,
      'active',
      p_admin_email,
      p_admin_password,
      p_owner_pin
    )
    RETURNING id INTO v_company_id;

    IF v_company_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create company record');
    END IF;

    -- Create auth user for the admin
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data
    ) VALUES (
      p_admin_email,
      extensions.crypt(p_admin_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      json_build_object(
        'full_name', p_admin_full_name,
        'role', 'admin'
      )
    )
    RETURNING id INTO v_auth_user_id;

    IF v_auth_user_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create auth user');
    END IF;

    -- Generate a unique PIN for the admin user
    v_admin_pin := public.generate_unique_pin();

    -- Create public user record
    INSERT INTO public.users (
      auth_user_id,
      email,
      full_name,
      role,
      company_id,
      is_company_admin,
      pin_code
    ) VALUES (
      v_auth_user_id,
      p_admin_email,
      p_admin_full_name,
      'admin',
      v_company_id,
      true,
      v_admin_pin
    )
    RETURNING id INTO v_public_user_id;

    IF v_public_user_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Failed to create public user record');
    END IF;

    -- Create default company settings
    INSERT INTO public.company_settings (
      id,
      company_id,
      auto_assign_tables
    ) VALUES (
      v_company_id,
      v_company_id,
      true
    );

    -- Create default tables
    INSERT INTO public.tables (company_id, table_number, seats, is_active, accessibility_friendly)
    VALUES 
      (v_company_id, 1, 2, true, false),
      (v_company_id, 2, 2, true, false),
      (v_company_id, 3, 4, true, false),
      (v_company_id, 4, 4, true, false),
      (v_company_id, 5, 6, true, true),
      (v_company_id, 6, 6, true, false),
      (v_company_id, 7, 8, true, false),
      (v_company_id, 8, 8, true, true);

    -- Create default menu categories - FIXED: use display_order instead of sort_order
    INSERT INTO public.menu_categories (company_id, name, display_order, is_active)
    VALUES 
      (v_company_id, 'Starters', 1, true),
      (v_company_id, 'Mains', 2, true),
      (v_company_id, 'Desserts', 3, true),
      (v_company_id, 'Drinks', 4, true);

    -- Create system default permissions for the company
    INSERT INTO public.page_permissions (company_id, page_name, access_level, permission_type)
    VALUES 
      (v_company_id, 'pos', 'full', 'role_based'),
      (v_company_id, 'reservations', 'full', 'role_based'),
      (v_company_id, 'past_orders', 'full', 'role_based'),
      (v_company_id, 'menu_items', 'full', 'role_based'),
      (v_company_id, 'analytics', 'admin_only', 'role_based'),
      (v_company_id, 'rotas', 'admin_only', 'role_based'),
      (v_company_id, 'settings', 'admin_only', 'role_based'),
      (v_company_id, 'marketing', 'admin_only', 'role_based'),
      (v_company_id, 'inventory', 'admin_only', 'role_based'),
      (v_company_id, 'invoices', 'admin_only', 'role_based'),
      (v_company_id, 'staff_notes', 'full', 'role_based'),
      (v_company_id, 'customer_crm', 'admin_only', 'role_based'),
      (v_company_id, 'holiday_requests', 'admin_only', 'role_based'),
      (v_company_id, 'order_review', 'full', 'role_based'),
      (v_company_id, 'kitchen_view', 'full', 'role_based');

    RETURN json_build_object(
      'success', true,
      'message', 'Company created successfully',
      'company_id', v_company_id,
      'admin_user_id', v_public_user_id,
      'admin_pin', v_admin_pin
    );

  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create company: ' || SQLERRM
    );
  END;
END;
$$;