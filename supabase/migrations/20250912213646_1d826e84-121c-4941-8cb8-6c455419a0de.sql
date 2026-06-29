-- Create immediate table assignment trigger for new reservations
-- This will fire automatically when reservations are created or updated

-- First, create a function to trigger immediate assignment via edge function
CREATE OR REPLACE FUNCTION public.trigger_immediate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_optimization_enabled boolean;
  v_auto_assign_tables boolean;
BEGIN
  -- Get company settings
  SELECT company_id INTO v_company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  
  -- If we can't determine company from auth context, use the reservation's company_id
  IF v_company_id IS NULL THEN
    v_company_id := NEW.company_id;
  END IF;
  
  -- Check if optimization/auto-assignment is enabled for this company
  SELECT 
    COALESCE(optimization_enabled, false),
    COALESCE(auto_assign_tables, false)
  INTO 
    v_optimization_enabled,
    v_auto_assign_tables
  FROM public.company_settings 
  WHERE company_id = v_company_id;
  
  -- Only trigger if auto-assignment or optimization is enabled
  IF v_optimization_enabled OR v_auto_assign_tables THEN
    -- Log the trigger event
    RAISE LOG 'Immediate assignment triggered for reservation % in company %', NEW.id, v_company_id;
    
    -- Use pg_notify to trigger the edge function asynchronously
    -- This prevents the trigger from blocking the reservation creation
    PERFORM pg_notify(
      'reservation_created',
      json_build_object(
        'reservation_id', NEW.id,
        'company_id', v_company_id,
        'customer_name', NEW.customer_name,
        'party_size', NEW.party_size,
        'date', NEW.date,
        'time', NEW.time,
        'action', CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT (new reservations)
DROP TRIGGER IF EXISTS trigger_immediate_assignment_insert ON public.reservations;
CREATE TRIGGER trigger_immediate_assignment_insert
  AFTER INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_immediate_assignment();

-- Create trigger for UPDATE (when reservations are modified)
DROP TRIGGER IF EXISTS trigger_immediate_assignment_update ON public.reservations;
CREATE TRIGGER trigger_immediate_assignment_update
  AFTER UPDATE ON public.reservations
  FOR EACH ROW
  WHEN (
    -- Only trigger when relevant fields change
    OLD.party_size IS DISTINCT FROM NEW.party_size OR
    OLD.date IS DISTINCT FROM NEW.date OR
    OLD.time IS DISTINCT FROM NEW.time OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.notes IS DISTINCT FROM NEW.notes
  )
  EXECUTE FUNCTION public.trigger_immediate_assignment();

-- Create function to manually trigger optimization for a company
CREATE OR REPLACE FUNCTION public.trigger_manual_optimization(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_company_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get user's company and admin status
  SELECT u.company_id, (u.role = 'admin' OR u.is_company_admin)
  INTO v_user_company_id, v_is_admin
  FROM public.users u 
  WHERE u.auth_user_id = auth.uid();
  
  -- Check authorization
  IF v_user_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Access denied to company');
  END IF;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;
  
  -- Trigger optimization via notification
  PERFORM pg_notify(
    'manual_optimization',
    json_build_object(
      'company_id', p_company_id,
      'triggered_by', auth.uid(),
      'action', 'manual_optimize_all'
    )::text
  );
  
  RETURN json_build_object('success', true, 'message', 'Optimization triggered');
END;
$$;