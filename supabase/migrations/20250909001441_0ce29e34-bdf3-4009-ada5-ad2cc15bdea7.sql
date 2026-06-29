-- Create RPC function to move reservations during optimization
CREATE OR REPLACE FUNCTION move_reservation_for_optimization(
  p_reservation_id uuid,
  p_new_table_number integer,
  p_company_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the reservation belongs to the company
  IF NOT EXISTS (
    SELECT 1 FROM reservations 
    WHERE id = p_reservation_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Reservation not found or access denied';
  END IF;
  
  -- Update the reservation
  UPDATE reservations 
  SET 
    table_number = p_new_table_number,
    table_numbers = ARRAY[p_new_table_number]
  WHERE id = p_reservation_id;
  
  RETURN FOUND;
END;
$$;