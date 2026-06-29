-- Update secure_table_insert to handle company_id parameter properly
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer, 
  p_table_name text, 
  p_seats integer, 
  p_type text, 
  p_shape text, 
  p_location text, 
  p_accessibility_friendly boolean, 
  p_description text, 
  p_company_id text -- Change to text to handle validation
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id uuid;
  v_final_company_id uuid;
BEGIN
  -- Validate and normalize company_id parameter
  IF p_company_id IS NULL OR p_company_id = '' OR p_company_id = 'auto-set-by-rls' THEN
    -- Get company from current user context
    v_final_company_id := public.get_user_company_safe();
  ELSE
    -- Try to cast the provided company_id to UUID
    BEGIN
      v_final_company_id := p_company_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      -- If cast fails, get from user context as fallback
      v_final_company_id := public.get_user_company_safe();
    END;
  END IF;
  
  -- Validate that we have a valid company_id
  IF v_final_company_id IS NULL THEN
    RAISE EXCEPTION 'No valid company ID could be determined';
  END IF;
  
  -- Insert the new table with validated company_id
  INSERT INTO public.tables (
    table_number,
    table_name,
    seats,
    type,
    shape,
    location,
    accessibility_friendly,
    description,
    company_id,
    is_active,
    status
  ) VALUES (
    p_table_number,
    NULLIF(p_table_name, ''),  -- Convert empty string to NULL
    p_seats,
    NULLIF(p_type, ''),        -- Convert empty string to NULL
    COALESCE(NULLIF(p_shape, ''), 'Rectangle'),
    NULLIF(p_location, ''),    -- Convert empty string to NULL
    p_accessibility_friendly,
    NULLIF(p_description, ''), -- Convert empty string to NULL
    v_final_company_id,
    true,
    'available'
  )
  RETURNING id INTO v_table_id;
  
  RETURN v_table_id;
END;
$function$;