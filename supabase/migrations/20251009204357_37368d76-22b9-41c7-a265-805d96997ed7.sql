-- Phase 2: Add SET search_path to Security Definer Functions
-- This prevents schema poisoning attacks on security-critical functions
-- ZERO RISK - Only makes functions more secure

-- ============================================================================
-- Update trigger functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_company_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_reservation_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_page_permission_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_company_settings_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  -- Keep the existing behavior for the id field  
  IF NEW.id IS NULL THEN
    NEW.id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_menu_category_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Safely handle sentinel and null values
  IF NEW.company_id IS NULL OR NEW.company_id::text = 'auto-set-by-rls' THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_table_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Set company_id if not provided
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_safe();
  END IF;
  
  -- Set is_active default
  IF NEW.is_active IS NULL THEN
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_reservation_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only set defaults for new reservations (INSERT), not updates
  IF TG_OP = 'INSERT' THEN
    NEW.start_time := NEW.time;
    NEW.end_time := NEW.time + interval '90 minutes';
    NEW.status := 'confirmed';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reservations_normalize_tables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If table_numbers has exactly one element, set table_number to match
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers, 1) = 1 THEN
    NEW.table_number := NEW.table_numbers[1];
  END IF;
  
  -- If table_number is set but table_numbers is empty/null, set table_numbers
  IF NEW.table_number IS NOT NULL AND (NEW.table_numbers IS NULL OR array_length(NEW.table_numbers, 1) = 0) THEN
    NEW.table_numbers := ARRAY[NEW.table_number];
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_table_conflicts()
RETURNS trigger
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

CREATE OR REPLACE FUNCTION public.prevent_unavailable_table_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_unavailable integer;
  v_target_tables integer[];
BEGIN
  -- Build array of target tables from NEW
  IF NEW.table_numbers IS NOT NULL AND array_length(NEW.table_numbers,1) > 0 THEN
    v_target_tables := NEW.table_numbers;
  ELSIF NEW.table_number IS NOT NULL THEN
    v_target_tables := ARRAY[NEW.table_number];
  ELSE
    RETURN NEW; -- No table assignment to validate
  END IF;

  -- Check for unavailable tables within the same company
  SELECT COUNT(*) INTO v_unavailable
  FROM public.tables t
  WHERE t.company_id = NEW.company_id
    AND t.table_number = ANY(v_target_tables)
    AND (
      t.is_active = false OR
      COALESCE(t.service_status, 'available') IN ('out_of_service','temporarily_removed')
    );

  IF v_unavailable > 0 THEN
    RAISE EXCEPTION 'One or more selected tables are unavailable for service (out of service or temporarily removed).'
      USING HINT = 'Choose tables with service_status = available';
  END IF;

  RETURN NEW;
END;
$function$;