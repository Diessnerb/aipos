-- Enable pg_net for HTTP callbacks
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update trigger function to call edge function via HTTP instead of pg_notify
CREATE OR REPLACE FUNCTION public.trigger_immediate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_optimization_enabled boolean;
  v_auto_assign_tables boolean;
BEGIN
  -- Determine company id
  SELECT company_id INTO v_company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_company_id IS NULL THEN
    v_company_id := NEW.company_id;
  END IF;

  -- Check company settings
  SELECT 
    COALESCE(optimization_enabled, false),
    COALESCE(auto_assign_tables, false)
  INTO 
    v_optimization_enabled,
    v_auto_assign_tables
  FROM public.company_settings 
  WHERE company_id = v_company_id;

  IF v_optimization_enabled OR v_auto_assign_tables THEN
    RAISE LOG 'Immediate optimizer HTTP call for reservation % (company %)', NEW.id, v_company_id;

    -- Fire-and-forget HTTP call to the edge function (JWT disabled in config)
    PERFORM extensions.http_post(
      url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'companyId', v_company_id::text,
        'mode', 'immediate',
        'isAuthenticatedAdmin', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update manual optimization function to use HTTP call
CREATE OR REPLACE FUNCTION public.trigger_manual_optimization(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_company_id uuid;
  v_is_admin boolean;
BEGIN
  SELECT u.company_id, (u.role = 'admin' OR u.is_company_admin)
  INTO v_user_company_id, v_is_admin
  FROM public.users u 
  WHERE u.auth_user_id = auth.uid();

  IF v_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  IF v_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to company');
  END IF;
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  PERFORM extensions.http_post(
    url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'companyId', p_company_id::text,
      'mode', 'immediate',
      'isAuthenticatedAdmin', true
    )
  );
  RETURN json_build_object('success', true, 'message', 'Optimization triggered');
END;
$$;