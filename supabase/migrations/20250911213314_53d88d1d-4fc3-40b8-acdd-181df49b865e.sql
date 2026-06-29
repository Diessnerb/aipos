-- RPC Functions for Visual Seat Mapping System

-- Function to save table seat positions
CREATE OR REPLACE FUNCTION public.save_table_seat_positions(
  p_table_id uuid,
  p_seat_positions jsonb,
  p_company_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow users from the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = p_company_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Update or insert seat positions for the table
  INSERT INTO public.table_seat_positions (table_id, company_id, seat_positions, updated_at)
  VALUES (p_table_id, p_company_id, p_seat_positions, now())
  ON CONFLICT (table_id, company_id)
  DO UPDATE SET 
    seat_positions = EXCLUDED.seat_positions,
    updated_at = now();

  RETURN json_build_object('success', true, 'message', 'Seat positions saved successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to get table seat positions
CREATE OR REPLACE FUNCTION public.get_table_seat_positions(
  p_table_id uuid,
  p_company_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seat_positions jsonb;
BEGIN
  -- Only allow users from the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = p_company_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get seat positions for the table
  SELECT tsp.seat_positions INTO v_seat_positions
  FROM public.table_seat_positions tsp
  WHERE tsp.table_id = p_table_id 
  AND tsp.company_id = p_company_id;

  RETURN json_build_object(
    'success', true, 
    'seat_positions', COALESCE(v_seat_positions, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to calculate group capacity scenarios
CREATE OR REPLACE FUNCTION public.calculate_group_capacity_scenarios(
  p_group_id uuid,
  p_company_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tables RECORD;
  v_scenario jsonb;
  v_scenarios jsonb[] := '{}';
  v_combination_size integer;
  v_total_seats integer;
  v_lost_seats integer;
  v_efficiency_score numeric;
BEGIN
  -- Only allow users from the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = p_company_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get all tables in the group
  FOR v_tables IN
    SELECT t.id, t.table_number, t.seats, t.can_combine
    FROM public.tables t
    JOIN public.table_group_memberships tgm ON t.id = tgm.table_id
    WHERE tgm.group_id = p_group_id
    AND t.company_id = p_company_id
    AND t.is_active = true
    AND t.can_combine = true
    ORDER BY tgm.priority_order
  LOOP
    -- For now, create a basic scenario for each table combination
    -- This is a simplified version - in reality you'd generate all combinations
    v_total_seats := v_tables.seats;
    v_lost_seats := 0; -- Will be calculated based on actual seat positions later
    v_efficiency_score := (v_total_seats - v_lost_seats)::numeric / v_total_seats * 100;
    
    v_scenario := json_build_object(
      'table_combination', json_build_array(v_tables.table_number),
      'total_seats', v_total_seats,
      'lost_seats', v_lost_seats,
      'efficiency_score', v_efficiency_score,
      'recommended_party_sizes', json_build_array(v_total_seats - 2, v_total_seats)
    );
    
    v_scenarios := array_append(v_scenarios, v_scenario);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'scenarios', array_to_json(v_scenarios)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to save group table arrangement
CREATE OR REPLACE FUNCTION public.save_group_arrangement(
  p_group_id uuid,
  p_company_id uuid,
  p_arrangement jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow users from the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = p_company_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Update the table group with the new arrangement
  UPDATE public.table_groups 
  SET advanced_settings = jsonb_set(
    COALESCE(advanced_settings, '{}'::jsonb),
    '{visual_arrangement}',
    p_arrangement
  ),
  updated_at = now()
  WHERE id = p_group_id 
  AND company_id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Arrangement saved successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create table for storing seat positions if it doesn't exist
CREATE TABLE IF NOT EXISTS public.table_seat_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL,
  company_id uuid NOT NULL,
  seat_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(table_id, company_id)
);

-- Enable RLS on table_seat_positions
ALTER TABLE public.table_seat_positions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for table_seat_positions
DROP POLICY IF EXISTS "table_seat_positions_company_isolation" ON public.table_seat_positions;
CREATE POLICY "table_seat_positions_company_isolation" ON public.table_seat_positions 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));