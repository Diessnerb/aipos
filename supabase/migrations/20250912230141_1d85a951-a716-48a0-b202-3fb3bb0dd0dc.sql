-- Create enhanced table group availability detection function (fixed syntax)
CREATE OR REPLACE FUNCTION public.get_table_groups_with_real_time_availability(
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer,
  p_accessibility_needed boolean DEFAULT false
)
RETURNS TABLE(
  group_id uuid,
  group_name text,
  table_numbers integer[],
  total_seats integer,
  is_available boolean,
  blocking_reservations jsonb,
  optimization_potential integer,
  accessibility_friendly boolean,
  can_accommodate boolean
)
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
  blocking_res jsonb := '[]'::jsonb;
  total_blocked integer := 0;
  res_record record;
BEGIN
  -- Convert time to minutes for overlap checking
  start_minutes := EXTRACT(hour FROM p_time) * 60 + EXTRACT(minute FROM p_time);
  end_minutes := start_minutes + 120; -- 2-hour duration
  
  -- Loop through all table groups for the company
  FOR group_rec IN (
    SELECT 
      tg.id,
      tg.group_name,
      array_agg(tgt.table_number ORDER BY tgt.table_number) as tables,
      sum(t.seats) as seats,
      bool_and(COALESCE(t.accessibility_friendly, false)) as all_accessible
    FROM public.table_groups tg
    JOIN public.table_group_tables tgt ON tg.id = tgt.group_id
    JOIN public.tables t ON t.table_number = tgt.table_number AND t.company_id = tg.company_id
    WHERE tg.company_id = p_company_id
      AND t.is_active = true
      AND COALESCE(t.service_status, 'available') = 'available'
    GROUP BY tg.id, tg.group_name
    HAVING sum(t.seats) >= p_party_size
  ) LOOP
    
    -- Reset for each group
    blocked_tables := ARRAY[]::integer[];
    blocking_res := '[]'::jsonb;
    total_blocked := 0;
    
    -- Check each table in the group for conflicts
    FOREACH table_num IN ARRAY group_rec.tables LOOP
      -- Find blocking reservations for this table
      FOR res_record IN (
        SELECT r.id, r.customer_name, r.party_size, r.time, r.table_number, r.table_numbers
        FROM public.reservations r
        WHERE r.company_id = p_company_id
          AND r.date = p_date
          AND r.status NOT IN ('cancelled', 'no-show')
          AND (
            -- Table is assigned to this reservation
            (r.table_number = table_num)
            OR
            (r.table_numbers IS NOT NULL AND table_num = ANY(r.table_numbers))
          )
          AND (
            -- Time overlap check
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time)) < end_minutes
            AND 
            (EXTRACT(hour FROM r.time) * 60 + EXTRACT(minute FROM r.time) + 120) > start_minutes
          )
      ) LOOP
        -- Add to blocked tables
        blocked_tables := array_append(blocked_tables, table_num);
        total_blocked := total_blocked + 1;
        
        -- Add blocking reservation info
        blocking_res := blocking_res || jsonb_build_object(
          'id', res_record.id,
          'customer_name', res_record.customer_name,
          'party_size', res_record.party_size,
          'time', res_record.time,
          'table_number', res_record.table_number,
          'table_numbers', res_record.table_numbers,
          'blocking_table', table_num
        );
        
        EXIT; -- One conflict per table is enough
      END LOOP;
    END LOOP;
    
    -- Determine availability and optimization potential
    group_id := group_rec.id;
    group_name := group_rec.group_name;
    table_numbers := group_rec.tables;
    total_seats := group_rec.seats;
    is_available := (array_length(blocked_tables, 1) IS NULL);
    blocking_reservations := blocking_res;
    optimization_potential := total_blocked;
    accessibility_friendly := group_rec.all_accessible;
    can_accommodate := (group_rec.seats >= p_party_size);
    
    -- Apply accessibility filter if needed
    IF p_accessibility_needed AND NOT group_rec.all_accessible THEN
      can_accommodate := false;
    END IF;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$function$;