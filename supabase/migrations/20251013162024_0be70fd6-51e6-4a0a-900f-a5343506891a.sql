-- Layer 1: Database-level protection against assigning reservations to unavailable tables

-- Function to validate table availability
CREATE OR REPLACE FUNCTION validate_reservation_tables()
RETURNS TRIGGER AS $$
DECLARE
  unavailable_table INTEGER;
  table_status TEXT;
BEGIN
  -- Check table_number (single table assignment)
  IF NEW.table_number IS NOT NULL THEN
    SELECT t.table_number, t.service_status 
    INTO unavailable_table, table_status
    FROM tables t
    WHERE t.company_id = NEW.company_id 
      AND t.table_number = NEW.table_number
      AND (
        t.is_active = false 
        OR t.service_status IN ('out_of_service', 'temporarily_removed')
      )
    LIMIT 1;
    
    IF unavailable_table IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign reservation to unavailable table %. Status: %', 
        unavailable_table, COALESCE(table_status, 'inactive');
    END IF;
  END IF;
  
  -- Check table_numbers (multi-table assignment)
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) > 0 THEN
    SELECT t.table_number, t.service_status 
    INTO unavailable_table, table_status
    FROM tables t
    WHERE t.company_id = NEW.company_id
      AND t.table_number = ANY(NEW.table_numbers)
      AND (
        t.is_active = false 
        OR t.service_status IN ('out_of_service', 'temporarily_removed')
      )
    LIMIT 1;
    
    IF unavailable_table IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign reservation to unavailable table % in group. Status: %', 
        unavailable_table, COALESCE(table_status, 'inactive');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce table availability on reservations
DROP TRIGGER IF EXISTS check_table_availability ON reservations;
CREATE TRIGGER check_table_availability
  BEFORE INSERT OR UPDATE OF table_number, table_numbers
  ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_reservation_tables();