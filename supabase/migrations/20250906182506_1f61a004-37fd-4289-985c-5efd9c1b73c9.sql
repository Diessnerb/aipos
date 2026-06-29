-- Fix ambiguous column reference in move_table_in_group function
CREATE OR REPLACE FUNCTION public.move_table_in_group(
  p_table_id uuid,
  p_group_id uuid,
  p_direction text,
  OUT success boolean,
  OUT message text,
  OUT new_order integer[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_current_priority integer;
  v_swap_priority integer;
  v_max_priority integer;
  membership_record RECORD;
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id
  FROM users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    success := false;
    message := 'User not found or not associated with a company';
    RETURN;
  END IF;
  
  -- Get current priority and verify ownership
  SELECT tgm.priority_order INTO v_current_priority
  FROM table_group_memberships tgm
  JOIN tables t ON tgm.table_id = t.id
  WHERE tgm.table_id = p_table_id 
    AND tgm.group_id = p_group_id
    AND t.company_id = v_company_id;
  
  IF v_current_priority IS NULL THEN
    success := false;
    message := 'Table not found in group or access denied';
    RETURN;
  END IF;
  
  -- First resequence to ensure contiguous priorities
  PERFORM public.resequence_table_group(p_group_id);
  
  -- Get updated current priority after resequencing
  SELECT tgm.priority_order INTO v_current_priority
  FROM table_group_memberships tgm
  WHERE tgm.table_id = p_table_id AND tgm.group_id = p_group_id;
  
  -- Get max priority
  SELECT MAX(tgm.priority_order) INTO v_max_priority
  FROM table_group_memberships tgm
  WHERE tgm.group_id = p_group_id;
  
  -- Determine swap priority based on direction
  IF p_direction = 'up' THEN
    IF v_current_priority = 0 THEN
      success := false;
      message := 'Already at the top';
      RETURN;
    END IF;
    v_swap_priority := v_current_priority - 1;
  ELSIF p_direction = 'down' THEN
    IF v_current_priority = v_max_priority THEN
      success := false;
      message := 'Already at the bottom';
      RETURN;
    END IF;
    v_swap_priority := v_current_priority + 1;
  ELSE
    success := false;
    message := 'Invalid direction. Use "up" or "down"';
    RETURN;
  END IF;
  
  -- Perform the swap
  UPDATE table_group_memberships tgm1
  SET priority_order = CASE 
    WHEN tgm1.priority_order = v_current_priority THEN v_swap_priority
    WHEN tgm1.priority_order = v_swap_priority THEN v_current_priority
    ELSE tgm1.priority_order
  END
  WHERE tgm1.group_id = p_group_id 
    AND tgm1.priority_order IN (v_current_priority, v_swap_priority);
  
  -- Get the new order
  SELECT array_agg(t.table_number ORDER BY tgm.priority_order)
  INTO new_order
  FROM table_group_memberships tgm
  JOIN tables t ON tgm.table_id = t.id
  WHERE tgm.group_id = p_group_id;
  
  success := true;
  message := 'Table reordered successfully';
END;
$$;