-- Fix select_contiguous_group_tables to use priority_order for adjacency
-- Drop the existing function
DROP FUNCTION IF EXISTS select_contiguous_group_tables(uuid, uuid, integer);

-- Recreate with correct logic using priority_order for contiguous detection
CREATE OR REPLACE FUNCTION select_contiguous_group_tables(
  p_company_id uuid,
  p_group_id uuid,
  p_party_size integer
)
RETURNS TABLE(
  selected_tables jsonb,
  total_capacity integer,
  is_contiguous boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name text;
  v_available_tables jsonb;
  v_best_combination jsonb := '[]'::jsonb;
  v_best_capacity integer := 0;
  v_best_waste integer := 999999;
  v_current_combo jsonb;
  v_current_capacity integer;
  v_current_waste integer;
BEGIN
  -- Validate company_id
  IF p_company_id IS NULL THEN
    RETURN QUERY SELECT 
      '[]'::jsonb,
      0,
      false,
      'Company ID is required'::text;
    RETURN;
  END IF;

  -- Get group name and validate it belongs to this company
  SELECT tg.name INTO v_group_name
  FROM table_groups tg
  WHERE tg.id = p_group_id AND tg.company_id = p_company_id;

  IF v_group_name IS NULL THEN
    RETURN QUERY SELECT 
      '[]'::jsonb,
      0,
      false,
      'Table group not found or does not belong to this company'::text;
    RETURN;
  END IF;

  -- Get available tables in this group ordered by priority_order (adjacency indicator)
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_number', t.table_number,
      'seats', t.seats,
      'priority_order', tgm.priority_order,
      'table_name', t.table_name
    ) ORDER BY tgm.priority_order ASC
  )
  INTO v_available_tables
  FROM table_group_memberships tgm
  JOIN tables t ON t.table_number = tgm.table_number AND t.company_id = tgm.company_id
  WHERE tgm.group_id = p_group_id
    AND tgm.company_id = p_company_id
    AND t.company_id = p_company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available';

  IF v_available_tables IS NULL OR jsonb_array_length(v_available_tables) = 0 THEN
    RETURN QUERY SELECT 
      '[]'::jsonb,
      0,
      false,
      format('No available tables in group "%s"', v_group_name)::text;
    RETURN;
  END IF;

  -- Find best contiguous combination
  -- A contiguous combination means consecutive priority_order values
  FOR i IN 0..(jsonb_array_length(v_available_tables) - 1) LOOP
    FOR j IN i..(jsonb_array_length(v_available_tables) - 1) LOOP
      -- Check if this range has consecutive priority_orders (contiguous)
      DECLARE
        v_is_contiguous boolean := true;
        v_prev_priority integer := NULL;
        v_combo_capacity integer := 0;
        v_combo_tables jsonb := '[]'::jsonb;
      BEGIN
        FOR k IN i..j LOOP
          DECLARE
            v_table jsonb := v_available_tables->k;
            v_current_priority integer := (v_table->>'priority_order')::integer;
          BEGIN
            -- Check contiguity: priority_order must be consecutive
            IF v_prev_priority IS NOT NULL AND v_current_priority != v_prev_priority + 1 THEN
              v_is_contiguous := false;
              EXIT;
            END IF;
            
            v_prev_priority := v_current_priority;
            v_combo_capacity := v_combo_capacity + (v_table->>'seats')::integer;
            v_combo_tables := v_combo_tables || jsonb_build_array(v_table);
          END;
        END LOOP;

        -- Only consider if contiguous and meets party size
        IF v_is_contiguous AND v_combo_capacity >= p_party_size THEN
          v_current_waste := v_combo_capacity - p_party_size;
          
          -- Update best if: better waste, or same waste but fewer tables
          IF v_current_waste < v_best_waste OR 
             (v_current_waste = v_best_waste AND jsonb_array_length(v_combo_tables) < jsonb_array_length(v_best_combination)) THEN
            v_best_combination := v_combo_tables;
            v_best_capacity := v_combo_capacity;
            v_best_waste := v_current_waste;
          END IF;
        END IF;
      END;
    END LOOP;
  END LOOP;

  -- Return results
  IF jsonb_array_length(v_best_combination) > 0 THEN
    RETURN QUERY SELECT 
      v_best_combination,
      v_best_capacity,
      true,
      format('Found %s contiguous table(s) in "%s" with %s seats (waste: %s)',
        jsonb_array_length(v_best_combination),
        v_group_name,
        v_best_capacity,
        v_best_waste
      )::text;
  ELSE
    RETURN QUERY SELECT 
      '[]'::jsonb,
      0,
      false,
      format('No contiguous table combination found in "%s" for party of %s', v_group_name, p_party_size)::text;
  END IF;
END;
$$;