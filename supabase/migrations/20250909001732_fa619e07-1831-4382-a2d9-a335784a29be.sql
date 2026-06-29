-- Update RPC function to properly handle company validation
CREATE OR REPLACE FUNCTION move_reservation_for_optimization(
  p_reservation_id uuid,
  p_new_table_number integer,
  p_company_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id uuid;
  v_reservation_company_id uuid;
BEGIN
  -- Get the reservation's company to ensure it matches
  SELECT company_id INTO v_reservation_company_id
  FROM reservations 
  WHERE id = p_reservation_id;
  
  -- Verify the reservation exists and belongs to the expected company
  IF v_reservation_company_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  IF v_reservation_company_id != p_company_id THEN
    RAISE EXCEPTION 'Company mismatch for reservation';
  END IF;
  
  -- Set a session variable to identify this as an optimization operation
  PERFORM set_config('app.is_optimization', 'true', true);
  
  -- Update the reservation with proper context
  UPDATE reservations 
  SET 
    table_number = p_new_table_number,
    table_numbers = ARRAY[p_new_table_number],
    updated_at = now()
  WHERE id = p_reservation_id 
    AND company_id = p_company_id;
  
  -- Reset the session variable
  PERFORM set_config('app.is_optimization', '', true);
  
  RETURN FOUND;
EXCEPTION WHEN OTHERS THEN
  -- Reset the session variable in case of error
  PERFORM set_config('app.is_optimization', '', true);
  RAISE;
END;
$$;