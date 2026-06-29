
-- 1) Resequence priorities in a group (0..N-1), scoped to company
CREATE OR REPLACE FUNCTION public.resequence_table_group(
  p_group_id uuid,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure group belongs to the provided company
  IF NOT EXISTS (
    SELECT 1 FROM public.table_groups tg
    WHERE tg.id = p_group_id AND tg.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Table group % not found for company %', p_group_id, p_company_id;
  END IF;

  WITH ordered AS (
    SELECT
      tgm.id,
      ROW_NUMBER() OVER (ORDER BY tgm.priority_order, tgm.created_at) - 1 AS seq
    FROM public.table_group_memberships tgm
    WHERE tgm.group_id = p_group_id
  )
  UPDATE public.table_group_memberships t
  SET priority_order = o.seq
  FROM ordered o
  WHERE t.id = o.id;
END;
$$;

-- 2) Move a table up/down within a group by swapping priorities
CREATE OR REPLACE FUNCTION public.move_table_in_group(
  p_group_id uuid,
  p_table_id uuid,
  p_direction text,      -- 'up' or 'down'
  p_company_id uuid
)
RETURNS TABLE(table_id uuid, priority_order integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_priority integer;
  adjacent_priority integer;
BEGIN
  -- Validate group belongs to company
  IF NOT EXISTS (
    SELECT 1 FROM public.table_groups tg
    WHERE tg.id = p_group_id AND tg.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Table group % not found for company %', p_group_id, p_company_id;
  END IF;

  -- Normalize first to avoid gaps/duplicates
  PERFORM public.resequence_table_group(p_group_id, p_company_id);

  -- Find current priority for the given table in this group
  SELECT tgm.priority_order
  INTO current_priority
  FROM public.table_group_memberships tgm
  WHERE tgm.group_id = p_group_id AND tgm.table_id = p_table_id;

  -- If the table isn't found, just return the current order
  IF current_priority IS NULL THEN
    RETURN QUERY
    SELECT tgm.table_id, tgm.priority_order
    FROM public.table_group_memberships tgm
    WHERE tgm.group_id = p_group_id
    ORDER BY tgm.priority_order;
    RETURN;
  END IF;

  -- Compute adjacent priority based on direction
  IF lower(p_direction) = 'up' THEN
    adjacent_priority := current_priority - 1;
  ELSE
    adjacent_priority := current_priority + 1;
  END IF;

  -- Ensure bounds
  IF adjacent_priority < 0 OR adjacent_priority >= (
    SELECT COUNT(*) FROM public.table_group_memberships tgm WHERE tgm.group_id = p_group_id
  ) THEN
    -- Out of bounds; return current order
    RETURN QUERY
    SELECT tgm.table_id, tgm.priority_order
    FROM public.table_group_memberships tgm
    WHERE tgm.group_id = p_group_id
    ORDER BY tgm.priority_order;
    RETURN;
  END IF;

  -- Swap priorities between current and adjacent memberships
  UPDATE public.table_group_memberships
  SET priority_order = adjacent_priority
  WHERE group_id = p_group_id AND table_id = p_table_id;

  UPDATE public.table_group_memberships
  SET priority_order = current_priority
  WHERE group_id = p_group_id AND priority_order = adjacent_priority
  -- Avoid swapping the same row (if both conditions point to same record)
  AND table_id <> p_table_id;

  -- Return the new order
  RETURN QUERY
  SELECT tgm.table_id, tgm.priority_order
  FROM public.table_group_memberships tgm
  WHERE tgm.group_id = p_group_id
  ORDER BY tgm.priority_order;
END;
$$;
