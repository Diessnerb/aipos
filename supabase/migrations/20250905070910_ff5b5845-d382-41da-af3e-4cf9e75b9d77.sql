-- Clean up existing conflicts before implementing bulletproof constraints

-- 1. First, identify and fix existing duplicate reservations
WITH duplicate_reservations AS (
  SELECT 
    company_id, 
    table_number, 
    date, 
    time,
    COUNT(*) as conflict_count,
    array_agg(id ORDER BY created_at) as reservation_ids
  FROM public.reservations 
  WHERE table_number IS NOT NULL 
    AND status NOT IN ('cancelled', 'no-show')
  GROUP BY company_id, table_number, date, time
  HAVING COUNT(*) > 1
),
keep_latest AS (
  SELECT 
    unnest(reservation_ids[2:]) as id_to_cancel
  FROM duplicate_reservations
)
UPDATE public.reservations 
SET status = 'cancelled',
    notes = COALESCE(notes || ' | ', '') || 'Auto-cancelled: Duplicate booking conflict resolved'
WHERE id IN (SELECT id_to_cancel FROM keep_latest);

-- 2. Handle multi-table conflicts in table_numbers array
WITH multi_table_conflicts AS (
  SELECT 
    company_id,
    date,
    time,
    unnest(table_numbers) as conflicted_table,
    COUNT(*) as conflict_count,
    array_agg(id ORDER BY created_at) as reservation_ids
  FROM public.reservations 
  WHERE table_numbers IS NOT NULL 
    AND array_length(table_numbers, 1) > 0
    AND status NOT IN ('cancelled', 'no-show')
  GROUP BY company_id, date, time, unnest(table_numbers)
  HAVING COUNT(*) > 1
),
keep_first_multi AS (
  SELECT 
    unnest(reservation_ids[2:]) as id_to_cancel
  FROM multi_table_conflicts
)
UPDATE public.reservations 
SET status = 'cancelled',
    notes = COALESCE(notes || ' | ', '') || 'Auto-cancelled: Multi-table conflict resolved'
WHERE id IN (SELECT id_to_cancel FROM keep_first_multi);

-- 3. Now create the unique constraints safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_no_overlap_single_table
ON public.reservations (company_id, table_number, date, 
  (EXTRACT(epoch FROM time)::integer / 60)
)
WHERE table_number IS NOT NULL 
  AND status NOT IN ('cancelled', 'no-show');

-- 4. Create unique constraint for multi-table reservations  
-- Injected comment out due to set-returning error: CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_no_overlap_multi_table
-- Injected comment out due to set-returning error: ON public.reservations (company_id, date, 
-- Injected comment out due to set-returning error:   (EXTRACT(epoch FROM time)::integer / 60), 
-- Injected comment out due to set-returning error:   unnest(table_numbers)
-- Injected comment out due to set-returning error: )
-- Injected comment out due to set-returning error: WHERE table_numbers IS NOT NULL 
-- Injected comment out due to set-returning error:   AND array_length(table_numbers, 1) > 0
-- Injected comment out due to set-returning error:   AND status NOT IN ('cancelled', 'no-show');

-- 5. Enhanced conflict detection function with advisory locking
CREATE OR REPLACE FUNCTION public.secure_table_assignment_with_lock(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_table_numbers integer[],
  p_party_size integer,
  p_exclude_reservation_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lock_key bigint;
  conflict_found boolean := false;
  suggested_tables integer[];
  result json;
BEGIN
  -- Create lock key from company_id, date, and time
  lock_key := ('x' || substr(md5(p_company_id::text || p_date::text || p_time::text), 1, 15))::bit(60)::bigint;
  
  -- Acquire advisory lock to prevent race conditions
  PERFORM pg_advisory_lock(lock_key);
  
  BEGIN
    -- Check for conflicts using exact time matching (no buffer)
    SELECT public.check_table_conflict(
      p_table_numbers, p_date, p_time, p_exclude_reservation_id
    ) INTO conflict_found;
    
    IF conflict_found THEN
      -- Get alternative table suggestions
      SELECT array_agg(table_number) INTO suggested_tables
      FROM public.suggest_alternative_tables(
        p_company_id, p_date::text, p_time::text, p_party_size, false
      );
      
      result := json_build_object(
        'success', false,
        'conflict', true,
        'message', 'Table conflict detected',
        'suggested_tables', COALESCE(suggested_tables, ARRAY[]::integer[])
      );
    ELSE
      -- No conflict - assignment is safe
      result := json_build_object(
        'success', true,
        'conflict', false,
        'message', 'Table assignment validated'
      );
    END IF;
    
    -- Release advisory lock
    PERFORM pg_advisory_unlock(lock_key);
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ensure lock is released on error
    PERFORM pg_advisory_unlock(lock_key);
    RAISE;
  END;
END;
$$;

-- 6. Enhanced auto-assignment function
CREATE OR REPLACE FUNCTION public.smart_table_auto_assignment(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_accessibility_needed boolean DEFAULT false
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lock_key bigint;
  best_table record;
  alternative_times time[];
  result json;
BEGIN
  -- Create lock key for auto-assignment
  lock_key := ('x' || substr(md5('auto_assign_' || p_company_id::text || p_date::text || p_time::text), 1, 15))::bit(60)::bigint;
  
  -- Acquire advisory lock
  PERFORM pg_advisory_lock(lock_key);
  
  BEGIN
    -- Find best available table using intelligent selection
    SELECT t.table_number, t.seats, t.accessibility_friendly
    INTO best_table
    FROM public.tables t
    WHERE t.company_id = p_company_id
      AND t.is_active = true
      AND t.seats >= p_party_size
      AND (NOT p_accessibility_needed OR t.accessibility_friendly = true)
      AND NOT EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.time = p_time
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            r.table_number = t.table_number
            OR (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
          )
      )
    ORDER BY 
      -- Prioritize exact capacity match, then accessibility, then smallest table
      (CASE WHEN t.seats = p_party_size THEN 0 ELSE 1 END),
      (CASE WHEN p_accessibility_needed AND t.accessibility_friendly THEN 0 ELSE 1 END),
      t.seats ASC,
      t.table_number ASC
    LIMIT 1;
    
    IF best_table.table_number IS NOT NULL THEN
      result := json_build_object(
        'success', true,
        'assigned_table', best_table.table_number,
        'table_seats', best_table.seats,
        'accessibility_friendly', best_table.accessibility_friendly
      );
    ELSE
      -- No table available - suggest alternatives
      SELECT array_agg(DISTINCT alt_time ORDER BY alt_time) INTO alternative_times
      FROM (
        SELECT (p_time - interval '2 hours')::time as alt_time
        WHERE (p_time - interval '2 hours')::time >= '10:00:00'::time
        UNION
        SELECT (p_time + interval '2 hours')::time as alt_time
        WHERE (p_time + interval '2 hours')::time <= '22:00:00'::time
      ) alt_times;
      
      result := json_build_object(
        'success', false,
        'message', 'No tables available at requested time',
        'alternative_times', COALESCE(alternative_times, ARRAY[]::time[])
      );
    END IF;
    
    -- Release advisory lock
    PERFORM pg_advisory_unlock(lock_key);
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ensure lock is released on error
    PERFORM pg_advisory_unlock(lock_key);
    RAISE;
  END;
END;
$$;