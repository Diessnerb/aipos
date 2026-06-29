-- Update secure_tables_list function to include missing can_combine and max_combine_size columns
DROP FUNCTION IF EXISTS public.secure_tables_list(p_company_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.secure_tables_list(p_company_id uuid)
 RETURNS TABLE(id uuid, table_number integer, table_name text, seats integer, location text, status text, company_id uuid, created_at timestamp with time zone, shape text, type text, accessibility_friendly boolean, description text, is_active boolean, can_combine boolean, max_combine_size integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate company_id is provided
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Return active tables for the specified company
  RETURN QUERY
  SELECT 
    t.id,
    t.table_number,
    t.table_name,
    t.seats,
    t.location,
    t.status,
    t.company_id,
    t.created_at,
    t.shape,
    t.type,
    t.accessibility_friendly,
    t.description,
    t.is_active,
    t.can_combine,
    t.max_combine_size
  FROM public.tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
  ORDER BY t.table_number ASC;
END;
$function$;