-- Enhanced availability check function with load-based business rules
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_duration_minutes integer DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requested_start_minutes integer;
  v_requested_end_minutes integer;
  v_current_guests integer := 0;
  v_current_tables integer := 0;
  v_current_reservations integer := 0;
  v_total_seats integer := 0;
  v_available_seats integer := 0;
  v_available_tables_count integer := 0;
  v_available_tables jsonb := '[]'::jsonb;
  v_suggestions jsonb := '[]'::jsonb;
  v_table_record record;
  v_reservation_record record;
  v_suggestion_time time;
  v_suggestion_minutes integer;
  v_time_check_start integer;
  v_time_check_end integer;
  v_guests_at_time integer;
  v_tables_at_time integer;
  v_available_at_time integer;
  v_would_exceed_limits boolean := false;
  v_current_load_high boolean := false;
  v_needs_staff_escalation boolean := false;
  v_blocked_tables integer[] := ARRAY[]::integer[];
BEGIN
  -- Convert requested time to minutes for easier calculation
  v_requested_start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  v_requested_end_minutes := v_requested_start_minutes + p_duration_minutes;
  
  -- STEP 1: Calculate current load at the requested time
  -- Count current guests and tables booked at the exact time slot
  FOR v_reservation_record IN (
    SELECT r.party_size, r.table_number, r.table_numbers, r.customer_name
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND (
        -- Check for time overlap
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_requested_end_minutes
        AND 
        (EXTRACT(hour FROM COALESCE(r.end_time, r.time + interval '2 hours')) * 60 + 
         EXTRACT(minute FROM COALESCE(r.end_time, r.time + interval '2 hours'))) > v_requested_start_minutes
      )
  ) LOOP
    v_current_guests := v_current_guests + v_reservation_record.party_size;
    v_current_reservations := v_current_reservations + 1;
    
    -- Count unique tables (handle both single table and multi-table reservations)
    IF v_reservation_record.table_numbers IS NOT NULL THEN
      -- Multi-table reservation
      v_current_tables := v_current_tables + array_length(v_reservation_record.table_numbers, 1);
      v_blocked_tables := v_blocked_tables || v_reservation_record.table_numbers;
    ELSIF v_reservation_record.table_number IS NOT NULL THEN
      -- Single table reservation
      v_current_tables := v_current_tables + 1;
      v_blocked_tables := array_append(v_blocked_tables, v_reservation_record.table_number);
    END IF;
  END LOOP;
  
  -- Remove duplicates from blocked tables
  SELECT array_agg(DISTINCT unnest) INTO v_blocked_tables 
  FROM unnest(v_blocked_tables);
  
  v_current_tables := COALESCE(array_length(v_blocked_tables, 1), 0);
  
  -- STEP 2: Apply business rules
  -- Rule 1: Check if adding new party would exceed 18 guest limit
  -- Rule 2: Check if we would exceed 3 table limit (estimate tables needed)
  v_would_exceed_limits := (
    (v_current_guests + p_party_size) > 18 OR 
    (v_current_tables + LEAST(CEIL(p_party_size::float / 4), 3)) > 3
  );
  
  -- Rule 3: Check if current load is already high (≥18 guests)
  v_current_load_high := v_current_guests >= 18;
  
  -- Flag for staff escalation when limits are tight
  v_needs_staff_escalation := (
    v_current_guests >= 15 OR 
    v_current_tables >= 2 OR 
    v_would_exceed_limits
  );
  
  -- STEP 3: Calculate available capacity only if limits allow
  IF NOT v_would_exceed_limits THEN
    FOR v_table_record IN (
      SELECT t.table_number, t.seats, t.accessibility_friendly
      FROM public.tables t
      WHERE t.company_id = p_company_id
        AND t.is_active = true
        AND COALESCE(t.service_status, 'available') = 'available'
        AND (v_blocked_tables IS NULL OR t.table_number != ALL(v_blocked_tables))
      ORDER BY t.table_number
    ) LOOP
      v_total_seats := v_total_seats + v_table_record.seats;
      v_available_seats := v_available_seats + v_table_record.seats;
      v_available_tables_count := v_available_tables_count + 1;
      
      v_available_tables := v_available_tables || jsonb_build_object(
        'table_number', v_table_record.table_number,
        'seats', v_table_record.seats,
        'accessibility_friendly', v_table_record.accessibility_friendly
      );
    END LOOP;
  END IF;
  
  -- STEP 4: Generate suggestions based on load
  IF v_available_seats < p_party_size OR v_would_exceed_limits THEN
    -- Determine suggestion strategy based on current load
    FOR v_suggestion_minutes IN 
      SELECT unnest(CASE 
        WHEN v_current_load_high THEN 
          -- High load: only suggest completely empty slots, wider time range
          ARRAY[
            v_requested_start_minutes - 180,  -- 3 hours before
            v_requested_start_minutes - 150,  -- 2.5 hours before
            v_requested_start_minutes - 120,  -- 2 hours before
            v_requested_start_minutes + 180,  -- 3 hours after
            v_requested_start_minutes + 150,  -- 2.5 hours after
            v_requested_start_minutes + 120   -- 2 hours after
          ]
        ELSE 
          -- Normal load: suggest nearby times
          ARRAY[
            v_requested_start_minutes - 90,
            v_requested_start_minutes - 60, 
            v_requested_start_minutes - 30,
            v_requested_start_minutes + 30,
            v_requested_start_minutes + 60,
            v_requested_start_minutes + 90
          ]
      END)
    LOOP
      -- Skip if outside business hours (8 AM to 10 PM)
      IF v_suggestion_minutes < 480 OR v_suggestion_minutes > 1320 THEN
        CONTINUE;
      END IF;
      
      v_time_check_start := v_suggestion_minutes;
      v_time_check_end := v_suggestion_minutes + p_duration_minutes;
      v_guests_at_time := 0;
      v_tables_at_time := 0;
      v_available_at_time := 0;
      
      -- Calculate load at suggested time
      FOR v_reservation_record IN (
        SELECT r.party_size, r.table_number, r.table_numbers
        FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_time_check_end
            AND 
            (EXTRACT(hour FROM COALESCE(r.end_time, r.time + interval '2 hours')) * 60 + 
             EXTRACT(minute FROM COALESCE(r.end_time, r.time + interval '2 hours'))) > v_time_check_start
          )
      ) LOOP
        v_guests_at_time := v_guests_at_time + v_reservation_record.party_size;
        
        IF v_reservation_record.table_numbers IS NOT NULL THEN
          v_tables_at_time := v_tables_at_time + array_length(v_reservation_record.table_numbers, 1);
        ELSIF v_reservation_record.table_number IS NOT NULL THEN
          v_tables_at_time := v_tables_at_time + 1;
        END IF;
      END LOOP;
      
      -- Apply business rules for suggestions
      IF v_current_load_high THEN
        -- High load: only suggest if NO existing reservations
        IF v_guests_at_time = 0 AND v_tables_at_time = 0 THEN
          -- Calculate pure available capacity with no conflicts
          SELECT SUM(t.seats) INTO v_available_at_time
          FROM public.tables t
          WHERE t.company_id = p_company_id
            AND t.is_active = true
            AND COALESCE(t.service_status, 'available') = 'available';
        END IF;
      ELSE
        -- Normal load: suggest if within limits
        IF (v_guests_at_time + p_party_size) <= 18 AND 
           (v_tables_at_time + LEAST(CEIL(p_party_size::float / 4), 3)) <= 3 THEN
          
          SELECT SUM(t.seats) INTO v_available_at_time
          FROM public.tables t
          WHERE t.company_id = p_company_id
            AND t.is_active = true
            AND COALESCE(t.service_status, 'available') = 'available'
            AND NOT EXISTS (
              SELECT 1 FROM public.reservations r
              WHERE r.company_id = p_company_id
                AND r.date = p_date
                AND r.status NOT IN ('cancelled', 'no-show')
                AND (
                  (r.table_number = t.table_number)
                  OR 
                  (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
                )
                AND (
                  (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_time_check_end
                  AND 
                  (EXTRACT(hour FROM COALESCE(r.end_time, r.time + interval '2 hours')) * 60 + 
                   EXTRACT(minute FROM COALESCE(r.end_time, r.time + interval '2 hours'))) > v_time_check_start
                )
            );
        END IF;
      END IF;
      
      -- Add suggestion if enough capacity available
      IF v_available_at_time >= p_party_size THEN
        v_suggestion_time := (v_suggestion_minutes || ' minutes')::interval::time;
        v_suggestions := v_suggestions || jsonb_build_object(
          'time', to_char(v_suggestion_time, 'HH24:MI'),
          'available_capacity', v_available_at_time,
          'current_load_guests', v_guests_at_time,
          'current_load_tables', v_tables_at_time,
          'confidence', CASE 
            WHEN v_guests_at_time = 0 THEN 'high'
            WHEN v_guests_at_time <= 6 THEN 'medium'
            ELSE 'low'
          END,
          'load_level', CASE 
            WHEN v_guests_at_time = 0 THEN 'empty'
            WHEN v_guests_at_time <= 6 THEN 'low'
            WHEN v_guests_at_time <= 12 THEN 'medium'
            ELSE 'high'
          END
        );
        
        -- Limit suggestions to 4
        IF jsonb_array_length(v_suggestions) >= 4 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- STEP 5: Return comprehensive availability information
  RETURN jsonb_build_object(
    'available', (NOT v_would_exceed_limits AND v_available_seats >= p_party_size),
    'reason', CASE 
      WHEN v_total_seats = 0 THEN 'no_tables'
      WHEN v_would_exceed_limits AND (v_current_guests + p_party_size) > 18 THEN 'guest_limit_exceeded'
      WHEN v_would_exceed_limits AND (v_current_tables + LEAST(CEIL(p_party_size::float / 4), 3)) > 3 THEN 'table_limit_exceeded'
      WHEN v_available_seats < p_party_size THEN 'capacity_insufficient'  
      ELSE 'available'
    END,
    'current_load', jsonb_build_object(
      'guests', v_current_guests,
      'tables', v_current_tables,
      'reservations', v_current_reservations,
      'would_exceed_limits', v_would_exceed_limits,
      'high_load', v_current_load_high
    ),
    'capacity_info', jsonb_build_object(
      'total_seats_available', v_available_seats,
      'total_seats_restaurant', COALESCE((
        SELECT SUM(t.seats)
        FROM public.tables t
        WHERE t.company_id = p_company_id
          AND t.is_active = true
          AND COALESCE(t.service_status, 'available') = 'available'
      ), 0),
      'party_size_requested', p_party_size,
      'available_tables_count', v_available_tables_count,
      'available_tables', v_available_tables
    ),
    'business_rules', jsonb_build_object(
      'max_concurrent_guests', 18,
      'max_concurrent_tables', 3,
      'current_guests', v_current_guests,
      'current_tables', v_current_tables,
      'guest_limit_reached', (v_current_guests + p_party_size) > 18,
      'table_limit_reached', (v_current_tables + LEAST(CEIL(p_party_size::float / 4), 3)) > 3,
      'needs_staff_escalation', v_needs_staff_escalation
    ),
    'suggestions', v_suggestions
  );
END;
$$;