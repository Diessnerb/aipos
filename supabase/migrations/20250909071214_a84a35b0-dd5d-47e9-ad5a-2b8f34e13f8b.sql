-- Create admin function to safely get company API token
CREATE OR REPLACE FUNCTION public.admin_get_company_api_token(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token_record RECORD;
  v_token_count integer;
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

  -- Count existing tokens for this company
  SELECT COUNT(*) INTO v_token_count
  FROM public.integrations
  WHERE company_id = p_company_id 
    AND service_name = 'external_api';

  -- If multiple tokens exist, clean them up (keep the most recent connected one)
  IF v_token_count > 1 THEN
    -- Delete older duplicate tokens, keeping only the most recent connected one
    DELETE FROM public.integrations 
    WHERE company_id = p_company_id 
      AND service_name = 'external_api'
      AND id NOT IN (
        SELECT id FROM public.integrations
        WHERE company_id = p_company_id 
          AND service_name = 'external_api'
        ORDER BY 
          CASE WHEN connected = true THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1
      );
  END IF;

  -- Get the token record
  SELECT id, auth_token, connected, created_at, last_synced_at
  INTO v_token_record
  FROM public.integrations
  WHERE company_id = p_company_id 
    AND service_name = 'external_api'
  LIMIT 1;

  IF v_token_record.auth_token IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'token_exists', false,
      'company_name', v_company_name
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'token_exists', true,
    'token', v_token_record.auth_token,
    'connected', v_token_record.connected,
    'created_at', v_token_record.created_at,
    'last_synced_at', v_token_record.last_synced_at,
    'company_name', v_company_name
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Create unique constraint to prevent duplicate tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_company_service_unique 
ON public.integrations (company_id, service_name) 
WHERE service_name = 'external_api';

-- Clean up any orphaned tokens without company_id
DELETE FROM public.integrations 
WHERE service_name = 'external_api' 
  AND company_id IS NULL;