
-- 1) Drop ambiguous/legacy overloads (keep the text-based insert we added earlier)
DROP FUNCTION IF EXISTS public.secure_table_update(
  uuid, integer, text, integer, text, text, text, boolean, text
);
DROP FUNCTION IF EXISTS public.secure_table_update(
  uuid, integer, text, integer, text, text, text, boolean, text, uuid
);
DROP FUNCTION IF EXISTS public.secure_table_update(
  uuid, integer, text, integer, text, text, text, boolean, text, text
);

DROP FUNCTION IF EXISTS public.secure_table_delete(uuid);
DROP FUNCTION IF EXISTS public.secure_table_delete(uuid, uuid);
DROP FUNCTION IF EXISTS public.secure_table_delete(uuid, text);

-- Keep the canonical secure_table_insert that uses p_company_id as text.
-- But remove any legacy insert variant that used uuid for p_company_id:
DROP FUNCTION IF EXISTS public.secure_table_insert(
  integer, text, integer, text, text, text, boolean, text, uuid
);

-- 2) Recreate a single canonical secure_table_update (company-aware, PIN-friendly)
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
  p_company_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
  -- Resolve company id from explicit text param or current user (for authed sessions)
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
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  UPDATE public.tables
  SET
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
$function$;

-- 3) Recreate a single canonical secure_table_delete (company-aware, PIN-friendly)
CREATE OR REPLACE FUNCTION public.secure_table_delete(
  p_table_id uuid,
  p_company_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
BEGIN
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
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  UPDATE public.tables
  SET is_active = false
  WHERE id = p_table_id
    AND company_id = v_company_id
    AND is_active = true;

  RETURN FOUND;
END;
$function$;

-- 4) Ensure RPCs are callable by both anon and authenticated (needed for PIN-only sessions)
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
  p_company_id text
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.secure_table_delete(
  p_table_id uuid,
  p_company_id text
) TO anon, authenticated;
