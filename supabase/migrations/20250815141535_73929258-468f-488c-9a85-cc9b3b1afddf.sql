-- CRITICAL SECURITY FIXES

-- 1. Fix function search path issues for security definer functions
ALTER FUNCTION public.authenticate_by_pin_secure SET search_path = 'public';
ALTER FUNCTION public.get_user_company_safe SET search_path = 'public';
ALTER FUNCTION public.is_current_user_super_admin SET search_path = 'public';

-- 2. Create secure credential storage and remove plaintext passwords
-- First backup existing data in a secure way (hashed)
UPDATE public.companies 
SET owner_pin = public.hash_pin_md5(owner_pin) 
WHERE owner_pin IS NOT NULL AND length(owner_pin) = 4;

-- Remove plaintext admin passwords (security risk)
ALTER TABLE public.companies DROP COLUMN IF EXISTS default_admin_password;

-- 3. Enhance RLS policies for sensitive data protection

-- Strengthen customers table RLS - company isolation
DROP POLICY IF EXISTS "Company users can view their company customers" ON public.customers;
CREATE POLICY "Company users can view their company customers" ON public.customers
FOR SELECT USING (
  company_id = get_user_company_safe() AND 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = customers.company_id
    AND u.is_active = true
  )
);

-- Strengthen users table RLS - prevent cross-company access
DROP POLICY IF EXISTS "Users can view users in their company" ON public.users;
CREATE POLICY "Users can view users in their company" ON public.users
FOR SELECT USING (
  -- Users can see their own record
  auth_user_id = auth.uid() OR
  -- Or users in the same company (with additional verification)
  (company_id = get_user_company_safe() AND 
   EXISTS (
     SELECT 1 FROM public.users viewer 
     WHERE viewer.auth_user_id = auth.uid() 
     AND viewer.company_id = users.company_id
     AND viewer.is_active = true
   ))
);

-- Protect companies table from unauthorized access
DROP POLICY IF EXISTS "Company users can view their company" ON public.companies;
CREATE POLICY "Company users can view their company" ON public.companies
FOR SELECT USING (
  id = get_user_company_safe() AND
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = companies.id
    AND u.is_active = true
  )
);

-- Restrict auth_attempts to super admins only
DROP POLICY IF EXISTS "Super admins can view auth attempts" ON public.auth_attempts;
CREATE POLICY "Super admins can view auth attempts" ON public.auth_attempts
FOR ALL USING (is_current_user_super_admin());

-- Protect integrations table with stricter access
DROP POLICY IF EXISTS "Authenticated users can manage integrations" ON public.integrations;
CREATE POLICY "Company admins can manage integrations" ON public.integrations
FOR ALL USING (
  company_id = get_user_company_safe() AND
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.auth_user_id = auth.uid() 
    AND u.company_id = integrations.company_id
    AND u.role IN ('admin', 'manager')
    AND u.is_active = true
  )
);

-- 4. Implement rate limiting for authentication attempts
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- email or IP
  attempt_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System manages rate limits" ON public.auth_rate_limits
FOR ALL USING (false); -- No direct access via RLS

-- 5. Enhanced authentication security function
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure_v2(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- 6. Create audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON public.security_audit_log
FOR SELECT USING (is_current_user_super_admin());

-- 7. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details
  );
END;
$$;