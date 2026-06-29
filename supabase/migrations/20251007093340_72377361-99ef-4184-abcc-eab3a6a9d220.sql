-- Simplify table conflict error message
CREATE OR REPLACE FUNCTION public.prevent_table_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_tables integer[];
  conflict_found boolean := false;
  exclude_id uuid := NULL;
  lock_key bigint;
BEGIN
  -- Build array of target tables
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) > 0 THEN
    target_tables := NEW.table_numbers;
  ELSIF NEW.table_number IS NOT NULL THEN
    target_tables := ARRAY[NEW.table_number];
  ELSE
    RETURN NEW;
  END IF;

  -- Skip if no tables assigned or cancelled/no-show
  IF array_length(target_tables, 1) IS NULL OR 
     NEW.status IN ('cancelled', 'no-show') THEN
    RETURN NEW;
  END IF;

  -- Determine exclude_id for updates
  IF TG_OP = 'UPDATE' THEN
    exclude_id := OLD.id;
  END IF;

  -- Generate a deterministic lock key based on company_id, date, and tables
  lock_key := ('x' || md5(
    NEW.company_id::text || 
    NEW.date::text || 
    array_to_string(target_tables, ',')
  ))::bit(64)::bigint;

  -- Acquire advisory lock to prevent race conditions
  PERFORM pg_advisory_lock(lock_key);

  -- Check for conflicts using the centralized function
  SELECT public.check_table_conflict(
    target_tables,
    NEW.date,
    NEW.time,
    exclude_id
  ) INTO conflict_found;
  
  -- Release advisory lock
  PERFORM pg_advisory_unlock(lock_key);
  
  -- Raise simplified error if conflict detected
  IF conflict_found THEN
    RAISE EXCEPTION 'Not enough space on these tables'
    USING ERRCODE = '23505';
  END IF;
  
  RETURN NEW;
END;
$function$;