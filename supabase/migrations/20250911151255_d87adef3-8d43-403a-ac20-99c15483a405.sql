-- Phase 1: Database Schema Extensions for Advanced Table Groups

-- 1. Add advanced_settings JSONB column and group_priority to table_groups
ALTER TABLE table_groups 
ADD COLUMN IF NOT EXISTS advanced_settings JSONB DEFAULT '{
  "capacity_mode": "auto",
  "seat_loss_per_connection": 1,
  "capacity_maps": {},
  "overlap_strategy": "prefer_exclusive",
  "contiguous_required": true,
  "min_tables_required": 1,
  "allow_partial_usage": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS group_priority INTEGER DEFAULT 0;

-- 2. Create index for group_priority ordering
CREATE INDEX IF NOT EXISTS idx_table_groups_priority ON table_groups(company_id, group_priority);

-- 3. Create function to reorder group priorities
DROP FUNCTION IF EXISTS reorder_table_group_priorities(p_company_id UUID, p_group_orders JSONB) CASCADE;
CREATE OR REPLACE FUNCTION reorder_table_group_priorities(
  p_company_id UUID,
  p_group_orders JSONB -- Array of {group_id, new_priority}
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_group_order JSONB;
  v_group_id UUID;
  v_priority INTEGER;
BEGIN
  -- Update each group priority
  FOR v_group_order IN SELECT jsonb_array_elements(p_group_orders)
  LOOP
    v_group_id := (v_group_order->>'group_id')::UUID;
    v_priority := (v_group_order->>'priority')::INTEGER;
    
    UPDATE table_groups 
    SET group_priority = v_priority,
        updated_at = now()
    WHERE id = v_group_id 
      AND company_id = p_company_id;
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Group priorities updated');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. Enhanced function to calculate group partial capacity with advanced settings
DROP FUNCTION IF EXISTS calculate_group_partial_capacity(p_group_id UUID, p_company_id UUID, p_used_tables INTEGER[]) CASCADE;
CREATE OR REPLACE FUNCTION calculate_group_partial_capacity(
  p_group_id UUID,
  p_company_id UUID,
  p_used_tables INTEGER[] DEFAULT ARRAY[]::INTEGER[]
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_group_record RECORD;
  v_total_capacity INTEGER := 0;
  v_available_capacity INTEGER := 0;
  v_table_record RECORD;
  v_settings JSONB;
  v_capacity_mode TEXT;
  v_seat_loss INTEGER;
  v_table_count INTEGER := 0;
  v_used_count INTEGER := 0;
BEGIN
  -- Get group details with advanced settings
  SELECT tg.*, tg.advanced_settings
  INTO v_group_record
  FROM table_groups tg
  WHERE tg.id = p_group_id AND tg.company_id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;
  
  v_settings := COALESCE(v_group_record.advanced_settings, '{}'::jsonb);
  v_capacity_mode := COALESCE(v_settings->>'capacity_mode', 'auto');
  v_seat_loss := COALESCE((v_settings->>'seat_loss_per_connection')::INTEGER, 1);
  
  -- Calculate capacity based on mode
  IF v_capacity_mode = 'manual' THEN
    -- Use manual override from max_combined_capacity
    v_total_capacity := v_group_record.max_combined_capacity;
    
    -- Calculate available by checking which tables are used
    SELECT COUNT(*) INTO v_table_count
    FROM table_group_memberships tgm
    JOIN tables t ON tgm.table_id = t.id
    WHERE tgm.group_id = p_group_id AND t.is_active = true;
    
    SELECT COUNT(*) INTO v_used_count
    FROM table_group_memberships tgm
    JOIN tables t ON tgm.table_id = t.id
    WHERE tgm.group_id = p_group_id 
      AND t.table_number = ANY(p_used_tables)
      AND t.is_active = true;
    
    -- Proportional reduction for partial usage
    IF v_table_count > 0 THEN
      v_available_capacity := v_total_capacity * (v_table_count - v_used_count) / v_table_count;
    END IF;
    
  ELSE
    -- Auto calculation with seat loss
    FOR v_table_record IN
      SELECT t.seats, t.table_number
      FROM table_group_memberships tgm
      JOIN tables t ON tgm.table_id = t.id
      WHERE tgm.group_id = p_group_id 
        AND t.is_active = true
        AND COALESCE(t.service_status, 'available') = 'available'
      ORDER BY tgm.priority_order
    LOOP
      v_table_count := v_table_count + 1;
      
      IF NOT (v_table_record.table_number = ANY(p_used_tables)) THEN
        v_available_capacity := v_available_capacity + v_table_record.seats;
      END IF;
      
      v_total_capacity := v_total_capacity + v_table_record.seats;
    END LOOP;
    
    -- Apply seat loss for connections (if more than 1 table)
    IF v_table_count > 1 THEN
      v_total_capacity := v_total_capacity - (v_seat_loss * (v_table_count - 1));
      v_available_capacity := GREATEST(0, v_available_capacity - (v_seat_loss * (v_table_count - v_used_count - 1)));
    END IF;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'total_capacity', v_total_capacity,
    'available_capacity', v_available_capacity,
    'used_tables', array_length(p_used_tables, 1),
    'total_tables', v_table_count,
    'capacity_mode', v_capacity_mode
  );
END;
$$;

-- 5. Enhanced function for optimal group table selection with tiebreakers
DROP FUNCTION IF EXISTS select_optimal_group_tables(p_group_id UUID, p_party_size INTEGER, p_company_id UUID) CASCADE;
CREATE OR REPLACE FUNCTION select_optimal_group_tables(
  p_group_id UUID,
  p_party_size INTEGER,
  p_company_id UUID
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_group_record RECORD;
  v_table_record RECORD;
  v_selected_tables INTEGER[] := ARRAY[]::INTEGER[];
  v_total_seats INTEGER := 0;
  v_table_count INTEGER := 0;
  v_settings JSONB;
  v_contiguous_required BOOLEAN;
  v_min_tables INTEGER;
  v_single_table_option INTEGER := NULL;
BEGIN
  -- Get group details with advanced settings
  SELECT tg.*, tg.advanced_settings
  INTO v_group_record
  FROM table_groups tg
  WHERE tg.id = p_group_id AND tg.company_id = p_company_id AND tg.is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found or inactive');
  END IF;
  
  v_settings := COALESCE(v_group_record.advanced_settings, '{}'::jsonb);
  v_contiguous_required := COALESCE((v_settings->>'contiguous_required')::BOOLEAN, true);
  v_min_tables := COALESCE((v_settings->>'min_tables_required')::INTEGER, 1);
  
  -- First, check if any single table can handle the party size
  SELECT t.table_number INTO v_single_table_option
  FROM table_group_memberships tgm
  JOIN tables t ON tgm.table_id = t.id
  WHERE tgm.group_id = p_group_id 
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available'
    AND t.seats >= p_party_size
  ORDER BY tgm.priority_order
  LIMIT 1;
  
  -- If single table found and contiguous not required, prefer it (fewer tables priority)
  IF v_single_table_option IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'table_numbers', ARRAY[v_single_table_option],
      'total_seats', (SELECT seats FROM tables WHERE table_number = v_single_table_option AND company_id = p_company_id),
      'strategy', 'single_table',
      'table_count', 1,
      'seat_waste', (SELECT seats - p_party_size FROM tables WHERE table_number = v_single_table_option AND company_id = p_company_id)
    );
  END IF;
  
  -- Multi-table selection using priority order
  FOR v_table_record IN
    SELECT t.table_number, t.seats, tgm.priority_order
    FROM table_group_memberships tgm
    JOIN tables t ON tgm.table_id = t.id
    WHERE tgm.group_id = p_group_id 
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
    ORDER BY tgm.priority_order
  LOOP
    v_selected_tables := array_append(v_selected_tables, v_table_record.table_number);
    v_total_seats := v_total_seats + v_table_record.seats;
    v_table_count := v_table_count + 1;
    
    -- Check if we have enough capacity
    IF v_total_seats >= p_party_size AND v_table_count >= v_min_tables THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Validate we have enough capacity
  IF v_total_seats < p_party_size THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient capacity in group',
      'available_capacity', v_total_seats,
      'required_capacity', p_party_size
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'table_numbers', v_selected_tables,
    'total_seats', v_total_seats,
    'strategy', 'priority_contiguous',
    'table_count', v_table_count,
    'seat_waste', v_total_seats - p_party_size
  );
