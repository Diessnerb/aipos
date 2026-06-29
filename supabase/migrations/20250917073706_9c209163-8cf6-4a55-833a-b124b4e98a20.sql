-- Add indexes for better availability query performance
CREATE INDEX IF NOT EXISTS idx_reservations_availability 
ON public.reservations (company_id, date, time, end_time, status) 
WHERE status NOT IN ('cancelled', 'no-show');

CREATE INDEX IF NOT EXISTS idx_tables_operational 
ON public.tables (company_id, is_active, service_status) 
WHERE is_active = true;

-- Enhanced availability check function
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
  v_total_seats integer := 0;
  v_available_seats integer := 0;
  v_conflicting_reservations integer := 0;
  v_available_tables jsonb := '[]'::jsonb;
  v_suggestions jsonb := '[]'::jsonb;
  v_table_record record;
  v_suggestion_time time;
  v_suggestion_minutes integer;
  v_time_check_start integer;
  v_time_check_end integer;
  v_conflicts_at_time integer;
  v_available_at_time integer;
BEGIN
  -- Convert requested time to minutes for easier calculation
  v_requested_start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  v_requested_end_minutes := v_requested_start_minutes + p_duration_minutes;
  
  -- Get total operational tables and their capacity
  FOR v_table_record IN (
    SELECT t.table_number, t.seats, t.accessibility_friendly
    FROM public.tables t
    WHERE t.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
    ORDER BY t.table_number
  ) LOOP
    v_total_seats := v_total_seats + v_table_record.seats;
    
    -- Check if this table is available (no overlapping reservations)
    SELECT COUNT(*) INTO v_conflicting_reservations
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND (
        (r.table_number = v_table_record.table_number)
        OR 
        (r.table_numbers IS NOT NULL AND v_table_record.table_number = ANY(r.table_numbers))
      )
      AND (
        -- Check for time overlap using both time and end_time
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_requested_end_minutes
        AND 
        (EXTRACT(hour FROM COALESCE(r.end_time, r.time + interval '2 hours')) * 60 + 
         EXTRACT(minute FROM COALESCE(r.end_time, r.time + interval '2 hours'))) > v_requested_start_minutes
      );
    
    IF v_conflicting_reservations = 0 THEN
      v_available_seats := v_available_seats + v_table_record.seats;
      v_available_tables := v_available_tables || jsonb_build_object(
        'table_number', v_table_record.table_number,
        'seats', v_table_record.seats,
        'accessibility_friendly', v_table_record.accessibility_friendly
      );
    END IF;
  END LOOP;
  
  -- Generate time-based suggestions if not enough capacity
  IF v_available_seats < p_party_size THEN
    -- Check 30-minute intervals before and after requested time
    FOR v_suggestion_minutes IN 
      SELECT unnest(ARRAY[
        v_requested_start_minutes - 90,
        v_requested_start_minutes - 60, 
        v_requested_start_minutes - 30,
        v_requested_start_minutes + 30,
        v_requested_start_minutes + 60,
        v_requested_start_minutes + 90
      ])
    LOOP
      -- Skip if outside business hours (8 AM to 10 PM)
      IF v_suggestion_minutes < 480 OR v_suggestion_minutes > 1320 THEN
        CONTINUE;
      END IF;
      
      v_time_check_start := v_suggestion_minutes;
      v_time_check_end := v_suggestion_minutes + p_duration_minutes;
      v_available_at_time := 0;
      
      -- Calculate available seats at this suggested time
      FOR v_table_record IN (
        SELECT t.table_number, t.seats
        FROM public.tables t
        WHERE t.company_id = p_company_id
          AND t.is_active = true
          AND COALESCE(t.service_status, 'available') = 'available'
      ) LOOP
        SELECT COUNT(*) INTO v_conflicts_at_time
        FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            (r.table_number = v_table_record.table_number)
            OR 
            (r.table_numbers IS NOT NULL AND v_table_record.table_number = ANY(r.table_numbers))
          )
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < v_time_check_end
            AND 
            (EXTRACT(hour FROM COALESCE(r.end_time, r.time + interval '2 hours')) * 60 + 
             EXTRACT(minute FROM COALESCE(r.end_time, r.time + interval '2 hours'))) > v_time_check_start
          );
        
        IF v_conflicts_at_time = 0 THEN
          v_available_at_time := v_available_at_time + v_table_record.seats;
        END IF;
      END LOOP;
      
      -- Add suggestion if enough capacity available
      IF v_available_at_time >= p_party_size THEN
        v_suggestion_time := (v_suggestion_minutes || ' minutes')::interval::time;
        v_suggestions := v_suggestions || jsonb_build_object(
          'time', to_char(v_suggestion_time, 'HH24:MI'),
          'available_capacity', v_available_at_time,
          'confidence', CASE 
            WHEN v_available_at_time >= p_party_size * 1.5 THEN 'high'
            WHEN v_available_at_time >= p_party_size * 1.2 THEN 'medium'
            ELSE 'low'
          END
        );
        
        -- Limit suggestions to 3
        IF jsonb_array_length(v_suggestions) >= 3 THEN
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Return comprehensive availability information
  RETURN jsonb_build_object(
    'available', v_available_seats >= p_party_size,
    'reason', CASE 
      WHEN v_total_seats = 0 THEN 'no_tables'
      WHEN v_available_seats < p_party_size THEN 'capacity_insufficient'  
      ELSE 'available'
    END,
    'capacity_info', jsonb_build_object(
      'total_seats_available', v_available_seats,
      'total_seats_restaurant', v_total_seats,
      'party_size_requested', p_party_size,
      'available_tables', v_available_tables
    ),
    'suggestions', v_suggestions
  );
END;
$$;