-- Fix the get_table_groups_with_real_time_availability function
-- The current function has a bug where it uses tgm.table_number instead of proper table joins

DROP FUNCTION IF EXISTS public.get_table_groups_with_real_time_availability(p_company_id uuid, p_date date, p_time time without time zone, p_party_size integer, p_accessibility_needed boolean) CASCADE;
CREATE OR REPLACE FUNCTION public.get_table_groups_with_real_time_availability(p_company_id uuid, p_date date, p_time time without time zone, p_party_size integer, p_accessibility_needed boolean DEFAULT false)
 RETURNS TABLE(group_id uuid, group_name text, table_numbers integer[], total_seats integer, is_available boolean, blocking_reservations jsonb, optimization_potential integer, accessibility_friendly boolean, can_accommodate boolean, free_tables integer[], free_seats integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  start_minutes integer;
  end_minutes integer;
  group_rec record;
  table_num integer;
  blocked_tables integer[];
  free_tables_list integer[];
  blocking_res jsonb := '[]'::jsonb;
  total_blocked integer := 0;
  res_record record;
  table_seats integer;
  running_free_seats integer := 0;
BEGIN
  -- Convert time to minutes for overlap checking (2-hour duration)
  start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := start_minutes + 120; -- 2-hour duration
  
  -- Loop through all table groups for the company
  FOR group_rec IN (
    SELECT 
      tg.id,
      tg.group_name,
      array_agg(t.table_number ORDER BY t.table_number) as tables,
      sum(t.seats) as seats,
      bool_and(COALESCE(t.accessibility_friendly, false)) as all_accessible
    FROM public.table_groups tg
    JOIN public.table_group_memberships tgm ON tg.id = tgm.group_id
    JOIN public.tables t ON t.id = tgm.table_id  -- FIX: Use proper table_id join
    WHERE tg.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
    GROUP BY tg.id, tg.group_name
    HAVING sum(t.seats) >= p_party_size
  ) LOOP
    
    -- Reset for each group
    blocked_tables := ARRAY[]::integer[];
    free_tables_list := ARRAY[]::integer[];
    blocking_res := '[]'::jsonb;
    total_blocked := 0;
    running_free_seats := 0;
    
    -- Check each table in the group for conflicts
    FOREACH table_num IN ARRAY group_rec.tables LOOP
      -- Check if this table is blocked by any reservation (2-hour window)
      SELECT COUNT(*) INTO total_blocked
      FROM public.reservations r
      WHERE r.company_id = p_company_id
        AND r.date = p_date
        AND r.status NOT IN ('cancelled', 'no-show')
        AND (
          (r.table_number = table_num)
          OR
          (r.table_numbers IS NOT NULL AND table_num = ANY(r.table_numbers))
        )
        AND (
          -- Enhanced overlap detection for 2-hour duration
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
          AND 
          (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > start_minutes
        );
      
      IF total_blocked > 0 THEN
        -- Table is blocked, collect blocking reservation info
        FOR res_record IN (
          SELECT r.id, r.customer_name, r.party_size, r.time, r.table_number, r.table_numbers
          FROM public.reservations r
          WHERE r.company_id = p_company_id
            AND r.date = p_date
            AND r.status NOT IN ('cancelled', 'no-show')
            AND (
              (r.table_number = table_num)
              OR
              (r.table_numbers IS NOT NULL AND table_num = ANY(r.table_numbers))
            )
            AND (
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
              AND 
              (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > start_minutes
            )
          LIMIT 1
        ) LOOP
          blocked_tables := array_append(blocked_tables, table_num);
          
          -- Add blocking reservation info as proper JSONB
          blocking_res := blocking_res || jsonb_build_object(
            'id', res_record.id,
            'customer_name', res_record.customer_name,
            'party_size', res_record.party_size,
            'time', res_record.time,
            'table_number', res_record.table_number,
            'table_numbers', res_record.table_numbers,
            'blocking_table', table_num
          );
        END LOOP;
      ELSE
        -- Table is free, add to free tables and count seats
        free_tables_list := array_append(free_tables_list, table_num);
        
        -- Get table seats
        SELECT COALESCE(t.seats, 0) INTO table_seats
        FROM public.tables t 
        WHERE t.table_number = table_num AND t.company_id = p_company_id;
        
        running_free_seats := running_free_seats + table_seats;
      END IF;
    END LOOP;
    
    -- Return group data
    group_id := group_rec.id;
    group_name := group_rec.group_name;
    table_numbers := group_rec.tables;
    total_seats := group_rec.seats;
    is_available := (array_length(blocked_tables, 1) IS NULL);
    blocking_reservations := blocking_res;
    optimization_potential := COALESCE(array_length(blocked_tables, 1), 0);
    accessibility_friendly := group_rec.all_accessible;
    can_accommodate := (group_rec.seats >= p_party_size);
    free_tables := free_tables_list;
    free_seats := running_free_seats;
    
    -- Apply accessibility filter if needed
    IF p_accessibility_needed AND NOT group_rec.all_accessible THEN
      can_accommodate := false;
    END IF;
    
    -- Even if not fully available, mark as accommodating if free tables can handle party size
    IF array_length(free_tables_list, 1) > 0 AND running_free_seats >= p_party_size THEN
      can_accommodate := true;
    END IF;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$function$;

-- Also create a helper function to select contiguous tables within groups
DROP FUNCTION IF EXISTS public.select_contiguous_group_tables(p_group_id uuid, p_party_size integer, p_company_id uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.select_contiguous_group_tables(
  p_group_id uuid,
  p_party_size integer,
  p_company_id uuid
)
RETURNS TABLE(
  selected_tables integer[],
  total_capacity integer,
  efficiency_score numeric,
  is_contiguous boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  group_tables integer[];
  table_seats integer[];
  selected integer[];
  running_capacity integer := 0;
  i integer;
  j integer;
  best_combination integer[];
  best_capacity integer := 0;
  best_efficiency numeric := 0;
  current_efficiency numeric;
BEGIN
  -- Get all tables in the group ordered by table number
  SELECT 
    array_agg(t.table_number ORDER BY t.table_number),
    array_agg(t.seats ORDER BY t.table_number)
  INTO group_tables, table_seats
  FROM public.table_groups tg
  JOIN public.table_group_memberships tgm ON tg.id = tgm.group_id
  JOIN public.tables t ON t.id = tgm.table_id
  WHERE tg.id = p_group_id 
    AND tg.company_id = p_company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') = 'available';

  -- Try different contiguous combinations
  FOR i IN 1..array_length(group_tables, 1) LOOP
    running_capacity := 0;
    selected := ARRAY[]::integer[];
    
    FOR j IN i..array_length(group_tables, 1) LOOP
      selected := array_append(selected, group_tables[j]);
      running_capacity := running_capacity + table_seats[j];
      
      -- Check if this combination can accommodate the party
      IF running_capacity >= p_party_size THEN
        -- Calculate efficiency (minimize wasted seats)
        current_efficiency := p_party_size::numeric / running_capacity::numeric;
        
        -- Prefer this combination if it's more efficient or uses fewer tables
        IF current_efficiency > best_efficiency OR 
           (current_efficiency = best_efficiency AND running_capacity < best_capacity) THEN
          best_combination := selected;
          best_capacity := running_capacity;
          best_efficiency := current_efficiency;
        END IF;
        
        EXIT; -- Found a valid combination, try next starting position
      END IF;
    END LOOP;
  END LOOP;

  -- Return the best combination found
  selected_tables := COALESCE(best_combination, ARRAY[]::integer[]);
  total_capacity := best_capacity;
  efficiency_score := best_efficiency;
  is_contiguous := (array_length(selected_tables, 1) > 0);
  
  RETURN NEXT;
END;
$function$;