-- Fix the search_path security issue for the new function
CREATE OR REPLACE FUNCTION public.auto_assign_table_on_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_auto_assign_enabled boolean;
  available_tables_count integer;
  assigned_table_number integer;
BEGIN
  -- Only process INSERT operations for new reservations
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if auto-assignment is enabled for this company
  SELECT auto_assign_tables INTO company_auto_assign_enabled
  FROM company_settings
  WHERE company_id = NEW.company_id
  LIMIT 1;

  -- If auto-assignment is not enabled, skip
  IF NOT COALESCE(company_auto_assign_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Skip if reservation already has a table assigned
  IF NEW.table_number IS NOT NULL OR NEW.table_numbers IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip certain statuses that don't need table assignment
  IF NEW.status IN ('cancelled', 'no-show', 'completed') THEN
    RETURN NEW;
  END IF;

  -- Skip if party size is too large (>10 people)
  IF NEW.party_size > 10 THEN
    RETURN NEW;
  END IF;

  -- Find a suitable table
  -- First, check if accessibility is needed (basic keyword detection in notes)
  IF NEW.notes IS NOT NULL AND (
    LOWER(NEW.notes) LIKE '%wheelchair%' OR
    LOWER(NEW.notes) LIKE '%disabled%' OR
    LOWER(NEW.notes) LIKE '%accessibility%' OR
    LOWER(NEW.notes) LIKE '%accessible%' OR
    LOWER(NEW.notes) LIKE '%mobility%'
  ) THEN
    -- Find accessible table with enough seats
    SELECT table_number INTO assigned_table_number
    FROM tables
    WHERE company_id = NEW.company_id
      AND is_active = true
      AND accessibility_friendly = true
      AND seats >= NEW.party_size
      AND table_number NOT IN (
        -- Check for conflicts with existing reservations
        SELECT COALESCE(r.table_number, unnest(r.table_numbers))
        FROM reservations r
        WHERE r.date = NEW.date
          AND r.status NOT IN ('cancelled', 'no-show', 'completed')
          AND (
            -- Check for time overlap (assuming 90 minute duration)
            (NEW.time, NEW.time + interval '90 minutes') OVERLAPS 
            (r.time, COALESCE(r.end_time, r.time + interval '90 minutes'))
          )
      )
    ORDER BY seats ASC -- Prefer smallest suitable table
    LIMIT 1;
  ELSE
    -- Find any suitable table
    SELECT table_number INTO assigned_table_number
    FROM tables
    WHERE company_id = NEW.company_id
      AND is_active = true
      AND seats >= NEW.party_size
      AND table_number NOT IN (
        -- Check for conflicts with existing reservations
        SELECT COALESCE(r.table_number, unnest(r.table_numbers))
        FROM reservations r
        WHERE r.date = NEW.date
          AND r.status NOT IN ('cancelled', 'no-show', 'completed')
          AND (
            -- Check for time overlap (assuming 90 minute duration)
            (NEW.time, NEW.time + interval '90 minutes') OVERLAPS 
            (r.time, COALESCE(r.end_time, r.time + interval '90 minutes'))
          )
      )
    ORDER BY seats ASC -- Prefer smallest suitable table
    LIMIT 1;
  END IF;

  -- If a table was found, assign it
  IF assigned_table_number IS NOT NULL THEN
    NEW.table_number := assigned_table_number;
    NEW.table_numbers := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger to run the auto-assignment function on INSERT
DROP TRIGGER IF EXISTS trigger_auto_assign_table ON public.reservations;
CREATE TRIGGER trigger_auto_assign_table
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_table_on_insert();