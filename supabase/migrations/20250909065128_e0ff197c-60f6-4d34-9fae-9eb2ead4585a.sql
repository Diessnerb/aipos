-- RPC function to ensure/repair API token for a company
CREATE OR REPLACE FUNCTION public.ensure_company_api_token(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_token text;
  v_new_token text;
  v_company_name text;
BEGIN
  -- Only super admins can run this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if company exists
  SELECT name INTO v_company_name
  FROM public.companies
  WHERE id = p_company_id AND status = 'active';
  
  IF v_company_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Company not found or inactive');
  END IF;

  -- Check for existing token
  SELECT auth_token INTO v_existing_token
  FROM public.integrations
  WHERE company_id = p_company_id 
    AND service_name = 'external_api'
    AND connected = true;

  IF v_existing_token IS NOT NULL THEN
    -- Token exists, just return success
    RETURN json_build_object(
      'success', true, 
      'message', 'API token already exists and is active',
      'token', v_existing_token,
      'company_name', v_company_name,
      'action', 'verified_existing'
    );
  END IF;

  -- Generate new token
  v_new_token := 'int_' || encode(gen_random_bytes(32), 'hex');

  -- Insert or update integration
  INSERT INTO public.integrations (
    company_id,
    service_name,
    auth_token,
    connected,
    created_at,
    last_synced_at
  ) VALUES (
    p_company_id,
    'external_api',
    v_new_token,
    true,
    now(),
    now()
  ) ON CONFLICT (company_id, service_name)
  DO UPDATE SET
    auth_token = EXCLUDED.auth_token,
    connected = true,
    last_synced_at = now();

  RETURN json_build_object(
    'success', true,
    'message', 'API token created/repaired successfully',
    'token', v_new_token,
    'company_name', v_company_name,
    'action', 'created_new'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- RPC function to run health check for all companies with API tokens
CREATE OR REPLACE FUNCTION public.run_health_check_all_companies()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_record RECORD;
  v_health_results json[] := '{}';
  v_total_companies integer := 0;
  v_healthy_companies integer := 0;
BEGIN
  -- Only super admins can run this
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get all companies with API tokens
  FOR v_company_record IN
    SELECT 
      c.id,
      c.name,
      i.auth_token,
      i.connected,
      i.last_synced_at
    FROM public.companies c
    JOIN public.integrations i ON c.id = i.company_id
    WHERE c.status = 'active'
      AND i.service_name = 'external_api'
      AND i.auth_token IS NOT NULL
    ORDER BY c.name
  LOOP
    v_total_companies := v_total_companies + 1;
    
    -- For now, just check if token exists and is connected
    -- In a full implementation, you might call the health check endpoint
    IF v_company_record.connected THEN
      v_healthy_companies := v_healthy_companies + 1;
      v_health_results := array_append(v_health_results, 
        json_build_object(
          'company_id', v_company_record.id,
          'company_name', v_company_record.name,
          'status', 'healthy',
          'last_synced', v_company_record.last_synced_at
        )
      );
    ELSE
      v_health_results := array_append(v_health_results, 
        json_build_object(
          'company_id', v_company_record.id,
          'company_name', v_company_record.name,
          'status', 'disconnected',
          'last_synced', v_company_record.last_synced_at
        )
      );
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'total_companies', v_total_companies,
    'healthy_companies', v_healthy_companies,
    'results', array_to_json(v_health_results)
  );
END;
$function$;