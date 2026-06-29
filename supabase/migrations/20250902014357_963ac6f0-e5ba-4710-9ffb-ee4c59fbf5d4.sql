-- Remove the problematic trigger that causes UUID casting issues
DROP TRIGGER IF EXISTS set_table_company_id_trigger ON public.tables;

-- Update the set_table_company_id function to be safer
CREATE OR REPLACE FUNCTION public.set_table_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only set company_id if it's null or the problematic 'auto-set-by-rls' value
  IF NEW.company_id IS NULL OR NEW.company_id::text = 'auto-set-by-rls' THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- Create the secure_table_insert RPC if it doesn't exist
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text DEFAULT '',
  p_shape text DEFAULT 'Rectangle',
  p_location text DEFAULT '',
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT '',
  p_company_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get the company ID safely
  v_company_id := COALESCE(p_company_id, public.get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company ID found for current user';
  END IF;
  
  -- Check for duplicate table number within the company
  IF EXISTS (
    SELECT 1 FROM public.tables 
    WHERE table_number = p_table_number 
    AND company_id = v_company_id 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Table number % already exists', p_table_number;
  END IF;
  
  -- Insert the table
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
    v_company_id,
    true,
    'available'
  );
  
  RETURN true;
END;
$function$;

-- Create the secure_table_delete RPC if it doesn't exist
CREATE OR REPLACE FUNCTION public.secure_table_delete(p_table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get the current user's company ID
  v_company_id := public.get_user_company_safe();
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company ID found for current user';
  END IF;
  
  -- Soft delete the table (mark as inactive) only if it belongs to the user's company
  UPDATE public.tables 
  SET is_active = false
  WHERE id = p_table_id 
    AND company_id = v_company_id;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$function$;