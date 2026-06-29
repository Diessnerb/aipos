-- Fix secure_table_update to remove floor plan position column references
-- that don't exist in the current database schema

CREATE OR REPLACE FUNCTION public.secure_table_update(
  p_table_id uuid,
  p_table_number integer DEFAULT NULL,
  p_table_name text DEFAULT NULL,
  p_seats integer DEFAULT NULL,
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
  p_service_status text DEFAULT NULL,
  p_floor_level integer DEFAULT NULL,
  p_x_position double precision DEFAULT NULL,
  p_y_position double precision DEFAULT NULL,
  p_rotation double precision DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_existing_table_number integer;
  v_table_exists boolean;
BEGIN
  -- Get company_id from current user context
  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User company not found');
  END IF;

  -- Check if table exists and belongs to company
  SELECT table_number INTO v_existing_table_number
  FROM public.tables
  WHERE id = p_table_id AND company_id = v_company_id;

  IF v_existing_table_number IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or access denied');
  END IF;

  -- Check for duplicate table number (only if table number is being changed)
  IF p_table_number IS NOT NULL AND p_table_number != v_existing_table_number THEN
    SELECT EXISTS(
      SELECT 1 FROM public.tables
      WHERE company_id = v_company_id
        AND table_number = p_table_number
        AND id != p_table_id
    ) INTO v_table_exists;

    IF v_table_exists THEN
      RETURN json_build_object('success', false, 'error', 'Table number already exists');
    END IF;
  END IF;

  -- Update table (removed floor plan position columns)
  UPDATE public.tables SET
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
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
    service_status = COALESCE(p_service_status, service_status),
    updated_at = now()
  WHERE id = p_table_id AND company_id = v_company_id;

  RETURN json_build_object('success', true, 'message', 'Table updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;