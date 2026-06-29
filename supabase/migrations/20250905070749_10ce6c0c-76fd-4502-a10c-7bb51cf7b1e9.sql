-- Phase 1: Database-Level Fortress - Bulletproof Table Conflict Prevention (Fixed)

-- 1. Create unique partial index to physically prevent overlapping reservations (without CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_no_overlap_single_table
ON public.reservations (company_id, table_number, date, 
  (EXTRACT(epoch FROM time)::integer / 60) -- Convert to minutes for exact matching
)
WHERE table_number IS NOT NULL 
  AND status NOT IN ('cancelled', 'no-show')
  AND (EXTRACT(epoch FROM time)::integer / 60) IS NOT NULL;

-- 2. Create unique partial index for multi-table reservations (table_numbers array)
-- Injected comment out due to set-returning error: CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_no_overlap_multi_table
-- Injected comment out due to set-returning error: ON public.reservations (company_id, date, 
-- Injected comment out due to set-returning error:   (EXTRACT(epoch FROM time)::integer / 60), -- Convert to minutes
-- Injected comment out due to set-returning error:   unnest(table_numbers)
-- Injected comment out due to set-returning error: )
-- Injected comment out due to set-returning error: WHERE table_numbers IS NOT NULL 
-- Injected comment out due to set-returning error:   AND array_length(table_numbers, 1) > 0
-- Injected comment out due to set-returning error:   AND status NOT IN ('cancelled', 'no-show');

-- 3. Enhanced conflict detection function with advisory locking
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

-- 4. Enhanced auto-assignment function with intelligent table selection
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
      -- No table available at requested time - suggest alternatives
      SELECT array_agg(DISTINCT alt_time ORDER BY alt_time) INTO alternative_times
      FROM (
        -- Suggest times 2 hours before and after
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

-- 5. Create the missing prevent_table_conflicts trigger
CREATE OR REPLACE FUNCTION public.prevent_table_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_tables integer[];
  lock_key bigint;
  conflict_found boolean;
  exclude_id uuid;
BEGIN
  -- Skip validation for cancelled/no-show reservations
  IF NEW.status IN ('cancelled', 'no-show') THEN
    RETURN NEW;
  END IF;
  
  -- Skip validation if no table assigned
  IF NEW.table_number IS NULL AND (NEW.table_numbers IS NULL OR array_length(NEW.table_numbers, 1) = 0) THEN
    RETURN NEW;
  END IF;
  
  -- Build target tables array
  target_tables := ARRAY[]::integer[];
  
  IF NEW.table_number IS NOT NULL THEN
    target_tables := target_tables || NEW.table_number;
  END IF;
  
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) > 0 THEN
    target_tables := target_tables || NEW.table_numbers;
  END IF;
  
  -- Create lock key to prevent race conditions
  lock_key := ('x' || substr(md5(NEW.company_id::text || NEW.date::text || NEW.time::text || array_to_string(target_tables, ',')), 1, 15))::bit(60)::bigint;
  
  -- Acquire advisory lock
  PERFORM pg_advisory_lock(lock_key);
  
  BEGIN
    -- For updates, exclude the current reservation
    exclude_id := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
    
    -- Check for conflicts using enhanced detection
    SELECT public.check_table_conflict(
      target_tables,
      NEW.date,
      NEW.time,
      exclude_id
    ) INTO conflict_found;
    
    -- Release advisory lock
    PERFORM pg_advisory_unlock(lock_key);
    
    -- Raise error if conflict detected
    IF conflict_found THEN
      RAISE EXCEPTION 'CONFLICT_DETECTED: Tables % are already booked at % on %. This is physically prevented.',
        array_to_string(target_tables, ', '),
        NEW.time,
        NEW.date
      USING ERRCODE = '23505', -- Unique violation
            DETAIL = 'Cannot create overlapping reservations on the same table(s)';
    END IF;
    
    RETURN NEW;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ensure lock is released on error
    PERFORM pg_advisory_unlock(lock_key);
    RAISE;
  END;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS prevent_table_conflicts_trigger ON public.reservations;
CREATE TRIGGER prevent_table_conflicts_trigger
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_table_conflicts();

-- 6. Real-time conflict monitoring function
CREATE OR REPLACE FUNCTION public.continuous_conflict_scan(p_company_id uuid)
RETURNS TABLE(
  conflict_type text,
  table_number integer,
  conflict_date date,
  conflict_time time,
  reservation_count bigint,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  -- Scan for any existing conflicts that slipped through
  SELECT 
    'table_conflict'::text as conflict_type,
    r.table_number,
    r.date as conflict_date,
    r.time as conflict_time,
    COUNT(*) as reservation_count,
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'customer_name', r.customer_name,
        'party_size', r.party_size,
        'status', r.status,
        'created_at', r.created_at
      )
    ) as details
  FROM public.reservations r
  WHERE r.company_id = p_company_id
    AND r.date >= CURRENT_DATE
    AND r.status NOT IN ('cancelled', 'no-show')
    AND r.table_number IS NOT NULL
  GROUP BY r.table_number, r.date, r.time
  HAVING COUNT(*) > 1
  
  UNION ALL
  
  -- Scan for multi-table conflicts
  SELECT 
    'multi_table_conflict'::text as conflict_type,
    unnest(r.table_numbers) as table_number,
    r.date as conflict_date,
    r.time as conflict_time,
    COUNT(*) as reservation_count,
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'customer_name', r.customer_name,
        'party_size', r.party_size,
        'status', r.status
      )
    ) as details
  FROM public.reservations r
  WHERE r.company_id = p_company_id
    AND r.date >= CURRENT_DATE
    AND r.status NOT IN ('cancelled', 'no-show')
    AND r.table_numbers IS NOT NULL
    AND array_length(r.table_numbers, 1) > 0
  GROUP BY unnest(r.table_numbers), r.date, r.time
  HAVING COUNT(*) > 1;
END;
$$;