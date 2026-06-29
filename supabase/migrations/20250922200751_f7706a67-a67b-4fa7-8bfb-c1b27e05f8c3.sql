-- Update the secure_table_insert function to include floor_level parameter
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text DEFAULT NULL,
  p_seats integer DEFAULT 4,
  p_location text DEFAULT NULL,
  p_status text DEFAULT 'available',
  p_shape text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_accessibility_friendly boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_can_combine boolean DEFAULT false,
  p_max_combine_size integer DEFAULT NULL,
  p_group_priority integer DEFAULT NULL,
  p_features jsonb DEFAULT NULL,
  p_vip_status boolean DEFAULT false,
  p_window_seating boolean DEFAULT false,
  p_privacy_level text DEFAULT NULL,
  p_ambiance text DEFAULT NULL,
  p_is_high_top boolean DEFAULT false,
  p_is_main_dining boolean DEFAULT false,
  p_is_outdoor boolean DEFAULT false,
  p_is_quiet_area boolean DEFAULT false,
  p_is_family_friendly boolean DEFAULT false,
  p_is_business_friendly boolean DEFAULT false,
  p_service_status text DEFAULT 'available',
  p_floor_level integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_new_table_id uuid;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO v_company_id 
  FROM users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or no company association');
  END IF;
  
  -- Check if table number already exists
  IF EXISTS (SELECT 1 FROM tables WHERE table_number = p_table_number AND company_id = v_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Table number already exists');
  END IF;
  
  -- Insert new table
  INSERT INTO tables (
    company_id,
    table_number,
    table_name,
    seats,
    location,
    status,
    shape,
    type,
    accessibility_friendly,
    description,
    is_active,
    can_combine,
    max_combine_size,
    group_priority,
    features,
    vip_status,
    window_seating,
    privacy_level,
    ambiance,
    is_high_top,
    is_main_dining,
    is_outdoor,
    is_quiet_area,
    is_family_friendly,
    is_business_friendly,
    service_status,
    floor_level
  ) VALUES (
    v_company_id,
    p_table_number,
    p_table_name,
    p_seats,
    p_location,
    p_status,
    p_shape,
    p_type,
    p_accessibility_friendly,
    p_description,
    p_is_active,
    p_can_combine,
    p_max_combine_size,
    p_group_priority,
    p_features,
    p_vip_status,
    p_window_seating,
    p_privacy_level,
    p_ambiance,
    p_is_high_top,
    p_is_main_dining,
    p_is_outdoor,
    p_is_quiet_area,
    p_is_family_friendly,
    p_is_business_friendly,
    p_service_status,
    p_floor_level
  )
  RETURNING id INTO v_new_table_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Table created successfully',
    'table_id', v_new_table_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;