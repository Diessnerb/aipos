-- Drop and recreate the function with proper parameter names
DROP FUNCTION IF EXISTS public.find_best_contiguous_sequence(integer[], integer, uuid);

CREATE OR REPLACE FUNCTION public.find_best_contiguous_sequence(table_array integer[], target_party_size integer, p_company_id uuid)
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
        SELECT t.seats INTO table_seat_count 
        FROM tables t
        WHERE t.table_number = sorted_tables[i] AND t.company_id = p_company_id;
        
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