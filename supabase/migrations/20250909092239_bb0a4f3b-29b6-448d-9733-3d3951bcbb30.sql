-- Fix the re-evaluation function to not update non-existent updated_at column
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
            table_number = NULL
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