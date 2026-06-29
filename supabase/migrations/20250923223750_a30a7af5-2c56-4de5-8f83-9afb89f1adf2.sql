-- Create insert v2 function with proper parameter defaults
CREATE OR REPLACE FUNCTION public.secure_table_insert_v2(
  p_table_number integer,
  p_seats integer,
  p_table_name text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_shape text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_can_combine boolean DEFAULT false,
  p_vip_status boolean DEFAULT false,
  p_window_seating boolean DEFAULT false,
  p_privacy_level text DEFAULT NULL,
  p_is_high_top boolean DEFAULT false,
  p_is_main_dining boolean DEFAULT false,
  p_is_outdoor boolean DEFAULT false,
  p_is_quiet_area boolean DEFAULT false,
  p_is_family_friendly boolean DEFAULT false,
  p_is_business_friendly boolean DEFAULT false,
  p_service_status text DEFAULT 'available'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_exists boolean;
  v_new_id uuid;
BEGIN
  -- Identify company for current user
  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User company not found');
  END IF;

  -- Prevent duplicate table number within company
  SELECT EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.company_id = v_company_id AND t.table_number = p_table_number
  ) INTO v_exists;

  IF v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Table number already exists');
  END IF;

  INSERT INTO public.tables (
    company_id,
    table_number,
    table_name,
    seats,
    type,
    shape,
    accessibility_friendly,
    description,
    can_combine,
    vip_status,
    window_seating,
    privacy_level,
    is_high_top,
    is_main_dining,
    is_outdoor,
    is_quiet_area,
    is_family_friendly,
    is_business_friendly,
    service_status,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_company_id,
    p_table_number,
    p_table_name,
    p_seats,
    p_type,
    p_shape,
    COALESCE(p_accessibility_friendly, false),
    p_description,
    COALESCE(p_can_combine, false),
    COALESCE(p_vip_status, false),
    COALESCE(p_window_seating, false),
    p_privacy_level,
    COALESCE(p_is_high_top, false),
    COALESCE(p_is_main_dining, false),
    COALESCE(p_is_outdoor, false),
    COALESCE(p_is_quiet_area, false),
    COALESCE(p_is_family_friendly, false),
    COALESCE(p_is_business_friendly, false),
    COALESCE(p_service_status, 'available'),
    true,
    now(),
    now()
  ) RETURNING id INTO v_new_id;

  RETURN json_build_object('success', true, 'id', v_new_id, 'message', 'Table created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;