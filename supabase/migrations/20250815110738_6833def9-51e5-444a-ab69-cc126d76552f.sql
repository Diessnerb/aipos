-- PHASE 1: EMERGENCY CREDENTIAL PROTECTION - Fix constraint issues first

-- 1. Remove PIN format constraint temporarily to allow hashing
ALTER TABLE users DROP CONSTRAINT IF EXISTS pin_code_format;

-- 2. Remove the overly permissive company policy that exposes passwords/PINs
DROP POLICY IF EXISTS "Authenticated users can find company by admin email during logi" ON companies;

-- 3. Create a secure company lookup function that only returns safe data
CREATE OR REPLACE FUNCTION public.find_company_by_admin_email(admin_email text)
RETURNS TABLE(id uuid, name text, subdomain text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.subdomain, c.status
  FROM companies c
  WHERE c.default_admin_email = admin_email
    AND c.status = 'active';
END;
$$;

-- 4. Create new secure RLS policy for company access (basic info only)
DROP POLICY IF EXISTS "Users can find company by admin email securely" ON public.companies;
CREATE POLICY "Users can find company by admin email securely" ON public.companies 
FOR SELECT 
USING (
  -- Only allow access to basic company info when email matches
  default_admin_email IS NOT NULL 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = auth.uid() 
    AND au.email = companies.default_admin_email
  )
);

-- 5. Hash existing plaintext passwords using md5 (temporary solution)
CREATE OR REPLACE FUNCTION public.hash_password_md5(password_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use md5 with salt for now (better than plaintext)
  RETURN md5(password_text || 'salt_2025');
END;
$$;

-- 6. Update existing plaintext passwords to hashed versions
UPDATE companies 
SET default_admin_password = public.hash_password_md5(default_admin_password)
WHERE default_admin_password IS NOT NULL 
  AND default_admin_password NOT LIKE 'md5_%' 
  AND length(default_admin_password) < 32; -- Only hash if not already hashed

-- 7. Hash existing PINs using md5
CREATE OR REPLACE FUNCTION public.hash_pin_md5(pin_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use md5 with salt for now (better than plaintext)
  RETURN md5(pin_text || 'pin_salt_2025');
END;
$$;

-- 8. Update user PINs to hashed versions
UPDATE users 
SET pin_code = public.hash_pin_md5(pin_code)
WHERE pin_code IS NOT NULL 
  AND pin_code NOT LIKE 'md5_%'
  AND length(pin_code) = 4; -- Only hash if looks like original PIN

-- 9. Update owner PINs to hashed versions
UPDATE companies 
SET owner_pin = public.hash_pin_md5(owner_pin)
WHERE owner_pin IS NOT NULL 
  AND owner_pin NOT LIKE 'md5_%'
  AND length(owner_pin) = 4; -- Only hash if looks like original PIN

-- 10. Create secure PIN authentication function
CREATE OR REPLACE FUNCTION public.authenticate_by_pin_secure(pin_input text)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hashed_input text;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^[0-9]{4}$' THEN
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

  -- If no user found, check for owner PIN using hashed comparison
  IF NOT FOUND THEN
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
  END IF;
END;
$$;

-- PHASE 2: DATA ACCESS CONTROL

-- 11. Remove public access policies for menu items and categories
DROP POLICY IF EXISTS "All users can view menu items" ON menu_items;
DROP POLICY IF EXISTS "All users can view menu categories" ON menu_categories;

-- 12. Create company-scoped menu access policies
DROP POLICY IF EXISTS "Company users can view their company menu items" ON public.menu_items;
CREATE POLICY "Company users can view their company menu items" ON public.menu_items 
FOR SELECT 
USING (company_id = get_user_company_safe());

DROP POLICY IF EXISTS "Company users can view their company menu categories" ON public.menu_categories;
CREATE POLICY "Company users can view their company menu categories" ON public.menu_categories 
FOR SELECT 
USING (company_id = get_user_company_safe());

-- 13. Create authentication attempt logging table
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  pin_used text, -- Store only the length for security
  success boolean DEFAULT false,
  ip_address text,
  user_agent text,
  attempted_at timestamp with time zone DEFAULT now(),
  company_id uuid
);

-- Enable RLS on auth_attempts
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view auth attempts
DROP POLICY IF EXISTS "Super admins can view auth attempts" ON public.auth_attempts;
CREATE POLICY "Super admins can view auth attempts" ON public.auth_attempts 
FOR SELECT 
USING (is_super_admin());

-- 14. Create rate limiting function for PIN authentication
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(identifier text, max_attempts integer DEFAULT 5, window_minutes integer DEFAULT 15)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  attempt_count integer;
BEGIN
  -- Count failed attempts in the time window
  SELECT COUNT(*) INTO attempt_count
  FROM auth_attempts
  WHERE (email = identifier OR pin_used = length(identifier)::text)
    AND success = false
    AND attempted_at > (now() - (window_minutes || ' minutes')::interval);
  
  -- Return false if rate limit exceeded
  IF attempt_count >= max_attempts THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;