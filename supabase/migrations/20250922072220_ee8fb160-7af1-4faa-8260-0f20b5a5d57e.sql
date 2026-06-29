-- Fix the check_comprehensive_availability function with proper table counting and table groups integration
CREATE OR REPLACE FUNCTION public.check_comprehensive_availability(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_duration_minutes integer DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  start_minutes integer;
  end_minutes integer;
  v_total_unique_tables integer := 0;
  v_total_guests integer := 0;
  v_available_individual_tables integer[];
  v_available_groups jsonb := '[]'::jsonb;
  v_can_accommodate_individual boolean := false;
  v_can_accommodate_group boolean := false;
  v_estimated_tables_needed integer := 1;
  v_result jsonb;
  v_business_rules jsonb;
  table_rec record;
  group_rec record;
BEGIN
  -- Convert time to minutes for overlap checking
  start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := start_minutes + p_duration_minutes;

  -- Count current unique tables and total guests in overlapping reservations
  WITH overlapping_reservations AS (
    SELECT 
      table_number,
      table_numbers,
      party_size
    FROM reservations r
    WHERE r.company_id = p_company_id
      AND r.date = p_date
      AND r.status NOT IN ('cancelled', 'no-show')
      AND (
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
        AND 
        (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + COALESCE(r.duration_minutes, 120)) > start_minutes
      )
  ),
  unique_tables AS (
    -- Get unique table numbers from both single tables and table arrays
    SELECT DISTINCT table_num
    FROM (
      SELECT table_number as table_num FROM overlapping_reservations WHERE table_number IS NOT NULL
      UNION
      SELECT UNNEST(table_numbers) as table_num FROM overlapping_reservations WHERE table_numbers IS NOT NULL
    ) all_tables
  )
  SELECT 
    COALESCE(COUNT(DISTINCT ut.table_num), 0),
    COALESCE(SUM(or_data.party_size), 0)
  INTO v_total_unique_tables, v_total_guests
  FROM unique_tables ut
  CROSS JOIN (SELECT SUM(party_size) as party_size FROM overlapping_reservations) or_data;

  -- Check available individual tables that can accommodate the party
  SELECT array_agg(t.table_number)
  INTO v_available_individual_tables
  FROM tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available'
    AND t.seats >= p_party_size
    AND NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.company_id = p_company_id
        AND r.date = p_date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND (
          r.table_number = t.table_number OR
          (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
        )
        AND (
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
          AND 
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + COALESCE(r.duration_minutes, 120)) > start_minutes
        )
    );

  -- Check if individual tables can accommodate
  v_can_accommodate_individual := (v_available_individual_tables IS NOT NULL AND array_length(v_available_individual_tables, 1) > 0);

  -- Check available table groups
  SELECT jsonb_agg(
    jsonb_build_object(
      'group_id', tg.id,
      'group_name', tg.group_name,
      'total_seats', group_data.total_seats,
      'table_count', group_data.table_count,
      'table_numbers', group_data.table_numbers
    )
  )
  INTO v_available_groups
  FROM table_groups tg
  JOIN (
    SELECT 
      tgm.group_id,
      SUM(t.seats) as total_seats,
      COUNT(*) as table_count,
      array_agg(t.table_number ORDER BY t.table_number) as table_numbers
    FROM table_group_memberships tgm
    JOIN tables t ON t.table_number = tgm.table_number AND t.company_id = tgm.company_id
    WHERE t.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
      AND NOT EXISTS (
        SELECT 1 FROM reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            r.table_number = t.table_number OR
            (r.table_numbers IS NOT NULL AND t.table_number = ANY(r.table_numbers))
          )
          AND (
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + COALESCE(r.duration_minutes, 120)) > start_minutes
          )
      )
    GROUP BY tgm.group_id
    HAVING SUM(t.seats) >= p_party_size
  ) group_data ON tg.id = group_data.group_id
  WHERE tg.company_id = p_company_id;

  -- Check if groups can accommodate
  v_can_accommodate_group := (v_available_groups IS NOT NULL AND jsonb_array_length(v_available_groups) > 0);

  -- Estimate tables needed for the new reservation
  IF v_can_accommodate_individual THEN
    v_estimated_tables_needed := 1; -- Individual table booking needs 1 table
  ELSIF v_can_accommodate_group THEN
    -- For group booking, get the minimum table count from available groups
    SELECT MIN((group_info->>'table_count')::integer)
    INTO v_estimated_tables_needed
    FROM jsonb_array_elements(v_available_groups) group_info;
  ELSE
    v_estimated_tables_needed := 1; -- Default assumption if no accommodation found
  END IF;

  -- Build business rules info
  v_business_rules := jsonb_build_object(
    'max_tables_allowed', 3,
    'max_guests_allowed', 18,
    'current_tables_booked', v_total_unique_tables,
    'current_guests_booked', v_total_guests,
    'estimated_tables_needed', v_estimated_tables_needed,
    'total_tables_after_booking', v_total_unique_tables + v_estimated_tables_needed,
    'total_guests_after_booking', v_total_guests + p_party_size,
    'table_limit_exceeded', (v_total_unique_tables + v_estimated_tables_needed) > 3,
    'guest_limit_exceeded', (v_total_guests + p_party_size) > 18
  );

  -- Determine availability based on business rules
  v_result := jsonb_build_object(
    'available', (
      (v_can_accommodate_individual OR v_can_accommodate_group) AND
      (v_total_unique_tables + v_estimated_tables_needed) <= 3 AND
      (v_total_guests + p_party_size) <= 18
    ),
    'message', CASE 
      WHEN NOT (v_can_accommodate_individual OR v_can_accommodate_group) THEN 
        'No tables or groups available with sufficient capacity'
      WHEN (v_total_unique_tables + v_estimated_tables_needed) > 3 THEN 
        'Booking would exceed maximum of 3 tables limit'
      WHEN (v_total_guests + p_party_size) > 18 THEN 
        'Booking would exceed maximum of 18 guests limit'
      ELSE 
        'Tables available for booking'
    END,
    'current_load', jsonb_build_object(
      'total_tables', v_total_unique_tables,
      'total_guests', v_total_guests,
      'available_individual_tables', COALESCE(array_length(v_available_individual_tables, 1), 0),
      'available_groups', COALESCE(jsonb_array_length(v_available_groups), 0)
    ),
    'business_rules', v_business_rules,
    'suggestions', jsonb_build_array(),
    'needs_staff_approval', false,
    'load_status', CASE
      WHEN v_total_unique_tables >= 3 OR v_total_guests >= 18 THEN 'at_capacity'
      WHEN v_total_unique_tables >= 2 OR v_total_guests >= 12 THEN 'high'
      WHEN v_total_unique_tables >= 1 OR v_total_guests >= 6 THEN 'medium'
      ELSE 'low'
    END,
    'available_options', jsonb_build_object(
      'individual_tables', COALESCE(v_available_individual_tables, ARRAY[]::integer[]),
      'table_groups', COALESCE(v_available_groups, '[]'::jsonb)
    )
  );

  RETURN v_result;
END;
$$;