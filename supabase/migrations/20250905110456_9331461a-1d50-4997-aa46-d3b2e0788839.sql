-- Create secure function for updating company features to prevent race conditions
CREATE OR REPLACE FUNCTION public.update_company_feature_secure(
  p_company_id uuid,
  p_feature_name text,
  p_enabled boolean,
  p_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  -- Only super admins can update company features
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Insert or update the feature using a proper upsert with conflict resolution
  INSERT INTO public.company_subscription_features (
    company_id, 
    feature_name, 
    enabled, 
    expires_at
  ) 
  VALUES (
    p_company_id, 
    p_feature_name, 
    p_enabled, 
    p_expires_at
  )
  ON CONFLICT (company_id, feature_name) 
  DO UPDATE SET 
    enabled = EXCLUDED.enabled,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  RETURN json_build_object(
    'success', true,
    'message', 'Feature updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to update feature: ' || SQLERRM
    );
END;
$$;