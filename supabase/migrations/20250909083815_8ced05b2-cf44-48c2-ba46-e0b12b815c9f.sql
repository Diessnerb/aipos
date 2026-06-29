-- Create comprehensive table assignment triggers and functions for large parties

-- 1. Create function to select contiguous priority tables from groups
CREATE OR REPLACE FUNCTION public.select_contiguous_group_tables(
  p_group_id UUID,
  p_party_size INTEGER,
  p_company_id UUID
) RETURNS TABLE(
  table_numbers INTEGER[],
  total_seats INTEGER,
  strategy TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tables RECORD;
  v_current_tables INTEGER[] := '{}';
  v_current_seats INTEGER := 0;
  v_min_tables_needed INTEGER;
  v_best_tables INTEGER[] := '{}';
  v_best_seats INTEGER := 0;
  v_best_strategy TEXT := 'full_group';
BEGIN
  -- Get all tables in group sorted by priority
  FOR v_tables IN 
    SELECT 
      t.table_number,
      t.seats,
      tgm.priority_order
    FROM tables t
    JOIN table_group_memberships tgm ON t.id = tgm.table_id
    WHERE tgm.group_id = p_group_id
      AND t.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
    ORDER BY tgm.priority_order
  LOOP
    -- Add current table to selection
    v_current_tables := v_current_tables || v_tables.table_number;
    v_current_seats := v_current_seats + v_tables.seats;
    
    -- If we have enough seats, this is a valid selection
    IF v_current_seats >= p_party_size THEN
      -- If this is our first valid selection or it uses fewer tables, update best
      IF v_best_tables = '{}' OR array_length(v_current_tables, 1) < array_length(v_best_tables, 1) THEN
        v_best_tables := v_current_tables;
        v_best_seats := v_current_seats;
        v_best_strategy := CASE 
          WHEN array_length(v_current_tables, 1) = 1 THEN 'single_table'
          ELSE 'contiguous_group'
        END;
      END IF;
    END IF;
  END LOOP;
  
  -- Return best selection if found
  IF v_best_tables != '{}' THEN
    table_numbers := v_best_tables;
    total_seats := v_best_seats;
    strategy := v_best_strategy;
    RETURN NEXT;
  END IF;
END;
$$;

-- 2. Create enhanced auto-assignment trigger function
CREATE OR REPLACE FUNCTION public.adjust_reservation_tables_for_capacity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    FOR v_group_selection IN
      SELECT 
        tg.id as group_id,
        tg.group_name,
        tg.max_combined_capacity,
        s.table_numbers,
        s.total_seats,
        s.strategy
      FROM table_groups tg
      CROSS JOIN LATERAL select_contiguous_group_tables(tg.id, NEW.party_size, NEW.company_id) s
      WHERE tg.company_id = NEW.company_id
        AND tg.is_active = true
        AND tg.max_combined_capacity >= NEW.party_size
        AND s.table_numbers IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
          WHERE r.company_id = NEW.company_id
            AND r.date = NEW.date
            AND r.status NOT IN ('cancelled', 'no-show')
            AND (r.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid))
            AND (
              (r.table_number IS NOT NULL AND r.table_number = ANY(s.table_numbers))
              OR (r.table_numbers IS NOT NULL AND r.table_numbers && s.table_numbers)
            )
            AND (
              -- Time overlap check
              (EXTRACT(epoch FROM r.time::time) / 60) < (EXTRACT(epoch FROM NEW.time::time) / 60) + 120
              AND (EXTRACT(epoch FROM r.time::time) / 60) + 120 > (EXTRACT(epoch FROM NEW.time::time) / 60)
            )
        )
      ORDER BY 
        s.strategy = 'single_table' DESC,  -- Prefer single table within group
        array_length(s.table_numbers, 1) ASC,  -- Then prefer fewer tables
        s.total_seats ASC  -- Then prefer smaller total capacity
      LIMIT 1
    LOOP
      -- Assign the selected tables from group
      IF array_length(v_group_selection.table_numbers, 1) = 1 THEN
        NEW.table_number := v_group_selection.table_numbers[1];
        NEW.table_numbers := NULL;
      ELSE
        NEW.table_number := NULL;
        NEW.table_numbers := v_group_selection.table_numbers;
      END IF;
      RETURN NEW;
    END LOOP;
    
    -- Third try failed: Unassign tables to force manual assignment
    NEW.table_number := NULL;
    NEW.table_numbers := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Update auto_assign_table_on_insert to avoid assigning insufficient tables
CREATE OR REPLACE FUNCTION public.auto_assign_table_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    target_table_number INTEGER;
    target_table_seats INTEGER;
    conflicting_reservation_id UUID;
BEGIN
    -- Only proceed if table assignment is null and company has auto-assignment enabled
    IF NEW.table_number IS NOT NULL OR NEW.table_numbers IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Find available table that can actually accommodate the party
    SELECT t.table_number, t.seats INTO target_table_number, target_table_seats
    FROM public.tables t
    WHERE t.company_id = NEW.company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available'
    AND t.seats >= NEW.party_size  -- CRITICAL: Only assign if table is large enough
    AND NOT EXISTS (
        SELECT 1 
        FROM public.reservations r
        WHERE r.company_id = NEW.company_id
        AND r.date = NEW.date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND r.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (
            -- Single table conflicts
            (r.table_number = t.table_number)
            OR
            -- Multi-table conflicts  
            (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
        )
        AND (
            -- Time overlap check
            (EXTRACT(epoch FROM r.time::time) / 60) < (EXTRACT(epoch FROM NEW.time::time) / 60) + 120
            AND (EXTRACT(epoch FROM r.time::time) / 60) + 120 > (EXTRACT(epoch FROM NEW.time::time) / 60)
        )
    )
    ORDER BY 
        t.seats ASC,  -- Prefer smallest suitable table
        t.table_number ASC
    LIMIT 1;
    
    -- Assign the table if found and suitable
    IF target_table_number IS NOT NULL AND target_table_seats >= NEW.party_size THEN
        NEW.table_number := target_table_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- 4. Create triggers
DROP TRIGGER IF EXISTS trigger_adjust_reservation_tables ON public.reservations;
CREATE TRIGGER trigger_adjust_reservation_tables
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_reservation_tables_for_capacity();

-- Ensure auto-assignment trigger runs after adjustment trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_table ON public.reservations;
CREATE TRIGGER trigger_auto_assign_table
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_table_on_insert();