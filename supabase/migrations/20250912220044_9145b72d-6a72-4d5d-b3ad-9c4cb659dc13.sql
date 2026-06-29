-- Fix immediate assignment trigger HTTP call and make it non-blocking
-- Ensure pg_net is available (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Safer trigger: cast body to text, include Authorization header, and swallow errors
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
  -- Determine company id (fallback to NEW.company_id when auth.uid() is null)
  SELECT company_id INTO v_company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
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

    BEGIN
      PERFORM extensions.http_post(
        url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsc3Jwb3d2dXhjdmhxa2V5a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM5MjIsImV4cCI6MjA2NDM0OTkyMn0.UlbQLERTz2JTQCNu111gVaFj4PJn1DO4wO5w7x3JjrA'
        ),
        body := (
          jsonb_build_object(
            'companyId', v_company_id::text,
            'mode', 'immediate',
            'isAuthenticatedAdmin', true
          )
        )::text
      );
    EXCEPTION WHEN OTHERS THEN
      -- Do not block the INSERT/UPDATE; just log for diagnostics
      RAISE LOG 'Immediate optimizer HTTP call failed for reservation % (company %): %', NEW.id, v_company_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Safer manual trigger as well
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

  BEGIN
    PERFORM extensions.http_post(
      url := 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/continuous-optimizer',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsc3Jwb3d2dXhjdmhxa2V5a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM5MjIsImV4cCI6MjA2NDM0OTkyMn0.UlbQLERTz2JTQCNu111gVaFj4PJn1DO4wO5w7x3JjrA'
      ),
      body := (
        jsonb_build_object(
          'companyId', p_company_id::text,
          'mode', 'immediate',
          'isAuthenticatedAdmin', true
        )
      )::text
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Manual optimizer HTTP call failed for company %: %', p_company_id, SQLERRM;
    RETURN json_build_object('success', false, 'error', 'Failed to trigger optimization');
  END;

  RETURN json_build_object('success', true, 'message', 'Optimization triggered');
END;
$$;