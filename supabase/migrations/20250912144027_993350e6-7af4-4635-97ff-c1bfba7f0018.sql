-- Enhanced table assignment re-evaluation function
CREATE OR REPLACE FUNCTION public.re_evaluate_full_assignment(
  p_reservation_id uuid,
  p_company_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation record;
  v_old_table_number integer;
  v_old_table_numbers integer[];
  v_result json;
BEGIN
  -- Get current reservation details
  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id 
    AND company_id = p_company_id;
    
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Reservation not found'
    );
  END IF;
  
  -- Store old assignment
  v_old_table_number := v_reservation.table_number;
  v_old_table_numbers := v_reservation.table_numbers;
  
  -- Temporarily clear the assignment to avoid conflicts during re-evaluation
  UPDATE reservations 
  SET table_number = NULL, table_numbers = NULL
  WHERE id = p_reservation_id;
  
  -- Log the re-evaluation attempt
  INSERT INTO assignment_history (
    company_id,
    reservation_id,
    assigned_tables,
    assignment_strategy,
    rule_applied,
    success,
    conflict_detected
  ) VALUES (
    p_company_id,
    p_reservation_id,
    COALESCE(v_old_table_numbers, ARRAY[v_old_table_number]),
    're_evaluation_attempt',
    'Reset for full re-evaluation',
    true,
    false
  );
  
  -- The actual reassignment will happen in the client using SmartAutoAssignmentService
  -- This function just clears the assignment and provides the context
  
  RETURN json_build_object(
    'success', true,
    'message', 'Assignment cleared for re-evaluation',
    'old_assignment', json_build_object(
      'table_number', v_old_table_number,
      'table_numbers', v_old_table_numbers
    ),
    'reservation_details', json_build_object(
      'party_size', v_reservation.party_size,
      'date', v_reservation.date,
      'time', v_reservation.time,
      'notes', v_reservation.notes
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Restore old assignment if something goes wrong
  UPDATE reservations 
  SET table_number = v_old_table_number,
      table_numbers = v_old_table_numbers
  WHERE id = p_reservation_id;
      
  RETURN json_build_object(
    'success', false,
    'message', 'Error during re-evaluation: ' || SQLERRM
  );
END;
$function$;