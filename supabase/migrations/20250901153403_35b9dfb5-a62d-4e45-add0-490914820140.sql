
-- 1) Remove the conflicting overload that uses UUID for p_company_id
DROP FUNCTION IF EXISTS public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text,
  p_shape text,
  p_location text,
  p_accessibility_friendly boolean,
  p_description text,
  p_company_id uuid
);

-- 2) Ensure a single definition exists with p_company_id as text and robust normalization
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer, 
  p_table_name text, 
  p_seats integer, 
  p_type text, 
  p_shape text, 
  p_location text, 
  p_accessibility_friendly boolean, 
  p_description text, 
  p_company_id text
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
  -- Normalize/validate company_id
  IF p_company_id IS NULL OR p_company_id = '' OR p_company_id = 'auto-set-by-rls' THEN
    v_final_company_id := public.get_user_company_safe();
  ELSE
    BEGIN
      v_final_company_id := p_company_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_final_company_id := public.get_user_company_safe();
    END;
  END IF;

  IF v_final_company_id IS NULL THEN
    RAISE EXCEPTION 'No valid company ID could be determined';
  END IF;

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
    NULLIF(p_table_name, ''),
    p_seats,
    NULLIF(p_type, ''),
    COALESCE(NULLIF(p_shape, ''), 'Rectangle'),
    NULLIF(p_location, ''),
    p_accessibility_friendly,
    NULLIF(p_description, ''),
    v_final_company_id,
    true,
    'available'
  )
  RETURNING id INTO v_table_id;

  RETURN v_table_id;
END;
$function$;
