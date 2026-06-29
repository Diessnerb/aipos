-- Enable realtime for tables
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- Add unique constraint for table_number + company_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_number_company 
ON public.tables (table_number, company_id) 
WHERE is_active = true;

-- Create secure table insert function for PIN-only flows
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text DEFAULT NULL,
  p_seats integer DEFAULT 4,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT 'Rectangle',
  p_location text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, table_number integer, table_name text, seats integer, location text, status text, company_id uuid, created_at timestamp with time zone, shape text, type text, accessibility_friendly boolean, description text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_result_id uuid;
BEGIN
  -- Get company ID from parameter or current user
  v_company_id := COALESCE(p_company_id, public.get_user_company_safe());
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
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
  )
  RETURNING tables.id INTO v_result_id;

  -- Return the created table
  RETURN QUERY
  SELECT t.id, t.table_number, t.table_name, t.seats, t.location, t.status, 
         t.company_id, t.created_at, t.shape, t.type, t.accessibility_friendly, 
         t.description, t.is_active
  FROM public.tables t
  WHERE t.id = v_result_id;
END;
$function$;

-- Create secure table update function
CREATE OR REPLACE FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer DEFAULT NULL,
  p_table_name text DEFAULT NULL, 
  p_seats integer DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS TABLE(id uuid, table_number integer, table_name text, seats integer, location text, status text, company_id uuid, created_at timestamp with time zone, shape text, type text, accessibility_friendly boolean, description text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get current user's company
  v_company_id := public.get_user_company_safe();
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
  END IF;

  -- Update only if table belongs to user's company
  UPDATE public.tables SET
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
    type = COALESCE(p_type, type),
    shape = COALESCE(p_shape, shape),
    location = COALESCE(p_location, location),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description)
  WHERE id = p_table_id AND company_id = v_company_id;

  -- Return the updated table
  RETURN QUERY
  SELECT t.id, t.table_number, t.table_name, t.seats, t.location, t.status,
         t.company_id, t.created_at, t.shape, t.type, t.accessibility_friendly,
         t.description, t.is_active
  FROM public.tables t
  WHERE t.id = p_table_id AND t.company_id = v_company_id;
END;
$function$;

-- Create secure table delete function (soft delete)
CREATE OR REPLACE FUNCTION public.secure_table_delete(p_table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_affected_rows integer;
BEGIN
  -- Get current user's company
  v_company_id := public.get_user_company_safe();
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
  END IF;

  -- Soft delete only if table belongs to user's company
  UPDATE public.tables 
  SET is_active = false
  WHERE id = p_table_id AND company_id = v_company_id;

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
  
  RETURN v_affected_rows > 0;
END;
$function$;