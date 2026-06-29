-- Drop existing function first
DROP FUNCTION IF EXISTS public.move_table_in_group(uuid, uuid, text);

-- Recreate move_table_in_group with new signature
CREATE OR REPLACE FUNCTION public.move_table_in_group(
  p_table_id uuid,
  p_group_id uuid,
  p_direction text,
  p_company_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_priority integer;
  target_priority integer;
  group_company_id uuid;
BEGIN
  -- Get the company_id for this table group
  SELECT company_id INTO group_company_id
  FROM table_groups
  WHERE id = p_group_id;
  
  -- If company_id was provided, validate it matches the group's company
  IF p_company_id IS NOT NULL THEN
    IF group_company_id != p_company_id THEN
      RETURN json_build_object('success', false, 'error', 'Access denied: Group does not belong to specified company');
    END IF;
  ELSE
    -- Use existing logic to get user's company
    IF NOT EXISTS (
      SELECT 1 FROM users u 
      WHERE u.auth_user_id = auth.uid() 
      AND u.company_id = group_company_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'User not found or not associated with a company');
    END IF;
  END IF;

  -- Get current priority of the table
  SELECT tgm.priority_order INTO current_priority
  FROM table_group_memberships tgm
  WHERE tgm.table_id = p_table_id AND tgm.group_id = p_group_id;

  IF current_priority IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Table not found in group');
  END IF;

  -- Determine target priority based on direction
  IF p_direction = 'up' THEN
    SELECT tgm.priority_order INTO target_priority
    FROM table_group_memberships tgm
    WHERE tgm.group_id = p_group_id 
      AND tgm.priority_order < current_priority
    ORDER BY tgm.priority_order DESC
    LIMIT 1;
  ELSIF p_direction = 'down' THEN
    SELECT tgm.priority_order INTO target_priority
    FROM table_group_memberships tgm
    WHERE tgm.group_id = p_group_id 
      AND tgm.priority_order > current_priority
    ORDER BY tgm.priority_order ASC
    LIMIT 1;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid direction. Use "up" or "down"');
  END IF;

  -- If no target found, table is already at the edge
  IF target_priority IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Cannot move table further in that direction');
  END IF;

  -- Swap priorities
  UPDATE table_group_memberships tgm1
  SET priority_order = target_priority
  WHERE tgm1.table_id = p_table_id AND tgm1.group_id = p_group_id;

  UPDATE table_group_memberships tgm2
  SET priority_order = current_priority
  WHERE tgm2.group_id = p_group_id AND tgm2.priority_order = target_priority AND tgm2.table_id != p_table_id;

  RETURN json_build_object('success', true, 'message', 'Table moved successfully');
END;
$function$;