-- Drop all existing secure_table_insert functions to resolve ambiguity
DROP FUNCTION IF EXISTS public.secure_table_insert(integer, text, integer, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.secure_table_insert(p_table_number integer, p_table_name text, p_seats integer, p_type text, p_shape text, p_location text, p_accessibility_friendly boolean, p_description text, p_company_id uuid);

-- Create a single, clean secure_table_insert function
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_new_table_id uuid;
BEGIN
  -- Get company ID from parameter or current user
  v_company_id := COALESCE(p_company_id, public.get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Insert the new table
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
    status,
    is_active
  ) VALUES (
    p_table_number,
    p_table_name,
    p_seats,
    p_type,
    p_shape,
    p_location,
    p_accessibility_friendly,
    p_description,
    v_company_id,
    'available',
    true
  )
  RETURNING id INTO v_new_table_id;
  
  RETURN v_new_table_id;
END;
$$;

-- Create secure_table_delete function
CREATE OR REPLACE FUNCTION public.secure_table_delete(p_table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_table_company_id uuid;
BEGIN
  -- Get current user's company
  v_company_id := public.get_user_company_safe();
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Get the table's company ID to verify ownership
  SELECT company_id INTO v_table_company_id
  FROM public.tables
  WHERE id = p_table_id;
  
  IF v_table_company_id IS NULL THEN
    RETURN false; -- Table doesn't exist
  END IF;
  
  IF v_table_company_id != v_company_id THEN
    RAISE EXCEPTION 'Cannot delete table from another company';
  END IF;
  
  -- Soft delete the table
  UPDATE public.tables 
  SET is_active = false
  WHERE id = p_table_id;
  
  RETURN FOUND;
END;
$$;