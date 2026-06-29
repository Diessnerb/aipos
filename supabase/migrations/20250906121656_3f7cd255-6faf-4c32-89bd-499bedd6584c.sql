
-- Injected missing column by repair script
ALTER TABLE IF EXISTS public.operations ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.another ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.auth_attempts ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE IF EXISTS public.functions ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.the ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE IF EXISTS public.owner ADD COLUMN IF NOT EXISTS company_id TEXT;
ALTER TABLE public.security_audit_log ADD COLUMN IF NOT EXISTS company_id UUID;
-- Phase 1: Fix database function search_path security issues
-- Update functions to have proper search_path settings

-- Fix authenticate_by_pin_secure_v2 function
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure_v2(pin_input text)
 RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hashed_input text;
  attempt_count integer;
  rate_limit_key text;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
    RETURN;
  END IF;

  -- Implement rate limiting
  rate_limit_key := 'pin_' || pin_input;
  
  -- Check recent failed attempts
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE pin_used = pin_input
    AND success = false
    AND attempted_at > (now() - interval '15 minutes');
  
  -- Block if too many attempts
  IF attempt_count >= 5 THEN
    -- Log the blocked attempt
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, false, now());
    RETURN;
  END IF;

  -- Hash the input PIN for comparison
  hashed_input := md5(pin_input || 'pin_salt_2025');

  -- First check for regular user PINs using hashed comparison
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  FROM users u
  WHERE u.pin_code = hashed_input
    AND u.is_active = true
  LIMIT 1;

  -- If user found, log successful attempt
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, true, now());
    RETURN;
  END IF;

  -- If no user found, check for owner PIN using hashed comparison
  RETURN QUERY
  SELECT 
    gen_random_uuid() as user_id, -- Generate temporary ID for owner
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  FROM companies c
  WHERE c.owner_pin = hashed_input
    AND c.status = 'active'
  LIMIT 1;

  -- Log attempt result
  IF FOUND THEN
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, true, now());
  ELSE
    INSERT INTO auth_attempts (pin_used, success, attempted_at)
    VALUES (pin_input, false, now());
  END IF;
END;
$function$;

