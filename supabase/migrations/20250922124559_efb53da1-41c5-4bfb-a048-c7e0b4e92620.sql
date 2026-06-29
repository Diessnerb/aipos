-- Fix syntax error in check_comprehensive_availability function
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id uuid,
  p_date date,
  p_time time without time zone,
  p_party_size integer,
  p_accessibility_needed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_minutes integer;
  end_minutes integer;
  availability_result jsonb := '{"available": false, "message": "", "suggestions": []}'::jsonb;
  conflict_count integer := 0;
  suitable_groups record;
  group_count integer := 0;
  total_tables_in_use integer := 0;
  suggestion_count integer := 0;
  suggestion_times jsonb := '[]'::jsonb;
  check_time time without time zone;
  check_minutes integer;
  available_at_time boolean;
  time_offset integer;
  max_offset integer := 360; -- 6 hours in minutes
  offset_step integer := 30; -- 30-minute intervals
  direction integer;
  directions integer[] := ARRAY[1, -1]; -- 1 for forward, -1 for backward
BEGIN
  -- Convert target time to minutes for easier calculation
  target_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := target_minutes + 120; -- 2-hour duration

  -- Check current table usage across the company (count individual tables, not groups)
  SELECT COUNT(DISTINCT table_num) INTO total_tables_in_use
  FROM (
    -- From single table reservations
    SELECT r.table_number as table_num
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND r.table_number IS NOT NULL
      AND (
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
        AND 
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > target_minutes
      )
    
    UNION ALL
    
    -- From group table reservations (each table in the array counts individually)
    SELECT unnest(r.table_numbers) as table_num
    FROM public.reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND r.table_numbers IS NOT NULL
      AND array_length(r.table_numbers, 1) > 0
      AND (
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
        AND 
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > target_minutes
      )
  ) active_tables;

  -- If 3 or more tables are in use, we're at capacity (max 3 tables at once)
  IF total_tables_in_use >= 3 THEN
    -- Find alternative suggestions by checking times closer to the requested time
    time_offset := offset_step;
    
    WHILE suggestion_count < 2 AND time_offset <= max_offset LOOP
      -- Alternate between checking forward and backward from the requested time
      FOREACH direction IN ARRAY directions LOOP
        check_minutes := target_minutes + (time_offset * direction);
        
        -- Skip if time is outside reasonable hours (before 10:00 or after 22:00)
        IF check_minutes < 600 OR check_minutes > 1320 THEN
          CONTINUE;
        END IF;
        
        -- Convert back to time
        check_time := make_time(check_minutes / 60, check_minutes % 60, 0);
        
        -- Check availability at this time
        SELECT COUNT(DISTINCT table_num) INTO conflict_count
        FROM (
          -- Single table conflicts
          SELECT r.table_number as table_num
          FROM public.reservations r
          WHERE r.company_id = p_company_id
            AND r.date = p_date
            AND r.status NOT IN ('cancelled', 'no-show')
            AND r.table_number IS NOT NULL
            AND (
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < (check_minutes + 120)
              AND 
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > check_minutes
            )
          
          UNION ALL
          
          -- Group table conflicts
          SELECT unnest(r.table_numbers) as table_num
          FROM public.reservations r
          WHERE r.company_id = p_company_id
            AND r.date = p_date
            AND r.status NOT IN ('cancelled', 'no-show')
            AND r.table_numbers IS NOT NULL
            AND array_length(r.table_numbers, 1) > 0
            AND (
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < (check_minutes + 120)
              AND 
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > check_minutes
            )
        ) conflicting_tables;
        
        -- If less than 3 tables would be in use, this time is available
        IF conflict_count < 3 THEN
          -- Verify we have suitable groups for the party size at this time
          SELECT COUNT(*) INTO group_count
          FROM public.get_table_groups_with_real_time_availability(
            p_company_id, p_date, check_time, p_party_size, p_accessibility_needed
          )
          WHERE can_accommodate = true;
          
          IF group_count > 0 THEN
            suggestion_times := suggestion_times || jsonb_build_object(
              'time', to_char(check_time, 'HH24:MI'),
              'available_groups', group_count
            );
            
            suggestion_count := suggestion_count + 1;
            
            -- Exit the inner loop if we have 2 suggestions
            IF suggestion_count >= 2 THEN
              EXIT;
            END IF;
          END IF;
        END IF;
      END LOOP;
      
      -- Exit the outer loop if we have 2 suggestions
      IF suggestion_count >= 2 THEN
        EXIT;
      END IF;
      
      time_offset := time_offset + offset_step;
    END LOOP;
    
    -- Build response with suggestions
    IF suggestion_count > 0 THEN
      availability_result := jsonb_build_object(
        'available', false,
        'message', 'Unfortunately, we''re fully booked for that time. How about ' || 
                   (suggestion_times->0->>'time') || 
                   CASE 
                     WHEN suggestion_count > 1 THEN ' or ' || (suggestion_times->1->>'time') 
                     ELSE '' 
                   END ||
                   ' instead?',
        'suggestions', suggestion_times,
        'reason', 'Restaurant at capacity (3+ tables in use)',
        'tables_in_use', total_tables_in_use
      );
    ELSE
      availability_result := jsonb_build_object(
        'available', false,
        'message', 'Unfortunately, we''re fully booked around that time. Would you like to try a different date?',
        'suggestions', '[]'::jsonb,
        'reason', 'Restaurant at capacity with no nearby availability',
        'tables_in_use', total_tables_in_use
      );
    END IF;
    
    RETURN availability_result;
  END IF;

  -- Check if we have suitable table groups for the requested time and party size
  SELECT COUNT(*) INTO group_count
  FROM public.get_table_groups_with_real_time_availability(
    p_company_id, p_date, p_time, p_party_size, p_accessibility_needed
  )
  WHERE can_accommodate = true;

  IF group_count = 0 THEN
    -- No suitable groups available - find alternative times
    time_offset := offset_step;
    
    WHILE suggestion_count < 2 AND time_offset <= max_offset LOOP
      -- Alternate between checking forward and backward from the requested time
      FOREACH direction IN ARRAY directions LOOP
        check_minutes := target_minutes + (time_offset * direction);
        
        -- Skip if time is outside reasonable hours
        IF check_minutes < 600 OR check_minutes > 1320 THEN
          CONTINUE;
        END IF;
        
        check_time := make_time(check_minutes / 60, check_minutes % 60, 0);
        
        -- Check if suitable groups are available at this time
        SELECT COUNT(*) INTO group_count
        FROM public.get_table_groups_with_real_time_availability(
          p_company_id, p_date, check_time, p_party_size, p_accessibility_needed
        )
        WHERE can_accommodate = true;
        
        IF group_count > 0 THEN
          suggestion_times := suggestion_times || jsonb_build_object(
            'time', to_char(check_time, 'HH24:MI'),
            'available_groups', group_count
          );
          
          suggestion_count := suggestion_count + 1;
          
          IF suggestion_count >= 2 THEN
            EXIT;
          END IF;
        END IF;
      END LOOP;
      
      IF suggestion_count >= 2 THEN
        EXIT;
      END IF;
      
      time_offset := time_offset + offset_step;
    END LOOP;
    
    -- Build response
    IF suggestion_count > 0 THEN
      availability_result := jsonb_build_object(
        'available', false,
        'message', 'Unfortunately, we don''t have suitable tables for ' || p_party_size || ' guests at that time. How about ' || 
                   (suggestion_times->0->>'time') || 
                   CASE 
                     WHEN suggestion_count > 1 THEN ' or ' || (suggestion_times->1->>'time') 
                     ELSE '' 
                   END ||
                   ' instead?',
        'suggestions', suggestion_times,
        'reason', 'No suitable table groups for party size',
        'tables_in_use', total_tables_in_use
      );
    ELSE
      availability_result := jsonb_build_object(
        'available', false,
        'message', 'Unfortunately, we don''t have suitable tables for ' || p_party_size || ' guests around that time. Would you like to try a different date?',
        'suggestions', '[]'::jsonb,
        'reason', 'No suitable table groups available nearby',
        'tables_in_use', total_tables_in_use
      );
    END IF;
    
    RETURN availability_result;
  END IF;

  -- Available! Return success with suitable groups
  availability_result := jsonb_build_object(
    'available', true,
    'message', 'Great! We have availability for ' || p_party_size || ' guests at ' || to_char(p_time, 'HH24:MI') || '.',
    'suitable_groups', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'group_id', group_id,
          'group_name', group_name,
          'table_numbers', table_numbers,
          'total_seats', total_seats,
          'accessibility_friendly', accessibility_friendly
        )
      )
      FROM public.get_table_groups_with_real_time_availability(
        p_company_id, p_date, p_time, p_party_size, p_accessibility_needed
      )
      WHERE can_accommodate = true
    ),
    'tables_in_use', total_tables_in_use
  );

  RETURN availability_result;
END;
$$;