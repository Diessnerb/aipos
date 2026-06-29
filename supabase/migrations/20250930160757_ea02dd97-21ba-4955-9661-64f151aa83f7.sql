-- Fix adjust_reservation_tables_for_capacity function to use correct column names
CREATE OR REPLACE FUNCTION public.adjust_reservation_tables_for_capacity(
  p_reservation_id uuid,
  p_company_id uuid,
  p_date date,
  p_time time,
  p_party_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_tables integer[];
  v_suggested jsonb;
  v_result jsonb;
BEGIN
  -- Get current table assignment
  SELECT table_numbers INTO v_current_tables
  FROM reservations
  WHERE id = p_reservation_id;

  -- If tables already assigned and sufficient, return current
  IF v_current_tables IS NOT NULL AND array_length(v_current_tables, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'tables', v_current_tables,
      'reason', 'existing_assignment'
    );
  END IF;

  -- Get suggestion from smart assignment
  SELECT jsonb_build_object(
    'selected_tables', s.selected_tables,
    'total_capacity', s.total_capacity,
    'reason', s.reason
  ) INTO v_suggested
  FROM select_contiguous_group_tables(
    p_company_id,
    p_date,
    p_time,
    p_party_size,
    p_reservation_id
  ) s
  LIMIT 1;

  -- Return the suggestion
  IF v_suggested IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'tables', (v_suggested->>'selected_tables')::integer[],
      'capacity', (v_suggested->>'total_capacity')::integer,
      'reason', v_suggested->>'reason'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_suitable_tables'
    );
  END IF;
END;
$function$;