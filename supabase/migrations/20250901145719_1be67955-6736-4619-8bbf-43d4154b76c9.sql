-- Create secure RPC functions for PIN users to manage tables

-- Function to insert tables for PIN users
DROP FUNCTION IF EXISTS public.secure_table_insert(p_table_number integer, p_table_name text, p_seats integer, p_type text, p_shape text, p_location text, p_accessibility_friendly boolean, p_description text, p_company_id uuid);
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text,
  p_shape text,
  p_location text,
  p_accessibility_friendly boolean,
  p_description text,
  p_company_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_table_id uuid;
BEGIN
  -- Validate company_id is provided
  IF p_company_id IS NULL THEN
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
    is_active,
    status
  ) VALUES (
    p_table_number,
    p_table_name,
    p_seats,
    p_type,
    p_shape,
    p_location,
    p_accessibility_friendly,
    p_description,
    p_company_id,
    true,
    'available'
  )
  RETURNING id INTO v_table_id;
  
  RETURN v_table_id;
END;
$function$;

-- Function to update tables for PIN users
DROP FUNCTION IF EXISTS public.secure_table_update(p_table_id uuid, p_table_number integer, p_table_name text, p_seats integer, p_type text, p_shape text, p_location text, p_accessibility_friendly boolean, p_description text) CASCADE;
CREATE OR REPLACE FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text,
  p_shape text,
  p_location text,
  p_accessibility_friendly boolean,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Update the table (only non-null values)
  UPDATE public.tables 
  SET 
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
    type = COALESCE(p_type, type),
    shape = COALESCE(p_shape, shape),
    location = COALESCE(p_location, location),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description)
  WHERE id = p_table_id;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$function$;

-- Function to delete (soft delete) tables for PIN users
DROP FUNCTION IF EXISTS public.secure_table_delete(p_table_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.secure_table_delete(
  p_table_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Soft delete the table by setting is_active to false
  UPDATE public.tables 
  SET is_active = false
  WHERE id = p_table_id;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$function$;