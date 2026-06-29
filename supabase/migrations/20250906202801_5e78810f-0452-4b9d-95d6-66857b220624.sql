-- Harden company_settings table with proper defaults and constraints
ALTER TABLE public.company_settings 
ALTER COLUMN auto_assign_tables SET NOT NULL,
ALTER COLUMN auto_assign_tables SET DEFAULT false,
ALTER COLUMN optimization_enabled SET NOT NULL,
ALTER COLUMN optimization_enabled SET DEFAULT false,
ALTER COLUMN optimization_mode SET DEFAULT 'disabled';

-- Ensure existing rows have proper defaults
UPDATE public.company_settings 
SET auto_assign_tables = COALESCE(auto_assign_tables, false),
    optimization_enabled = COALESCE(optimization_enabled, false),
    optimization_mode = COALESCE(optimization_mode, 'disabled');

-- Add unique constraint on company_id if it doesn't exist
DO $$ BEGIN
    ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_unique UNIQUE (company_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Create secure RPC function for owner PIN updates
CREATE OR REPLACE FUNCTION public.update_company_assignment_settings_by_owner(
    p_company_id uuid,
    p_owner_pin text,
    p_auto_assign boolean,
    p_optimization_enabled boolean,
    p_optimization_mode text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stored_pin text;
    v_computed_mode text;
BEGIN
    -- Verify owner PIN
    SELECT owner_pin INTO v_stored_pin
    FROM public.companies
    WHERE id = p_company_id AND status = 'active';
    
    IF v_stored_pin IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Company not found');
    END IF;
    
    -- Check PIN (plain text or MD5 hash)
    IF v_stored_pin != p_owner_pin AND v_stored_pin != public.hash_pin_md5(p_owner_pin) THEN
        RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;
    
    -- Compute optimization_mode based on toggle states
    IF p_optimization_mode IS NULL THEN
        IF p_auto_assign = true OR p_optimization_enabled = true THEN
            v_computed_mode := 'continuous';
        ELSE
            v_computed_mode := 'disabled';
        END IF;
    ELSE
        v_computed_mode := p_optimization_mode;
    END IF;
    
    -- Set bypass flag for company isolation trigger
    PERFORM set_config('app.owner_pin_authorized', 'true', true);
    
    -- Upsert company settings
    INSERT INTO public.company_settings (
        company_id,
        auto_assign_tables,
        optimization_enabled,
        optimization_mode,
        updated_at
    ) VALUES (
        p_company_id,
        p_auto_assign,
        p_optimization_enabled,
        v_computed_mode,
        now()
    )
    ON CONFLICT (company_id)
    DO UPDATE SET
        auto_assign_tables = EXCLUDED.auto_assign_tables,
        optimization_enabled = EXCLUDED.optimization_enabled,
        optimization_mode = EXCLUDED.optimization_mode,
        updated_at = now();
    
    -- Reset bypass flag
    PERFORM set_config('app.owner_pin_authorized', NULL, true);
    
    RETURN json_build_object(
        'success', true,
        'message', 'Settings updated successfully',
        'settings', json_build_object(
            'auto_assign_tables', p_auto_assign,
            'optimization_enabled', p_optimization_enabled,
            'optimization_mode', v_computed_mode
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Reset bypass flag on error
    PERFORM set_config('app.owner_pin_authorized', NULL, true);
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_company_assignment_settings_by_owner(uuid, text, boolean, boolean, text) TO anon, authenticated;

-- Update validate_company_isolation trigger to allow bypass
CREATE OR REPLACE FUNCTION public.validate_company_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
  is_authorized_bypass boolean;
BEGIN
  -- Check for authorized bypass (from trusted functions)
  is_authorized_bypass := COALESCE(current_setting('app.owner_pin_authorized', true)::boolean, false);
  
  IF is_authorized_bypass THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
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
      INSERT INTO public.security_audit_log (user_id, action, resource_type, resource_id, details)
      VALUES (
        auth.uid(),
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
      INSERT INTO public.security_audit_log (user_id, action, resource_type, resource_id, details)
      VALUES (
        auth.uid(),
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
$$;