-- Add missing columns to tables table and normalize existing data
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS is_main_dining boolean DEFAULT false;

-- Normalize service_status values - set any null values to 'available'
UPDATE public.tables 
SET service_status = 'available' 
WHERE service_status IS NULL;

-- Ensure all boolean feature columns have proper defaults (not null)
UPDATE public.tables 
SET 
  vip_status = COALESCE(vip_status, false),
  window_seating = COALESCE(window_seating, false),
  is_high_top = COALESCE(is_high_top, false),
  is_main_dining = COALESCE(is_main_dining, false),
  is_outdoor = COALESCE(is_outdoor, false),
  is_quiet_area = COALESCE(is_quiet_area, false),
  is_family_friendly = COALESCE(is_family_friendly, false),
  is_business_friendly = COALESCE(is_business_friendly, false),
  accessibility_friendly = COALESCE(accessibility_friendly, false);

-- Add unique constraint on company_id + table_number to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS tables_company_table_number_unique 
ON public.tables(company_id, table_number);

-- Update secure_table_insert function to include is_main_dining parameter
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
  p_service_status text DEFAULT 'available'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_table_exists boolean;
  v_new_table record;
BEGIN
  -- Get user's company ID
  SELECT company_id INTO v_company_id 
  FROM users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found or no company association');
  END IF;
  
  -- Check if table number already exists in this company
  SELECT EXISTS(
    SELECT 1 FROM tables 
    WHERE table_number = p_table_number AND company_id = v_company_id
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RETURN json_build_object('success', false, 'error', 'Table number already exists in this company');
  END IF;
  
  -- Insert the new table
  INSERT INTO tables (
    company_id, table_number, table_name, seats, location, status, shape, type,
    accessibility_friendly, description, is_active, can_combine, max_combine_size,
    group_priority, features, vip_status, window_seating, privacy_level, ambiance,
    is_high_top, is_main_dining, is_outdoor, is_quiet_area, is_family_friendly,
    is_business_friendly, service_status
  ) VALUES (
    v_company_id, p_table_number, COALESCE(p_table_name, 'Table ' || p_table_number::text), 
    p_seats, p_location, p_status, p_shape, p_type, p_accessibility_friendly, p_description,
    p_is_active, p_can_combine, p_max_combine_size, p_group_priority, p_features,
    p_vip_status, p_window_seating, p_privacy_level, p_ambiance, p_is_high_top,
    p_is_main_dining, p_is_outdoor, p_is_quiet_area, p_is_family_friendly,
    p_is_business_friendly, COALESCE(p_service_status, 'available')
  ) RETURNING * INTO v_new_table;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Table created successfully',
    'table', row_to_json(v_new_table)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Table number already exists in this company');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;