-- Update check_comprehensive_availability function to include table groups, fix suggestions, and add messages
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id UUID,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER,
  p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_start_minutes INTEGER;
  v_end_minutes INTEGER;
  v_total_guests INTEGER := 0;
  v_total_tables INTEGER := 0;
  v_available_individual_capacity INTEGER := 0;
  v_available_group_capacity INTEGER := 0;
  v_max_group_capacity INTEGER := 0;
  v_suggestions JSONB := '[]'::JSONB;
  v_message TEXT;
  v_available BOOLEAN := FALSE;
  v_needs_staff_approval BOOLEAN := FALSE;
  v_load_status TEXT := 'low';
  v_suggestion_time TIME;
  v_suggestion_start INTEGER;
  v_suggestion_end INTEGER;
  v_suggestion_guests INTEGER;
  v_suggestion_tables INTEGER;
  v_suggestion_available BOOLEAN;
  time_slot RECORD;
BEGIN
  -- Convert requested time to minutes
  v_start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  v_end_minutes := v_start_minutes + p_duration_minutes;
  
  -- Check current load at requested time
  SELECT 
    COALESCE(SUM(r.party_size), 0),
    COUNT(DISTINCT COALESCE(array_length(r.table_numbers, 1), CASE WHEN r.table_number IS NOT NULL THEN 1 ELSE 0 END))
  INTO v_total_guests, v_total_tables
  FROM public.reservations r
  WHERE r.company_id = p_company_id
    AND r.date = p_date
    AND r.status NOT IN ('cancelled', 'no-show')
    AND (
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_end_minutes
      AND 
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_start_minutes
    );
  
  -- Calculate available individual table capacity
  SELECT COALESCE(SUM(t.seats), 0)
  INTO v_available_individual_capacity
  FROM public.tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available'
    AND t.table_number NOT IN (
      SELECT UNNEST(r.table_numbers)
      FROM public.reservations r
      WHERE r.company_id = p_company_id
        AND r.date = p_date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND r.table_numbers IS NOT NULL
        AND (
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_end_minutes
          AND 
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_start_minutes
        )
      UNION
      SELECT r.table_number
      FROM public.reservations r
      WHERE r.company_id = p_company_id
        AND r.date = p_date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND r.table_number IS NOT NULL
        AND (
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_end_minutes
          AND 
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_start_minutes
        )
    );
  
  -- Calculate available table group capacity
  SELECT COALESCE(MAX(tg_capacity.total_capacity), 0)
  INTO v_max_group_capacity
  FROM (
    SELECT SUM(t.seats) as total_capacity
    FROM public.table_groups tg
    JOIN public.table_group_memberships tgm ON tg.id = tgm.group_id
    JOIN public.tables t ON t.table_number = tgm.table_number AND t.company_id = tg.company_id
    WHERE tg.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
      AND t.table_number NOT IN (
        SELECT UNNEST(r.table_numbers)
        FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND r.table_numbers IS NOT NULL
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_end_minutes
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_start_minutes
          )
        UNION
        SELECT r.table_number
        FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND r.table_number IS NOT NULL
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_end_minutes
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_start_minutes
          )
      )
    GROUP BY tg.id
  ) tg_capacity;
  
  -- Use the higher capacity between individual tables and table groups
  v_available_group_capacity := GREATEST(v_available_individual_capacity, v_max_group_capacity);
  
  -- Determine load status
  IF v_total_guests >= 15 THEN
    v_load_status := 'high';
  ELSIF v_total_guests >= 8 THEN
    v_load_status := 'medium';
  END IF;
  
  -- Check availability based on business rules
  v_available := (
    v_total_guests + p_party_size <= 18 AND
    v_total_tables + 1 <= 3 AND
    v_available_group_capacity >= p_party_size
  );
  
  -- Set staff approval flag for high load
  v_needs_staff_approval := (v_load_status = 'high');
  
  -- Generate suggestions for ±15 minutes if main time is not available
  IF NOT v_available OR v_load_status = 'high' THEN
    -- Check 15 minutes earlier
    v_suggestion_time := (p_time - INTERVAL '15 minutes')::TIME;
    v_suggestion_start := EXTRACT(hour FROM v_suggestion_time) * 60 + EXTRACT(minute FROM v_suggestion_time);
    v_suggestion_end := v_suggestion_start + p_duration_minutes;
    
    -- Calculate load for earlier time
    SELECT 
      COALESCE(SUM(r.party_size), 0),
      COUNT(DISTINCT COALESCE(array_length(r.table_numbers, 1), CASE WHEN r.table_number IS NOT NULL THEN 1 ELSE 0 END))
    INTO v_suggestion_guests, v_suggestion_tables
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND (
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_suggestion_end
        AND 
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_suggestion_start
      );
    
    -- Check if earlier time meets business rules and low load requirement
    v_suggestion_available := (
      v_suggestion_guests + p_party_size <= 18 AND
      v_suggestion_tables + 1 <= 3 AND
      v_suggestion_guests < 8  -- Only suggest if it would be low load
    );
    
    IF v_suggestion_available THEN
      v_suggestions := v_suggestions || jsonb_build_object(
        'time', v_suggestion_time,
        'available', true,
        'load_status', 'low'
      );
    END IF;
    
    -- Check 15 minutes later
    v_suggestion_time := (p_time + INTERVAL '15 minutes')::TIME;
    v_suggestion_start := EXTRACT(hour FROM v_suggestion_time) * 60 + EXTRACT(minute FROM v_suggestion_time);
    v_suggestion_end := v_suggestion_start + p_duration_minutes;
    
    -- Calculate load for later time
    SELECT 
      COALESCE(SUM(r.party_size), 0),
      COUNT(DISTINCT COALESCE(array_length(r.table_numbers, 1), CASE WHEN r.table_number IS NOT NULL THEN 1 ELSE 0 END))
    INTO v_suggestion_guests, v_suggestion_tables
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND (
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_suggestion_end
        AND 
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + p_duration_minutes) > v_suggestion_start
      );
    
    -- Check if later time meets business rules and low load requirement
    v_suggestion_available := (
      v_suggestion_guests + p_party_size <= 18 AND
      v_suggestion_tables + 1 <= 3 AND
      v_suggestion_guests < 8  -- Only suggest if it would be low load
    );
    
    IF v_suggestion_available THEN
      v_suggestions := v_suggestions || jsonb_build_object(
        'time', v_suggestion_time,
        'available', true,
        'load_status', 'low'
      );
    END IF;
  END IF;
  
  -- Generate user-friendly messages
  IF v_available AND v_load_status != 'high' THEN
    v_message := format('Great! We have availability for %s people on %s at %s', 
                       p_party_size, 
                       to_char(p_date, 'FMDay, FMMonth FMDD, YYYY'), 
                       to_char(p_time, 'HH12:MI AM'));
  ELSE
    v_message := format('Unfortunately, we don''t have space for %s people on %s at %s', 
                       p_party_size, 
                       to_char(p_date, 'FMDay, FMMonth FMDD, YYYY'), 
                       to_char(p_time, 'HH12:MI AM'));
    
    -- Add suggestion info to message if available
    IF jsonb_array_length(v_suggestions) > 0 THEN
      v_message := v_message || '. However, we have alternative times available.';
    END IF;
  END IF;
  
  -- Return comprehensive result
  RETURN jsonb_build_object(
    'available', v_available AND v_load_status != 'high',
    'message', v_message,
    'load_status', v_load_status,
    'needs_staff_approval', v_needs_staff_approval,
    'current_load', jsonb_build_object(
      'total_guests', v_total_guests,
      'total_tables', v_total_tables,
      'available_capacity', v_available_group_capacity
    ),
    'suggestions', v_suggestions,
    'business_rules', jsonb_build_object(
      'max_guests', 18,
      'max_concurrent_tables', 3,
      'within_guest_limit', v_total_guests + p_party_size <= 18,
      'within_table_limit', v_total_tables + 1 <= 3,
      'sufficient_capacity', v_available_group_capacity >= p_party_size
    )
  );
END;
$$;