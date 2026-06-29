-- Fix the check_comprehensive_availability function to find closer suggestion times
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id UUID,
  p_date DATE,
  p_time TIME,
  p_party_size INTEGER,
  p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_capacity INTEGER := 0;
  v_current_guests INTEGER := 0;
  v_available_capacity INTEGER := 0;
  v_current_tables_in_use INTEGER := 0;
  v_max_tables_allowed INTEGER := 0;
  v_tables_available INTEGER := 0;
  v_utilization_percentage NUMERIC := 0;
  v_load_status TEXT := 'light';
  v_needs_staff_approval BOOLEAN := FALSE;
  v_available BOOLEAN := FALSE;
  v_message TEXT := '';
  v_suggestions TEXT[] := ARRAY[]::TEXT[];
  v_business_rules JSON;
  v_current_load JSON;
  v_result JSON;
  
  -- Suggestion finding variables
  v_requested_minutes INTEGER;
  v_check_time TIME;
  v_check_minutes INTEGER;
  v_slot_offset INTEGER;
  v_direction INTEGER;
  v_suggestion_count INTEGER := 0;
  v_max_suggestions INTEGER := 2;
  v_conflicts INTEGER;
BEGIN
  -- Get business rules and calculate capacity metrics
  SELECT 
    COALESCE(SUM(t.seats), 0),
    COALESCE(COUNT(t.id), 0)
  INTO v_total_capacity, v_max_tables_allowed
  FROM tables t
  WHERE t.company_id = p_company_id 
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available';

  -- Calculate current load at requested time
  SELECT 
    COALESCE(SUM(r.party_size), 0),
    COALESCE(COUNT(DISTINCT COALESCE(r.table_number, 0) + COALESCE(array_length(r.table_numbers, 1), 0)), 0)
  INTO v_current_guests, v_current_tables_in_use
  FROM reservations r
  WHERE r.company_id = p_company_id
    AND r.date = p_date
    AND r.status NOT IN ('cancelled', 'no-show')
    AND (
      -- Time overlap check
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < 
      (EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time) + p_duration_minutes)
      AND 
      (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > 
      (EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time))
    );

  -- Calculate availability metrics
  v_available_capacity := v_total_capacity - v_current_guests;
  v_tables_available := v_max_tables_allowed - v_current_tables_in_use;
  v_utilization_percentage := CASE 
    WHEN v_total_capacity > 0 THEN ROUND((v_current_guests::NUMERIC / v_total_capacity) * 100, 1)
    ELSE 0 
  END;

  -- Determine load status
  IF v_utilization_percentage >= 90 THEN
    v_load_status := 'heavy';
  ELSIF v_utilization_percentage >= 70 THEN
    v_load_status := 'moderate';
  ELSE
    v_load_status := 'light';
  END IF;

  -- Check if current time slot is available
  v_available := (v_available_capacity >= p_party_size AND v_tables_available > 0);

  -- Generate message and suggestions
  IF v_available THEN
    v_message := 'Great news! We have availability for your party of ' || p_party_size || 
                ' at ' || to_char(p_time, 'HH12:MI AM') || ' on ' || 
                to_char(p_date, 'FMDay, FMMonth DD') || '.';
  ELSE
    -- Find alternative times using alternating forward/backward search
    v_requested_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
    
    -- Search pattern: +15min, -15min, +30min, -30min, +45min, -45min, +60min, -60min, etc.
    FOR v_slot_offset IN 1..12 LOOP -- Check up to 12 slots (3 hours in each direction)
      FOREACH v_direction IN ARRAY ARRAY[1, -1] LOOP -- Forward first, then backward for each offset
        -- Calculate check time (15-minute increments)
        v_check_minutes := v_requested_minutes + (v_direction * v_slot_offset * 15);
        
        -- Wrap around 24-hour format
        v_check_minutes := ((v_check_minutes % 1440) + 1440) % 1440;
        
        -- Convert back to TIME
        v_check_time := make_time(
          v_check_minutes / 60,
          v_check_minutes % 60,
          0
        );
        
        -- Skip if outside business hours (10:00 - 22:00)
        IF v_check_minutes < 600 OR v_check_minutes >= 1320 THEN
          CONTINUE;
        END IF;
        
        -- Check for conflicts at this time
        SELECT COUNT(*) INTO v_conflicts
        FROM reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            -- Time overlap check
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < 
            (v_check_minutes + p_duration_minutes)
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > 
            v_check_minutes
          );
        
        -- If no conflicts, add as suggestion
        IF v_conflicts = 0 THEN
          v_suggestions := array_append(v_suggestions, to_char(v_check_time, 'HH24:MI'));
          v_suggestion_count := v_suggestion_count + 1;
          
          -- Stop when we have enough suggestions
          IF v_suggestion_count >= v_max_suggestions THEN
            EXIT;
          END IF;
        END IF;
      END LOOP;
      
      -- Exit outer loop if we have enough suggestions
      IF v_suggestion_count >= v_max_suggestions THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- Build message
    v_message := 'Unfortunately, we''re fully booked at ' || to_char(p_time, 'HH12:MI AM') || 
                ' on ' || to_char(p_date, 'FMDay, FMMonth DD') || ' for ' || p_party_size || ' people.';
    
    IF array_length(v_suggestions, 1) > 0 THEN
      v_message := v_message || ' However, I have some great alternatives available. How about ' ||
                  array_to_string(v_suggestions, ', ') || ' instead? These times have space for your party.';
    END IF;
  END IF;

  -- Prepare business rules
  v_business_rules := json_build_object(
    'max_party_size', 12,
    'max_guest_capacity', v_total_capacity,
    'max_tables_at_once', v_max_tables_allowed,
    'advance_booking_days', 30,
    'booking_window_start', '10:00',
    'booking_window_end', '22:00',
    'default_duration_minutes', 120
  );

  -- Prepare current load info
  v_current_load := json_build_object(
    'total_capacity', v_total_capacity,
    'current_guests', v_current_guests,
    'available_capacity', v_available_capacity,
    'current_tables_in_use', v_current_tables_in_use,
    'max_tables_allowed', v_max_tables_allowed,
    'tables_available', v_tables_available,
    'utilization_percentage', v_utilization_percentage
  );

  -- Build final result
  v_result := json_build_object(
    'available', v_available,
    'message', v_message,
    'load_status', v_load_status,
    'needs_staff_approval', v_needs_staff_approval,
    'current_load', v_current_load,
    'suggestions', v_suggestions,
    'business_rules', v_business_rules
  );

  RETURN v_result;
END;
$$;