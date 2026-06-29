-- Update secure_tables_list function to include all table fields
DROP FUNCTION IF EXISTS public.secure_tables_list(p_company_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.secure_tables_list(p_company_id uuid)
RETURNS TABLE(
  id uuid, 
  table_number integer, 
  table_name text, 
  seats integer, 
  location text, 
  status text, 
  company_id uuid, 
  created_at timestamp with time zone, 
  shape text, 
  type text, 
  accessibility_friendly boolean, 
  description text, 
  is_active boolean, 
  can_combine boolean, 
  max_combine_size integer,
  group_priority integer,
  features jsonb,
  vip_status boolean,
  window_seating boolean,
  privacy_level text,
  ambiance text,
  is_high_top boolean,
  is_main_dining boolean,
  is_outdoor boolean,
  is_quiet_area boolean,
  is_family_friendly boolean,
  is_business_friendly boolean,
  service_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate company_id is provided
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Return active tables for the specified company with all fields
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
    t.max_combine_size,
    t.group_priority,
    t.features,
    t.vip_status,
    t.window_seating,
    t.privacy_level,
    t.ambiance,
    t.is_high_top,
    t.is_main_dining,
    t.is_outdoor,
    t.is_quiet_area,
    t.is_family_friendly,
    t.is_business_friendly,
    t.service_status
  FROM public.tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
  ORDER BY t.table_number ASC;
END;
$function$;