-- Fix update_owner_pin_secure function
CREATE OR REPLACE FUNCTION public.update_owner_pin_secure(p_company_id uuid, p_current_pin text, p_new_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stored_pin text;
  v_hashed_current_pin text;
  v_hashed_new_pin text;
  v_current_user_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
BEGIN
  -- Validate PIN formats
  IF p_current_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN must be exactly 4 digits');
  END IF;

  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'New PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_current_user_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Check if user has permission to update owner PIN for this company
  IF v_current_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot update owner PIN for another company');
  END IF;

  IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions to update owner PIN');
  END IF;

  -- Get the stored owner PIN
  SELECT owner_pin INTO v_stored_pin
  FROM public.companies
  WHERE id = p_company_id
  LIMIT 1;

  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No owner PIN is currently set');
  END IF;

  -- Hash the current PIN for comparison
  v_hashed_current_pin := public.hash_pin_md5(p_current_pin);

  -- Verify current PIN (support both hashed and plaintext for migration)
  IF v_stored_pin != v_hashed_current_pin AND v_stored_pin != p_current_pin THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Hash the new PIN
  v_hashed_new_pin := public.hash_pin_md5(p_new_pin);

  -- Update the company's owner PIN
  UPDATE public.companies
  SET owner_pin = v_hashed_new_pin,
      updated_at = now()
  WHERE id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Owner PIN updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Fix set_owner_pin_secure function
CREATE OR REPLACE FUNCTION public.set_owner_pin_secure(p_company_id uuid, p_new_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hashed_pin text;
  v_current_user_company_id uuid;
  v_user_role text;
  v_is_company_admin boolean;
BEGIN
  -- Validate PIN format
  IF p_new_pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Get current user's company and permissions
  SELECT u.company_id, u.role, u.is_company_admin
  INTO v_current_user_company_id, v_user_role, v_is_company_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  -- Check if user has permission to set owner PIN for this company
  IF v_current_user_company_id != p_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot set owner PIN for another company');
  END IF;

  IF NOT (v_user_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions to set owner PIN');
  END IF;

  -- Hash the PIN using the same salt as authentication
  v_hashed_pin := public.hash_pin_md5(p_new_pin);

  -- Update the company's owner PIN
  UPDATE public.companies
  SET owner_pin = v_hashed_pin,
      updated_at = now()
  WHERE id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Owner PIN set successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Phase 3: Add double-layer protection with company isolation triggers
-- Create a company isolation validation trigger for critical tables

CREATE OR REPLACE FUNCTION public.validate_company_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_company_id uuid;
BEGIN
  -- Get the current user's company_id
  SELECT u.company_id INTO user_company_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  -- If no user found or no company, allow super admins or migrations/cron jobs (where auth.uid() is null)
  IF user_company_id IS NULL THEN
    IF public.is_super_admin() OR auth.uid() IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    ELSE
      RAISE EXCEPTION 'Access denied: No company association found';
    END IF;
  END IF;
  
  -- For INSERT/UPDATE operations
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Ensure the record being modified belongs to the user's company
    IF NEW.company_id IS NULL THEN
      NEW.company_id := user_company_id;
    ELSIF NEW.company_id != user_company_id THEN
      -- Log potential security violation
      PERFORM public.log_security_event(
        'company_isolation_violation_attempt',
        TG_TABLE_NAME,
        NEW.id,
        json_build_object(
          'user_company_id', user_company_id,
          'attempted_company_id', NEW.company_id,
          'operation', TG_OP
        )
      );
      RAISE EXCEPTION 'Access denied: Cannot modify records from another company';
    END IF;
    RETURN NEW;
  END IF;
  
  -- For DELETE operations
  IF TG_OP = 'DELETE' THEN
    IF OLD.company_id != user_company_id THEN
      -- Log potential security violation
      PERFORM public.log_security_event(
        'company_isolation_violation_attempt',
        TG_TABLE_NAME,
        OLD.id,
        json_build_object(
          'user_company_id', user_company_id,
          'attempted_company_id', OLD.company_id,
          'operation', TG_OP
        )
      );
      RAISE EXCEPTION 'Access denied: Cannot delete records from another company';
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Apply the company isolation trigger to critical tables
DROP TRIGGER IF EXISTS trigger_company_isolation_reservations ON public.reservations;
CREATE TRIGGER trigger_company_isolation_reservations
  BEFORE INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_isolation();

DROP TRIGGER IF EXISTS trigger_company_isolation_tables ON public.tables;
CREATE TRIGGER trigger_company_isolation_tables
  BEFORE INSERT OR UPDATE OR DELETE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_isolation();

DROP TRIGGER IF EXISTS trigger_company_isolation_optimization_log ON public.optimization_log;
CREATE TRIGGER trigger_company_isolation_optimization_log
  BEFORE INSERT OR UPDATE OR DELETE ON public.optimization_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_isolation();

DROP TRIGGER IF EXISTS trigger_company_isolation_assignment_history ON public.assignment_history;
CREATE TRIGGER trigger_company_isolation_assignment_history
  BEFORE INSERT OR UPDATE OR DELETE ON public.assignment_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_isolation();

-- Phase 4: Enhanced security audit logging
-- Create a more comprehensive security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  company_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins and company admins can view security logs for their company
CREATE POLICY "Security audit log access" ON public.security_audit_log
FOR SELECT USING (
  public.is_super_admin() OR 
  (company_id IN (SELECT allowed_company_ids_for_current_user()))
);

-- Update the log_security_event function to capture more details
CREATE OR REPLACE FUNCTION public.log_security_event(p_action text, p_resource_type text DEFAULT NULL::text, p_resource_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_company_id uuid;
BEGIN
  -- Get user's company ID
  SELECT u.company_id INTO user_company_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    company_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    user_company_id,
    p_details
  );
END;
$function$;