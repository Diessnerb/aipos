-- Check if the functions exist and recreate the table assignment functions
CREATE OR REPLACE FUNCTION public.select_contiguous_group_tables(p_company_id uuid, p_party_size integer)
RETURNS TABLE(group_id uuid, table_numbers integer[], total_seats integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    group_rec RECORD;
    contiguous_tables integer[];
    table_seats_sum integer;
BEGIN
    -- Loop through active table groups for the company, ordered by priority
    FOR group_rec IN
        SELECT tg.id, tg.group_name, tg.max_combined_capacity,
               array_agg(t.table_number ORDER BY t.table_number) as all_tables,
               sum(t.seats) as total_group_seats
        FROM table_groups tg
        JOIN table_group_memberships tgm ON tg.id = tgm.group_id
        JOIN tables t ON tgm.table_id = t.id
        WHERE tg.company_id = p_company_id 
          AND tg.is_active = true
          AND t.is_active = true
          AND t.service_status = 'available'
        GROUP BY tg.id, tg.group_name, tg.max_combined_capacity, tg.display_order
        HAVING sum(t.seats) >= p_party_size
        ORDER BY tg.display_order, sum(t.seats)
    LOOP
        -- Find the best contiguous sequence
        contiguous_tables := public.find_best_contiguous_sequence(group_rec.all_tables, p_party_size, p_company_id);
        
        -- Calculate actual seats for the selected tables
        SELECT sum(t.seats) INTO table_seats_sum
        FROM tables t
        WHERE t.table_number = ANY(contiguous_tables)
          AND t.company_id = p_company_id;
        
        -- Return the first suitable group
        IF contiguous_tables IS NOT NULL AND array_length(contiguous_tables, 1) > 0 THEN
            RETURN QUERY SELECT group_rec.id, contiguous_tables, table_seats_sum;
            RETURN;
        END IF;
    END LOOP;
    
    -- No suitable group found
    RETURN;
END;
$$;

-- Helper function to find best contiguous sequence within a group
CREATE OR REPLACE FUNCTION public.find_best_contiguous_sequence(table_array integer[], target_party_size integer, company_id uuid)
RETURNS integer[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    sorted_tables integer[];
    best_sequence integer[];
    current_sequence integer[];
    current_seats integer;
    i integer;
    j integer;
    table_seats_map jsonb := '{}';
    table_seat_count integer;
BEGIN
    -- Sort the table numbers
    SELECT array_agg(t ORDER BY t) INTO sorted_tables FROM unnest(table_array) t;
    
    -- Build a map of table numbers to seat counts for quick lookup
    FOR i IN 1..array_length(sorted_tables, 1) LOOP
        SELECT seats INTO table_seat_count 
        FROM tables 
        WHERE table_number = sorted_tables[i] AND company_id = company_id;
        
        table_seats_map := jsonb_set(table_seats_map, ARRAY[sorted_tables[i]::text], table_seat_count::text::jsonb);
    END LOOP;
    
    -- Try different contiguous sequences
    FOR i IN 1..array_length(sorted_tables, 1) LOOP
        current_sequence := ARRAY[]::integer[];
        current_seats := 0;
        
        -- Build sequence starting from position i
        FOR j IN i..array_length(sorted_tables, 1) LOOP
            current_sequence := array_append(current_sequence, sorted_tables[j]);
            current_seats := current_seats + (table_seats_map->>sorted_tables[j]::text)::integer;
            
            -- Check if this sequence meets our needs
            IF current_seats >= target_party_size THEN
                -- If this is our first valid sequence or it's better than the current best
                IF best_sequence IS NULL OR 
                   array_length(current_sequence, 1) < array_length(best_sequence, 1) OR
                   (array_length(current_sequence, 1) = array_length(best_sequence, 1) AND current_seats < (
                       SELECT sum((table_seats_map->>t::text)::integer) 
                       FROM unnest(best_sequence) t
                   )) THEN
                    best_sequence := current_sequence;
                END IF;
                EXIT; -- Found a valid sequence from this starting point
            END IF;
            
            -- Break if tables are not contiguous (gap > 1)
            IF j < array_length(sorted_tables, 1) AND 
               sorted_tables[j+1] - sorted_tables[j] > 1 THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN best_sequence;
END;
$$;

-- Function to re-evaluate and update a specific reservation's table assignment
CREATE OR REPLACE FUNCTION public.re_evaluate_reservation_assignment(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    res_record RECORD;
    assignment_result RECORD;
    old_assignment jsonb;
    new_assignment jsonb;
BEGIN
    -- Get the reservation details
    SELECT * INTO res_record 
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation not found');
    END IF;
    
    -- Store old assignment
    old_assignment := jsonb_build_object(
        'table_number', res_record.table_number,
        'table_numbers', res_record.table_numbers
    );
    
    -- Try to get better table assignment using the new logic
    SELECT * INTO assignment_result
    FROM select_contiguous_group_tables(res_record.company_id, res_record.party_size)
    LIMIT 1;
    
    IF FOUND AND assignment_result.table_numbers IS NOT NULL THEN
        -- Update with new multi-table assignment
        UPDATE reservations 
        SET 
            table_numbers = assignment_result.table_numbers,
            table_number = NULL,
            updated_at = now()
        WHERE id = p_reservation_id;
        
        new_assignment := jsonb_build_object(
            'table_number', NULL,
            'table_numbers', assignment_result.table_numbers,
            'total_seats', assignment_result.total_seats
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'updated', true,
            'old_assignment', old_assignment,
            'new_assignment', new_assignment,
            'message', 'Reservation updated with multi-table assignment'
        );
    ELSE
        -- No better assignment found
        RETURN jsonb_build_object(
            'success', true,
            'updated', false,
            'current_assignment', old_assignment,
            'message', 'No better table assignment available'
        );
    END IF;
END;
$$;