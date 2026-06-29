-- Create default company features function
CREATE OR REPLACE FUNCTION public.create_default_company_features(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert default features for new companies
  INSERT INTO company_subscription_features (company_id, feature_name, enabled, expires_at)
  VALUES 
    (p_company_id, 'marketing', false, NULL),
    (p_company_id, 'analytics', true, NULL),
    (p_company_id, 'pos', true, NULL),
    (p_company_id, 'reservations', true, NULL),
    (p_company_id, 'inventory', true, NULL),
    (p_company_id, 'staff_management', true, NULL),
    (p_company_id, 'reports', false, NULL),
    (p_company_id, 'api_access', false, NULL),
    (p_company_id, 'multi_location', false, NULL),
    (p_company_id, 'custom_branding', false, NULL)
  ON CONFLICT (company_id, feature_name) DO NOTHING;

  RETURN json_build_object('success', true, 'message', 'Default features created');
END;
$function$;

-- Create function to manage company features (super admin only)
CREATE OR REPLACE FUNCTION public.manage_company_feature(
  p_company_id uuid,
  p_feature_name text,
  p_enabled boolean,
  p_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only super admins can manage company features
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
  END IF;

  -- Update or insert the feature
  INSERT INTO company_subscription_features (company_id, feature_name, enabled, expires_at)
  VALUES (p_company_id, p_feature_name, p_enabled, p_expires_at)
  ON CONFLICT (company_id, feature_name) 
  DO UPDATE SET 
    enabled = EXCLUDED.enabled,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  RETURN json_build_object(
    'success', true, 
    'message', 'Feature updated successfully',
    'company_id', p_company_id,
    'feature_name', p_feature_name,
    'enabled', p_enabled
  );
END;
$function$;

-- Create function to get company features
CREATE OR REPLACE FUNCTION public.get_company_features(p_company_id uuid)
RETURNS TABLE(
  feature_name text,
  enabled boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow access if user belongs to the company or is super admin
  IF NOT (
    public.is_super_admin() OR 
    p_company_id IN (SELECT allowed_company_ids_for_current_user())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    csf.feature_name,
    csf.enabled,
    csf.expires_at,
    csf.created_at,
    csf.updated_at
  FROM company_subscription_features csf
  WHERE csf.company_id = p_company_id
  ORDER BY csf.feature_name;
END;
$function$;

-- Create trigger to add default features when a company is created
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Create default features for the new company
  PERFORM public.create_default_company_features(NEW.id);
  RETURN NEW;
END;
$function$;

-- Create trigger if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_company_created'
  ) THEN
    CREATE TRIGGER on_company_created
      AFTER INSERT ON public.companies
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();
  END IF;
END $$;

-- Ensure existing companies have default features
INSERT INTO company_subscription_features (company_id, feature_name, enabled, expires_at)
SELECT 
  c.id,
  f.feature_name,
  CASE 
    WHEN f.feature_name IN ('analytics', 'pos', 'reservations', 'inventory', 'staff_management') THEN true 
    ELSE false 
  END as enabled,
  NULL as expires_at
FROM companies c
CROSS JOIN (
  VALUES 
    ('marketing'),
    ('analytics'),
    ('pos'),
    ('reservations'),
    ('inventory'),
    ('staff_management'),
    ('reports'),
    ('api_access'),
    ('multi_location'),
    ('custom_branding')
) AS f(feature_name)
WHERE NOT EXISTS (
  SELECT 1 FROM company_subscription_features csf 
  WHERE csf.company_id = c.id AND csf.feature_name = f.feature_name
);