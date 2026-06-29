-- Create function to reset owner PIN to a default value (1234)
CREATE OR REPLACE FUNCTION public.reset_owner_pin(
  p_company_id uuid,
  p_new_pin text DEFAULT '1234'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hashed_pin text;
BEGIN
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;
  
  -- Hash the new PIN using the same format as other PINs
  v_hashed_pin := md5(p_new_pin || 'pin_salt_2025');
  
  -- Update the company's owner_pin
  UPDATE public.companies
  SET owner_pin = v_hashed_pin,
      updated_at = now()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Owner PIN reset successfully to 1234');
END;
$$;