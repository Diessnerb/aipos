
-- 1) Drop all existing secure_table_insert overloads to eliminate ambiguity
DROP FUNCTION IF EXISTS public.secure_table_insert(
  integer, text, integer, text, text, text, boolean, text, uuid
);
DROP FUNCTION IF EXISTS public.secure_table_insert(
  integer, text, integer, text, text, text, boolean, text, text
);
DROP FUNCTION IF EXISTS public.secure_table_insert(
  integer, text, integer, text, text, text, boolean, text
);

-- 2) Create a single, canonical secure_table_insert
--    - Accepts p_company_id as text (works for both PIN-only and authed sessions)
--    - Safely casts/derives company id and inserts the row
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text,
  p_seats integer,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_company_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_new_table_id uuid;
BEGIN
  -- Determine company id:
  -- 1) If a non-empty company id is provided, try to cast it to uuid
  -- 2) Otherwise, fall back to the current authed user's company (if any)
  IF p_company_id IS NOT NULL AND p_company_id <> '' AND p_company_id <> 'auto-set-by-rls' THEN
    BEGIN
      v_company_id := p_company_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_company_id := public.get_user_company_safe();
    END;
  ELSE
    v_company_id := public.get_user_company_safe();
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required and could not be determined';
  END IF;

  INSERT INTO public.tables (
    table_number,
    table_name,
    seats,
    type,
    shape,
    location,
    accessibility_friendly,
    description,
    company_id,
    status,
    is_active
  ) VALUES (
    p_table_number,
    NULLIF(p_table_name, ''),
    p_seats,
    NULLIF(p_type, ''),
    COALESCE(NULLIF(p_shape, ''), 'Rectangle'),
    NULLIF(p_location, ''),
    COALESCE(p_accessibility_friendly, false),
    NULLIF(p_description, ''),
    v_company_id,
    'available',
    true
  )
  RETURNING id INTO v_new_table_id;

  RETURN v_new_table_id;
END;
$function$;

-- 3) Grant execution to both anon and authenticated (needed for PIN-only flows)
GRANT EXECUTE ON FUNCTION public.secure_table_insert(
  integer, text, integer, text, text, text, boolean, text, text
) TO anon, authenticated;
