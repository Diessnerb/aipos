-- Fix persistent function overloading by dropping ALL versions explicitly
-- The issue is parameter order differences between versions

-- Drop ALL possible versions of secure_table_update_v2 with different parameter orders
DROP FUNCTION IF EXISTS public.secure_table_update_v2(uuid, integer, integer, text, text, text, boolean, text, boolean, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, text);
DROP FUNCTION IF EXISTS public.secure_table_update_v2(uuid, integer, text, integer, text, text, boolean, text, boolean, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean, text);
DROP FUNCTION IF EXISTS public.secure_table_update_v2(uuid, text, integer, integer, text, text, boolean, text, boolean, boolean, boolean, text, boolean, boolean, boolean, boolean, boolean, boolean);

-- Drop any other possible variations
DROP FUNCTION IF EXISTS public.secure_table_update_v2;

-- Now create the single, definitive version with explicit parameter names and consistent order
CREATE FUNCTION public.secure_table_update_v2(
  p_table_id uuid,
  p_table_number integer DEFAULT NULL,
  p_seats integer DEFAULT NULL,
  p_table_name text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_can_combine boolean DEFAULT NULL,
  p_vip_status boolean DEFAULT NULL,
  p_window_seating boolean DEFAULT NULL,
  p_privacy_level text DEFAULT NULL,
  p_is_high_top boolean DEFAULT NULL,
  p_is_main_dining boolean DEFAULT NULL,
  p_is_outdoor boolean DEFAULT NULL,
  p_is_quiet_area boolean DEFAULT NULL,
  p_is_family_friendly boolean DEFAULT NULL,
  p_is_business_friendly boolean DEFAULT NULL,
  p_service_status text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_exists boolean;
  v_duplicate_check boolean;
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User company not found');
  END IF;

  -- Check if table exists and belongs to user's company
  SELECT EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = p_table_id AND t.company_id = v_company_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or access denied');
  END IF;

  -- Check for duplicate table number if updating table number
  IF p_table_number IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tables t
      WHERE t.company_id = v_company_id 
        AND t.table_number = p_table_number 
        AND t.id != p_table_id
    ) INTO v_duplicate_check;

    IF v_duplicate_check THEN
      RETURN json_build_object('success', false, 'error', 'Table number already exists');
    END IF;
  END IF;

  UPDATE public.tables
  SET 
    table_number = COALESCE(p_table_number, table_number),
    seats = COALESCE(p_seats, seats),
    table_name = COALESCE(p_table_name, table_name),
    type = COALESCE(p_type, type),
    shape = COALESCE(p_shape, shape),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description),
    can_combine = COALESCE(p_can_combine, can_combine),
    vip_status = COALESCE(p_vip_status, vip_status),
    window_seating = COALESCE(p_window_seating, window_seating),
    privacy_level = COALESCE(p_privacy_level, privacy_level),
    is_high_top = COALESCE(p_is_high_top, is_high_top),
    is_main_dining = COALESCE(p_is_main_dining, is_main_dining),
    is_outdoor = COALESCE(p_is_outdoor, is_outdoor),
    is_quiet_area = COALESCE(p_is_quiet_area, is_quiet_area),
    is_family_friendly = COALESCE(p_is_family_friendly, is_family_friendly),
    is_business_friendly = COALESCE(p_is_business_friendly, is_business_friendly),
    service_status = COALESCE(p_service_status, service_status)
  WHERE id = p_table_id AND company_id = v_company_id;

  RETURN json_build_object('success', true, 'message', 'Table updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;