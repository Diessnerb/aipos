-- Drop the old version without can_combine parameter
DROP FUNCTION IF EXISTS public.secure_table_update(p_table_id uuid, p_table_number integer, p_table_name text, p_seats integer, p_type text, p_shape text, p_location text, p_accessibility_friendly boolean, p_description text, p_company_id text) CASCADE;

-- Drop the newer version with can_combine parameter 
DROP FUNCTION IF EXISTS public.secure_table_update(p_table_id uuid, p_table_number integer, p_table_name text, p_seats integer, p_location text, p_shape text, p_type text, p_accessibility_friendly boolean, p_description text, p_can_combine boolean, p_company_id uuid) CASCADE;

-- Create the single canonical version that handles can_combine correctly
CREATE OR REPLACE FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer DEFAULT NULL,
  p_table_name text DEFAULT NULL,
  p_seats integer DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_can_combine boolean DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_table_company_id uuid;
  v_current_user_company_id uuid;
BEGIN
  -- Get the table's company_id
  SELECT company_id INTO v_table_company_id
  FROM public.tables
  WHERE id = p_table_id;
  
  IF v_table_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Table not found');
  END IF;
  
  -- Get current user's company_id
  SELECT company_id INTO v_current_user_company_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  -- Check if user belongs to the same company
  IF v_current_user_company_id != v_table_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Cannot update table from another company');
  END IF;
  
  -- Log the update attempt for debugging
  RAISE LOG 'Updating table % with can_combine: %', p_table_id, p_can_combine;
  
  -- Update the table with provided values (explicitly handle can_combine)
  UPDATE public.tables
  SET 
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
    location = COALESCE(p_location, location),
    shape = COALESCE(p_shape, shape),
    type = COALESCE(p_type, type),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description),
    can_combine = COALESCE(p_can_combine, can_combine)
  WHERE id = p_table_id;
  
  -- Log successful update
  RAISE LOG 'Successfully updated table % - can_combine set to: %', p_table_id, COALESCE(p_can_combine, 'unchanged');
  
  RETURN json_build_object('success', true, 'message', 'Table updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error updating table %: %', p_table_id, SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;