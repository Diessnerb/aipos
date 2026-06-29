-- Create function to generate secure API tokens
CREATE OR REPLACE FUNCTION public.generate_integration_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  token_length integer := 32;
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..token_length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN 'int_' || result;
END;
$function$;

-- Create trigger function to auto-create integration for new companies
CREATE OR REPLACE FUNCTION public.auto_create_company_integration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create an integration record for external API access
  INSERT INTO public.integrations (
    company_id,
    service_name,
    auth_token,
    connected,
    created_at
  ) VALUES (
    NEW.id,
    'external_api',
    public.generate_integration_token(),
    true,
    now()
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-create integrations for new companies
DROP TRIGGER IF EXISTS trigger_auto_create_company_integration ON public.companies;
CREATE TRIGGER trigger_auto_create_company_integration
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_company_integration();

-- Backfill tokens for existing companies that don't have external_api integrations
INSERT INTO public.integrations (company_id, service_name, auth_token, connected, created_at)
SELECT 
  c.id,
  'external_api',
  public.generate_integration_token(),
  true,
  now()
FROM public.companies c
WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.integrations i 
    WHERE i.company_id = c.id AND i.service_name = 'external_api'
  );

-- Add RLS policy for super admins to manage integrations
CREATE POLICY "Super admins can manage all integrations"
ON public.integrations
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Create RPC function for token rotation
CREATE OR REPLACE FUNCTION public.rotate_company_integration_token(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_token text;
BEGIN
  -- Only super admins can rotate tokens
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Generate new token
  new_token := public.generate_integration_token();
  
  -- Update the integration record
  UPDATE public.integrations
  SET auth_token = new_token,
      last_synced_at = now()
  WHERE company_id = p_company_id 
    AND service_name = 'external_api';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Integration not found');
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Token rotated successfully',
    'new_token', new_token
  );
END;
$function$;