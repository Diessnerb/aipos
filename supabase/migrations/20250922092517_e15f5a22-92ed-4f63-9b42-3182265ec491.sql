-- Fix the check_comprehensive_availability function to address all identified issues
DROP FUNCTION IF EXISTS public.check_comprehensive_availability(p_company_id uuid, p_date date, p_time time, p_party_size integer, p_duration_minutes integer) CASCADE;
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  start_minutes integer;
  end_minutes integer;
  total_current_guests integer := 0;
  total_capacity integer := 0;
  available_capacity integer := 0;
  conflicting_reservations json;
  suggestion_times text[] := '{}';
  final_message text;
  is_available boolean := false;
  needs_approval boolean := false;
  load_status text := 'normal';
  business_rules json;
  current_load_info json;
  suggestions_array json := '[]'::json;
  check_time time;
  check_start integer;
  check_end integer;
  temp_guests integer;
  suggestion_count integer := 0;
BEGIN
  -- Convert time to minutes for overlap calculations
  start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := start_minutes + p_duration_minutes;

  -- Get total restaurant capacity from active tables
  SELECT COALESCE(SUM(seats), 0) INTO total_capacity
  FROM tables t
  WHERE t.company_id = p_company_id 
    AND t.is_active = true 
    AND COALESCE(t.service_status, 'available') = 'available';

  -- Calculate current guests correctly (sum party_size directly from overlapping reservations)
  SELECT COALESCE(SUM(r.party_size), 0) INTO total_current_guests
  FROM reservations r
  WHERE r.company_id = p_company_id
    AND r.date = p_date
    AND r.status NOT IN ('cancelled', 'no-show')
    AND (
      -- Time overlap check
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
      AND 
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > start_minutes
    );

  -- Calculate available capacity
  available_capacity := total_capacity - total_current_guests;

  -- Determine if booking is available
  is_available := (available_capacity >= p_party_size);

  -- Determine load status
  IF total_current_guests = 0 THEN
    load_status := 'empty';
  ELSIF (total_current_guests::float / total_capacity::float) < 0.5 THEN
    load_status := 'light';
  ELSIF (total_current_guests::float / total_capacity::float) < 0.8 THEN
    load_status := 'moderate';
  ELSE
    load_status := 'busy';
  END IF;

  -- Generate suggestions if not available (check 30-minute increments)
  IF NOT is_available THEN
    -- Check earlier times (30-minute decrements)
    FOR i IN 1..6 LOOP
      check_time := p_time - (i * interval '30 minutes');
      
      -- Skip if too early (before 10 AM)
      IF check_time < '10:00:00'::time THEN
        CONTINUE;
      END IF;
      
      check_start := EXTRACT(hour FROM check_time) * 60 + EXTRACT(minute FROM check_time);
      check_end := check_start + p_duration_minutes;
      
      -- Check availability at this time
      SELECT COALESCE(SUM(r.party_size), 0) INTO temp_guests
      FROM reservations r
      WHERE r.company_id = p_company_id
        AND r.date = p_date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND (
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < check_end
          AND 
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > check_start
        );
      
      IF (total_capacity - temp_guests) >= p_party_size THEN
        suggestion_times := array_append(suggestion_times, to_char(check_time, 'HH24:MI'));
        suggestion_count := suggestion_count + 1;
        IF suggestion_count >= 3 THEN EXIT; END IF;
      END IF;
    END LOOP;
    
    -- Check later times (30-minute increments) if we need more suggestions
    IF suggestion_count < 3 THEN
      FOR i IN 1..6 LOOP
        check_time := p_time + (i * interval '30 minutes');
        
        -- Skip if too late (after 10 PM)
        IF check_time > '22:00:00'::time THEN
          CONTINUE;
        END IF;
        
        check_start := EXTRACT(hour FROM check_time) * 60 + EXTRACT(minute FROM check_time);
        check_end := check_start + p_duration_minutes;
        
        -- Check availability at this time
        SELECT COALESCE(SUM(r.party_size), 0) INTO temp_guests
        FROM reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < check_end
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > check_start
          );
        
        IF (total_capacity - temp_guests) >= p_party_size THEN
          suggestion_times := array_append(suggestion_times, to_char(check_time, 'HH24:MI'));
          suggestion_count := suggestion_count + 1;
          IF suggestion_count >= 3 THEN EXIT; END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Generate natural language message for TTS
  IF is_available THEN
    final_message := format('Great news! I can confirm your reservation for %s people on %s at %s. We have space available and I''ll get that booked for you right away.',
      p_party_size,
      to_char(p_date, 'Day, Month DD'),
      to_char(p_time, 'HH12:MI AM')
    );
  ELSE
    IF array_length(suggestion_times, 1) > 0 THEN
      final_message := format('I''m sorry, but %s at %s is fully booked for %s people. However, I have some great alternatives available. How about %s instead? These times have space for your party.',
        to_char(p_time, 'HH12:MI AM'),
        to_char(p_date, 'Day, Month DD'),
        p_party_size,
        array_to_string(suggestion_times, ', ')
      );
    ELSE
      final_message := format('I''m sorry, but we''re completely booked around %s on %s for a party of %s. Would you like to try a different date, or should I check our availability for tomorrow?',
        to_char(p_time, 'HH12:MI AM'),
        to_char(p_date, 'Day, Month DD'),
        p_party_size
      );
    END IF;
  END IF;

  -- Build suggestions JSON array
  IF array_length(suggestion_times, 1) > 0 THEN
    suggestions_array := array_to_json(suggestion_times);
  END IF;

  -- Build current load info
  current_load_info := json_build_object(
    'total_capacity', total_capacity,
    'current_guests', total_current_guests,
    'available_capacity', available_capacity,
    'utilization_percentage', CASE 
      WHEN total_capacity > 0 THEN ROUND((total_current_guests::numeric / total_capacity::numeric) * 100, 1)
      ELSE 0 
    END
  );

  -- Build business rules info
  business_rules := json_build_object(
    'max_party_size', 12,
    'advance_booking_days', 30,
    'booking_window_start', '10:00',
    'booking_window_end', '22:00',
    'default_duration_minutes', p_duration_minutes
  );

  -- Return comprehensive response
  RETURN json_build_object(
    'available', is_available,
    'message', final_message,
    'load_status', load_status,
    'needs_staff_approval', needs_approval,
    'current_load', current_load_info,
    'suggestions', suggestions_array,
    'business_rules', business_rules
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error response with natural language
  RETURN json_build_object(
    'available', false,
    'message', 'I''m having trouble checking our availability right now. Please try again in a moment, or feel free to call us directly to make your reservation.',
    'load_status', 'unknown',
    'needs_staff_approval', false,
    'current_load', json_build_object('error', SQLERRM),
    'suggestions', '[]'::json,
    'business_rules', '{}'::json
  );
END;
$$;