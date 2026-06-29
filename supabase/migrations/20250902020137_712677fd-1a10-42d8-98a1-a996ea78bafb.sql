
-- 1) Ensure required columns exist on public.tables (idempotent)
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS shape text,
  ADD COLUMN IF NOT EXISTS accessibility_friendly boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Ensure unique index only for active tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_number_company 
ON public.tables (table_number, company_id) 
WHERE is_active = true;

-- Ensure realtime is fully informative for updates
ALTER TABLE public.tables REPLICA IDENTITY FULL;

-- 2) Update secure_table_update to support PIN-only flows via p_company_id
CREATE OR REPLACE FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer DEFAULT NULL,
  p_table_name text DEFAULT NULL, 
  p_seats integer DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Allow either explicit company_id or fallback to current auth user's company
  v_company_id := COALESCE(p_company_id, public.get_user_company_safe());

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  UPDATE public.tables SET
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
    type = COALESCE(p_type, type),
    shape = COALESCE(p_shape, shape),
    location = COALESCE(p_location, location),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description)
  WHERE id = p_table_id
    AND company_id = v_company_id
    AND is_active = true;

  RETURN FOUND;
END;
$$;

-- 3) Update secure_table_delete to support PIN-only flows via p_company_id
CREATE OR REPLACE FUNCTION public.secure_table_delete(
  p_table_id uuid,
  p_company_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := COALESCE(p_company_id, public.get_user_company_safe());

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  UPDATE public.tables
  SET is_active = false
  WHERE id = p_table_id
    AND company_id = v_company_id
    AND is_active = true;

  RETURN FOUND;
END;
$$;

-- 4) Ensure RPCs are callable by anon/authenticated
GRANT EXECUTE ON FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text,
  p_shape text,
  p_location text,
  p_accessibility_friendly boolean,
  p_description text,
  p_company_id uuid
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer,
  p_table_name text, 
  p_seats integer,
  p_type text,
  p_shape text,
  p_location text,
  p_accessibility_friendly boolean,
  p_description text,
  p_company_id uuid
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.secure_table_delete(
  p_table_id uuid,
  p_company_id uuid
) TO anon, authenticated;
