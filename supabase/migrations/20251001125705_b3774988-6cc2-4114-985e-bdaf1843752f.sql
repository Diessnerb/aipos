-- Fix the adjust_reservation_tables_for_capacity trigger function
-- to use the correct field names from select_contiguous_group_tables
CREATE OR REPLACE FUNCTION public.adjust_reservation_tables_for_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned_capacity INTEGER := 0;
  v_group_selection RECORD;
  v_single_table RECORD;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Skip if not INSERT/UPDATE or if already properly assigned
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no company_id
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Acquire advisory lock to prevent race conditions
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(md5(NEW.company_id::text || NEW.date || NEW.time), 1, 8))::bit(32)::bigint
  ) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    RAISE WARNING 'Could not acquire advisory lock for table assignment';
    RETURN NEW;
  END IF;
  
  -- Calculate current assigned capacity
  IF NEW.table_number IS NOT NULL THEN
    SELECT COALESCE(seats, 0) INTO v_assigned_capacity
    FROM tables 
    WHERE table_number = NEW.table_number 
      AND company_id = NEW.company_id 
      AND is_active = true;
  END IF;
  
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) > 0 THEN
    SELECT COALESCE(SUM(seats), 0) INTO v_assigned_capacity
    FROM tables 
    WHERE table_number = ANY(NEW.table_numbers)
      AND company_id = NEW.company_id 
      AND is_active = true;
  END IF;
  
  -- If current assignment is insufficient, try to fix it
  IF v_assigned_capacity < NEW.party_size THEN
    -- First try: Find single table that can accommodate
    SELECT t.table_number, t.seats INTO v_single_table
    FROM tables t
    WHERE t.company_id = NEW.company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
      AND t.seats >= NEW.party_size
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.company_id = NEW.company_id
          AND r.date = NEW.date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (r.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid))
          AND (
            r.table_number = t.table_number
            OR (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
          )
          AND (
            -- Time overlap check (2-hour duration)
            (EXTRACT(epoch FROM r.time::time) / 60) < (EXTRACT(epoch FROM NEW.time::time) / 60) + 120
            AND (EXTRACT(epoch FROM r.time::time) / 60) + 120 > (EXTRACT(epoch FROM NEW.time::time) / 60)
          )
      )
    ORDER BY t.seats ASC  -- Prefer smallest suitable table
    LIMIT 1;
    
    IF v_single_table.table_number IS NOT NULL THEN
      -- Assign single table
      NEW.table_number := v_single_table.table_number;
      NEW.table_numbers := NULL;
      RETURN NEW;
    END IF;
    
    -- Second try: Find table group that can accommodate with contiguous selection
    -- Fixed: Use correct field names from select_contiguous_group_tables
    FOR v_group_selection IN
      SELECT 
        tg.id as group_id,
        tg.group_name,
        tg.max_combined_capacity,
        s.selected_tables,  -- FIXED: was s.table_numbers
        s.total_capacity,   -- FIXED: was s.total_seats
        s.efficiency_score  -- FIXED: was s.strategy
      FROM table_groups tg
      CROSS JOIN LATERAL select_contiguous_group_tables(tg.id, NEW.party_size, NEW.company_id) s
      WHERE tg.company_id = NEW.company_id
        AND tg.is_active = true
        AND tg.max_combined_capacity >= NEW.party_size
        AND s.selected_tables IS NOT NULL  -- FIXED: was s.table_numbers
        AND array_length(s.selected_tables, 1) > 0  -- FIXED: was s.table_numbers
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
          WHERE r.company_id = NEW.company_id
            AND r.date = NEW.date
            AND r.status NOT IN ('cancelled', 'no-show')
            AND (r.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid))
            AND (
              (r.table_number IS NOT NULL AND r.table_number = ANY(s.selected_tables))  -- FIXED
              OR (r.table_numbers IS NOT NULL AND r.table_numbers && s.selected_tables)  -- FIXED
            )
            AND (
              -- Time overlap check
              (EXTRACT(epoch FROM r.time::time) / 60) < (EXTRACT(epoch FROM NEW.time::time) / 60) + 120
              AND (EXTRACT(epoch FROM r.time::time) / 60) + 120 > (EXTRACT(epoch FROM NEW.time::time) / 60)
            )
        )
      ORDER BY 
        array_length(s.selected_tables, 1) ASC,  -- FIXED: Prefer fewer tables
        s.total_capacity ASC  -- FIXED: was s.total_seats
      LIMIT 1
    LOOP
      -- Assign the selected tables from group
      IF array_length(v_group_selection.selected_tables, 1) = 1 THEN  -- FIXED
        NEW.table_number := v_group_selection.selected_tables[1];  -- FIXED
        NEW.table_numbers := NULL;
      ELSE
        NEW.table_number := NULL;
        NEW.table_numbers := v_group_selection.selected_tables;  -- FIXED
      END IF;
      RETURN NEW;
    END LOOP;
    
    -- Third try failed: Unassign tables to force manual assignment
    NEW.table_number := NULL;
    NEW.table_numbers := NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;