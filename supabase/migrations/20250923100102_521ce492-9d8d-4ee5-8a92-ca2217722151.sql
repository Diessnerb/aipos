-- Update secure_table_update to support position fields and floor level
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
  p_floor_level integer DEFAULT NULL,
  p_x_position integer DEFAULT NULL,
  p_y_position integer DEFAULT NULL,
  p_rotation integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_table_exists boolean;
  v_duplicate_number boolean;
  v_updated_table record;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO v_company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or no company association');
  END IF;
  
  -- Check if table exists and belongs to user's company
  SELECT EXISTS(
    SELECT 1 FROM public.tables 
    WHERE id = p_table_id AND company_id = v_company_id
  ) INTO v_table_exists;
  
  IF NOT v_table_exists THEN
    RETURN json_build_object('success', false, 'error', 'Table not found or access denied');
  END IF;
  
  -- Check for duplicate table number (if updating table_number)
  IF p_table_number IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.tables 
      WHERE table_number = p_table_number 
        AND company_id = v_company_id 
        AND id != p_table_id
    ) INTO v_duplicate_number;
    
    IF v_duplicate_number THEN
      RETURN json_build_object('success', false, 'error', 'Table number already exists in this company');
    END IF;
  END IF;
  
  -- Update the table with only provided fields (including position and floor level)
  UPDATE public.tables 
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
    floor_level = COALESCE(p_floor_level, floor_level),
    x_position = COALESCE(p_x_position, x_position),
    y_position = COALESCE(p_y_position, y_position),
    rotation = COALESCE(p_rotation, rotation),
    updated_at = NOW()
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

-- Update/Create secure_table_insert to support position fields and floor level
CREATE OR REPLACE FUNCTION public.secure_table_insert(
  p_table_number integer,
  p_table_name text DEFAULT NULL,
  p_seats integer DEFAULT NULL,
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
  p_floor_level integer DEFAULT 1,
  p_x_position integer DEFAULT NULL,
  p_y_position integer DEFAULT NULL,
  p_rotation integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_duplicate_number boolean;
  v_new_table record;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO v_company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or no company association');
  END IF;

  -- Ensure table number is unique within company
  SELECT EXISTS(
    SELECT 1 FROM public.tables
    WHERE company_id = v_company_id
      AND table_number = p_table_number
  ) INTO v_duplicate_number;

  IF v_duplicate_number THEN
    RETURN json_build_object('success', false, 'error', 'Table number already exists in this company');
  END IF;

  -- Insert the new table with provided fields
  INSERT INTO public.tables (
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
    floor_level,
    x_position,
    y_position,
    rotation
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
    p_floor_level,
    p_x_position,
    p_y_position,
    p_rotation
  )
  RETURNING * INTO v_new_table;

  RETURN json_build_object(
    'success', true,
    'message', 'Table created successfully',
    'table', row_to_json(v_new_table)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;