END;
$$;

-- 6. Update get_available_table_groups_with_status to include priority and advanced settings
DROP FUNCTION IF EXISTS get_available_table_groups_with_status(p_company_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION get_available_table_groups_with_status(p_company_id uuid)
RETURNS TABLE(
  group_id uuid, 
  group_name text, 
  description text, 
  max_combined_capacity integer, 
  is_active boolean, 
  display_order integer,
  group_priority integer,
  advanced_settings jsonb,
  table_numbers integer[], 
  can_combine boolean, 
  out_of_service_tables integer[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
      COALESCE(tg.group_priority, 0) as group_priority,
      COALESCE(tg.advanced_settings, '{}'::jsonb) as advanced_settings,
      array_agg(t.table_number ORDER BY tgm.priority_order) as table_numbers,
      -- Group can combine if no tables are out_of_service 
      NOT bool_or(COALESCE(t.service_status, 'available') = 'out_of_service') as can_combine,
      -- Track which tables are out of service for display
      array_agg(
        CASE WHEN COALESCE(t.service_status, 'available') = 'out_of_service' 
        THEN t.table_number 
        ELSE NULL END
      ) FILTER (WHERE COALESCE(t.service_status, 'available') = 'out_of_service') as out_of_service_tables
    FROM table_groups tg
    JOIN table_group_memberships tgm ON tg.id = tgm.group_id
    JOIN tables t ON tgm.table_id = t.id
    WHERE tg.company_id = p_company_id
      AND tg.is_active = true
      AND t.is_active = true
    GROUP BY tg.id, tg.group_name, tg.description, tg.max_combined_capacity, 
             tg.is_active, tg.display_order, tg.group_priority, tg.advanced_settings
  )
  SELECT 
    gd.group_id,
    gd.group_name,
    gd.description,
    gd.max_combined_capacity,
    gd.is_active,
    gd.display_order,
    gd.group_priority,
    gd.advanced_settings,
    gd.table_numbers,
    gd.can_combine,
    COALESCE(gd.out_of_service_tables, ARRAY[]::integer[])
  FROM group_data gd
  ORDER BY gd.group_priority ASC, gd.display_order ASC, gd.group_name ASC;
END;
$$;