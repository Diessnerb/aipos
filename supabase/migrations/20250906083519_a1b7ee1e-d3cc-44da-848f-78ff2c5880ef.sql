-- Update function to remove total_seats from return as it's misleading due to seat loss when combining tables
DROP FUNCTION IF EXISTS public.get_available_table_groups_with_status(p_company_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_available_table_groups_with_status(p_company_id uuid)
RETURNS TABLE(
  group_id uuid,
  group_name text,
  description text,
  max_combined_capacity integer,
  is_active boolean,
  display_order integer,
  table_numbers integer[],
  can_combine boolean,
  out_of_service_tables integer[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH group_data AS (
    SELECT 
      tg.id as group_id,
      tg.group_name,
      tg.description,
      tg.max_combined_capacity,
      tg.is_active,
      tg.display_order,
      array_agg(t.table_number ORDER BY tgm.priority_order) as table_numbers,
      -- Group can combine if no tables are out_of_service
      NOT bool_or(t.service_status = 'out_of_service') as can_combine,
      -- Track which tables are out of service for display
      array_agg(
        CASE WHEN t.service_status = 'out_of_service' 
        THEN t.table_number 
        ELSE NULL END
      ) FILTER (WHERE t.service_status = 'out_of_service') as out_of_service_tables
    FROM table_groups tg
    JOIN table_group_memberships tgm ON tg.id = tgm.group_id
    JOIN tables t ON tgm.table_id = t.id
    WHERE tg.company_id = p_company_id
      AND tg.is_active = true
      AND t.is_active = true
    GROUP BY tg.id, tg.group_name, tg.description, tg.max_combined_capacity, 
             tg.is_active, tg.display_order
  )
  SELECT 
    gd.group_id,
    gd.group_name,
    gd.description,
    gd.max_combined_capacity,
    gd.is_active,
    gd.display_order,
    gd.table_numbers,
    gd.can_combine,
    COALESCE(gd.out_of_service_tables, ARRAY[]::integer[])
  FROM group_data gd
  ORDER BY gd.display_order, gd.group_name;
END;
$function$;