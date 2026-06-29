-- Update the secure_table_update function to include floor_level parameter
CREATE OR REPLACE FUNCTION public.secure_table_update(
p_table_id uuid,
p_table_number integer DEFAULT NULL,
p_table_name text DEFAULT NULL,
p_seats integer DEFAULT NULL,
p_location text DEFAULT NULL,
p_status text DEFAULT NULL,
p_shape text DEFAULT NULL,
p_type text DEFAULT NULL,
p_accessibility_friendly boolean DEFAULT NULL,
p_description text DEFAULT NULL,
p_is_active boolean DEFAULT NULL,
p_can_combine boolean DEFAULT NULL,
p_max_combine_size integer DEFAULT NULL,
p_group_priority integer DEFAULT NULL,
p_features jsonb DEFAULT NULL,
p_vip_status boolean DEFAULT NULL,
p_window_seating boolean DEFAULT NULL,
p_privacy_level text DEFAULT NULL,
p_ambiance text DEFAULT NULL,
p_is_high_top boolean DEFAULT NULL,
p_is_main_dining boolean DEFAULT NULL,
p_is_outdoor boolean DEFAULT NULL,
p_is_quiet_area boolean DEFAULT NULL,
p_is_family_friendly boolean DEFAULT NULL,
p_is_business_friendly boolean DEFAULT NULL,
p_service_status text DEFAULT NULL,
p_floor_level integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_table_exists boolean;
  v_duplicate_number boolean;
  v_updated_table record;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO v_company_id 
  FROM users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or no company association');
  END IF;
  
  -- Check if table exists and belongs to user's company
  SELECT EXISTS(
    SELECT 1 FROM tables 
    WHERE id = p_table_id AND company_id = v_company_id
  ) INTO v_table_exists;
  
  IF NOT v_table_exists THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or access denied');
  END IF;
  
  -- Check for duplicate table number (if updating table_number)
  IF p_table_number IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM tables 
      WHERE table_number = p_table_number 
        AND company_id = v_company_id 
        AND id != p_table_id
    ) INTO v_duplicate_number;
    
    IF v_duplicate_number THEN
      RETURN json_build_object('success', false, 'error', 'Table number already exists in this company');
    END IF;
  END IF;
  
  -- Update the table with only provided fields
  UPDATE tables 
  SET 
    table_number = COALESCE(p_table_number, table_number),
    table_name = COALESCE(p_table_name, table_name),
    seats = COALESCE(p_seats, seats),
    location = COALESCE(p_location, location),
    status = COALESCE(p_status, status),
    shape = COALESCE(p_shape, shape),
    type = COALESCE(p_type, type),
    accessibility_friendly = COALESCE(p_accessibility_friendly, accessibility_friendly),
    description = COALESCE(p_description, description),
    is_active = COALESCE(p_is_active, is_active),
    can_combine = COALESCE(p_can_combine, can_combine),
    max_combine_size = COALESCE(p_max_combine_size, max_combine_size),
    group_priority = COALESCE(p_group_priority, group_priority),
    features = COALESCE(p_features, features),
    vip_status = COALESCE(p_vip_status, vip_status),
    window_seating = COALESCE(p_window_seating, window_seating),
    privacy_level = COALESCE(p_privacy_level, privacy_level),
    ambiance = COALESCE(p_ambiance, ambiance),
    is_high_top = COALESCE(p_is_high_top, is_high_top),
    is_main_dining = COALESCE(p_is_main_dining, is_main_dining),
    is_outdoor = COALESCE(p_is_outdoor, is_outdoor),
    is_quiet_area = COALESCE(p_is_quiet_area, is_quiet_area),
    is_family_friendly = COALESCE(p_is_family_friendly, is_family_friendly),
    is_business_friendly = COALESCE(p_is_business_friendly, is_business_friendly),
    service_status = COALESCE(p_service_status, service_status),
    floor_level = COALESCE(p_floor_level, floor_level)
  WHERE id = p_table_id AND company_id = v_company_id
  RETURNING * INTO v_updated_table;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Table updated successfully',
    'table', row_to_json(v_updated_table)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;