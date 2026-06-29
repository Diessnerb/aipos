-- Create comprehensive table conflict prevention system

-- 1. Create a function to check for table conflicts with standardized 2-hour duration
CREATE OR REPLACE FUNCTION public.check_table_conflict(
  p_table_numbers integer[],
  p_date date,
  p_time time,
  p_exclude_reservation_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  conflict_count integer;
  start_minutes integer;
  end_minutes integer;
BEGIN
  -- Convert time to minutes for comparison
  start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := start_minutes + 120; -- Standardized 2-hour duration
  
  -- Check for overlapping reservations on any of the specified tables
  SELECT COUNT(*) INTO conflict_count
  FROM public.reservations r
  WHERE r.date = p_date
    AND r.status NOT IN ('cancelled', 'no-show')
    AND (p_exclude_reservation_id IS NULL OR r.id != p_exclude_reservation_id)
    AND (
      -- Check table_number field
      (r.table_number IS NOT NULL AND r.table_number = ANY(p_table_numbers))
      OR
      -- Check table_numbers array field
      (r.table_numbers IS NOT NULL AND r.table_numbers && p_table_numbers)
    )
    AND (
      -- Time overlap check (2-hour duration for both reservations)
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
      AND 
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > start_minutes
    );
  
  RETURN conflict_count > 0;
END;
$$;

-- 2. Create a function to prevent table conflicts on insert/update
CREATE OR REPLACE FUNCTION public.prevent_table_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_tables integer[];
  has_conflict boolean;
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
  
  -- For updates, exclude the current reservation
  exclude_id := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
  
  -- Check for conflicts
  SELECT public.check_table_conflict(
    target_tables,
    NEW.date,
    NEW.time,
    exclude_id
  ) INTO has_conflict;
  
  -- Raise error if conflict detected
  IF has_conflict THEN
    RAISE EXCEPTION 'Table conflict detected: Tables % are already booked at % on %. Please choose a different time or table.',
      array_to_string(target_tables, ', '),
      NEW.time,
      NEW.date
    USING ERRCODE = 'check_violation',
          DETAIL = 'Multiple reservations cannot be placed on the same table at overlapping times';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create trigger to enforce table conflict prevention
DROP TRIGGER IF EXISTS prevent_table_conflicts_trigger ON public.reservations;
CREATE TRIGGER prevent_table_conflicts_trigger
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_table_conflicts();

-- 4. Create function to detect existing double bookings
CREATE OR REPLACE FUNCTION public.detect_existing_double_bookings(p_company_id uuid)
RETURNS TABLE(
  conflict_date date,
  conflict_time time,
  table_number integer,
  reservation_count bigint,
  reservation_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH table_conflicts AS (
    -- Find conflicts using table_number field
    SELECT 
      r.date,
      r.time,
      r.table_number as conflicted_table,
      COUNT(*) as res_count,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'customer_name', r.customer_name,
          'party_size', r.party_size,
          'status', r.status,
          'phone', r.phone
        )
      ) as details
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.table_number IS NOT NULL
      AND r.status NOT IN ('cancelled', 'no-show')
      AND r.date >= CURRENT_DATE
    GROUP BY r.date, r.time, r.table_number
    HAVING COUNT(*) > 1
    
    UNION
    
    -- Find conflicts using table_numbers array field
    SELECT 
      r.date,
      r.time,
      unnest(r.table_numbers) as conflicted_table,
      COUNT(*) as res_count,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'customer_name', r.customer_name,
          'party_size', r.party_size,
          'status', r.status,
          'phone', r.phone
        )
      ) as details
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.table_numbers IS NOT NULL
      AND array_length(r.table_numbers, 1) > 0
      AND r.status NOT IN ('cancelled', 'no-show')
      AND r.date >= CURRENT_DATE
    GROUP BY r.date, r.time, unnest(r.table_numbers)
    HAVING COUNT(*) > 1
  )
  SELECT 
    tc.date,
    tc.time,
    tc.conflicted_table,
    tc.res_count,
    tc.details
  FROM table_conflicts tc
  ORDER BY tc.date, tc.time, tc.conflicted_table;
END;
$$;

-- 5. Create function to get alternative table suggestions
CREATE OR REPLACE FUNCTION public.suggest_alternative_tables(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_accessibility_needed boolean DEFAULT false
)
RETURNS TABLE(
  table_number integer,
  seats integer,
  accessibility_friendly boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_number,
    t.seats,
    COALESCE(t.accessibility_friendly, false)
  FROM public.tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
    AND t.seats >= p_party_size
    AND (NOT p_accessibility_needed OR COALESCE(t.accessibility_friendly, false) = true)
    AND NOT public.check_table_conflict(
      ARRAY[t.table_number],
      p_date,
      p_time
    )
  ORDER BY t.seats ASC, t.table_number ASC;
END;
$$;