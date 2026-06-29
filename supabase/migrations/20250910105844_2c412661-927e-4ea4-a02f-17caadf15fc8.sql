-- Company-scoped unavailable tables guardrails

-- 1) Prevent assigning reservations to unavailable tables (company-scoped)
CREATE OR REPLACE FUNCTION public.prevent_unavailable_table_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Name with 'zz_' to run after other BEFORE triggers like set_reservation_company_id
DROP TRIGGER IF EXISTS zz_prevent_unavailable_table_assignments ON public.reservations;
CREATE TRIGGER zz_prevent_unavailable_table_assignments
BEFORE INSERT OR UPDATE OF table_number, table_numbers ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unavailable_table_assignments();

-- 2) Company-scoped RPC for operational tables
CREATE OR REPLACE FUNCTION public.get_operational_tables(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  table_number integer,
  table_name text,
  seats integer,
  accessibility_friendly boolean,
  service_status text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, 
    t.company_id, 
    t.table_number, 
    t.table_name, 
    t.seats, 
    t.accessibility_friendly, 
    COALESCE(t.service_status, 'available') as service_status, 
    t.is_active
  FROM public.tables t
  WHERE t.company_id = p_company_id
    AND t.is_active = true
    AND COALESCE(t.service_status, 'available') != 'temporarily_removed'
  ORDER BY t.table_number;
END;
$$;

-- 3) Ensure unique table numbers per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_table_number_per_company 
ON public.tables (company_id, table_number) 
WHERE is_active = true;

-- 4) Data hygiene: backfill default service_status for existing tables
UPDATE public.tables 
SET service_status = 'available' 
WHERE service_status IS NULL;