-- SECURITY FIX PHASE 2: Address remaining RLS and function security issues

-- 1. FIX TABLES WITH RLS ENABLED BUT NO POLICIES
-- These tables currently have RLS enabled but no policies, blocking all access

-- Fix menu_item_ingredients table
CREATE POLICY "Company users can view company menu item ingredients" 
ON public.menu_item_ingredients 
FOR SELECT 
USING (
  menu_item_id IN (
    SELECT mi.id 
    FROM public.menu_items mi 
    WHERE mi.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Company admins can manage company menu item ingredients" 
ON public.menu_item_ingredients 
FOR ALL 
USING (
  menu_item_id IN (
    SELECT mi.id 
    FROM public.menu_items mi 
    WHERE mi.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid() 
      AND (u.role = 'admin' OR u.is_company_admin = true)
    )
  )
);

-- Fix off_reasons table
CREATE POLICY "Users can view their own off reasons" 
ON public.off_reasons 
FOR SELECT 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can view all company off reasons" 
ON public.off_reasons 
FOR SELECT 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid() 
      AND (u2.role = 'admin' OR u2.is_company_admin = true)
    )
  )
);

CREATE POLICY "Users can manage their own off reasons" 
ON public.off_reasons 
FOR ALL 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Fix shift_approval_requests table
CREATE POLICY "Users can view shift requests they're involved in" 
ON public.shift_approval_requests 
FOR SELECT 
USING (
  requester_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  OR reviewed_by_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can view all shift approval requests" 
ON public.shift_approval_requests 
FOR SELECT 
USING (
  requester_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid() 
      AND (u2.role = 'admin' OR u2.is_company_admin = true)
    )
  )
);

CREATE POLICY "Users can create shift approval requests" 
ON public.shift_approval_requests 
FOR INSERT 
WITH CHECK (
  requester_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can manage shift approval requests" 
ON public.shift_approval_requests 
FOR ALL 
USING (
  requester_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid() 
      AND (u2.role = 'admin' OR u2.is_company_admin = true)
    )
  )
);

-- Fix shift_swap_requests table
CREATE POLICY "Users can view shift swaps they're involved in" 
ON public.shift_swap_requests 
FOR SELECT 
USING (
  original_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  OR requested_by_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  OR accepted_by_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can view all shift swap requests" 
ON public.shift_swap_requests 
FOR SELECT 
USING (
  original_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid() 
      AND (u2.role = 'admin' OR u2.is_company_admin = true)
    )
  )
);

CREATE POLICY "Users can manage their own shift swap requests" 
ON public.shift_swap_requests 
FOR ALL 
USING (
  original_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
  OR requested_by_user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Fix shift_logs table
CREATE POLICY "Users can view their own shift logs" 
ON public.shift_logs 
FOR SELECT 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Company admins can view all company shift logs" 
ON public.shift_logs 
FOR SELECT 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.company_id IN (
      SELECT u2.company_id 
      FROM public.users u2 
      WHERE u2.auth_user_id = auth.uid() 
      AND (u2.role = 'admin' OR u2.is_company_admin = true)
    )
  )
);

CREATE POLICY "Users can manage their own shift logs" 
ON public.shift_logs 
FOR ALL 
USING (
  user_id IN (
    SELECT u.id 
    FROM public.users u 
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Fix supplier_order_items table (corrected - no supplier_orders table)
CREATE POLICY "Company users can view supplier order items" 
ON public.supplier_order_items 
FOR SELECT 
USING (
  ingredient_id IN (
    SELECT i.id 
    FROM public.inventory i 
    WHERE i.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Company users can manage supplier order items" 
ON public.supplier_order_items 
FOR ALL 
USING (
  ingredient_id IN (
    SELECT i.id 
    FROM public.inventory i 
    WHERE i.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  )
);

-- 2. FIX REMAINING FUNCTIONS WITH MUTABLE SEARCH PATHS
-- Update all remaining functions to have proper search_path

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
$$;

-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.generate_unique_pin(p_company_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pin text;
  pin_exists boolean;
BEGIN
  LOOP
    -- Generate a random 4-digit PIN
    new_pin := LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if PIN already exists within the company (not globally)
    IF p_company_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.users 
        WHERE pin_code = new_pin AND company_id = p_company_id
      ) INTO pin_exists;
    ELSE
      -- Fallback to global check if no company specified
      SELECT EXISTS(SELECT 1 FROM public.users WHERE pin_code = new_pin) INTO pin_exists;
    END IF;
    
    -- If PIN doesn't exist within the company, return it
    IF NOT pin_exists THEN
      RETURN new_pin;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_pin_md5(pin_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use md5 with salt for now (better than plaintext)
  RETURN md5(pin_text || 'pin_salt_2025');
END;
$$;

CREATE OR REPLACE FUNCTION public.authenticate_by_pin_for_company(pin_input text, company_id_param uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, company_id uuid, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- First check for regular user PINs within the company
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    false as is_owner
  FROM public.users u
  WHERE u.pin_code = hashed_input
    AND u.company_id = company_id_param
    AND u.is_active = true
  LIMIT 1;

  -- If user found, return immediately
  IF FOUND THEN
    RETURN;
  END IF;

  -- If no user found, check for owner PIN for this company
  RETURN QUERY
  SELECT 
    gen_random_uuid() as user_id, -- Generate temporary ID for owner
    c.default_admin_email as email,
    'Restaurant Owner' as full_name,
    'owner' as role,
    c.id as company_id,
    true as is_owner
  FROM public.companies c
  WHERE c.owner_pin = hashed_input
    AND c.id = company_id_param
    AND c.status = 'active'
  LIMIT 1;
END;
$$;

-- 3. ADD MISSING POLICIES FOR INVENTORY MANAGEMENT
CREATE POLICY "Company users can manage company inventory logs" 
ON public.inventory_logs 
FOR ALL 
USING (
  inventory_item_id IN (
    SELECT i.id 
    FROM public.inventory i 
    WHERE i.company_id IN (
      SELECT u.company_id 
      FROM public.users u 
      WHERE u.auth_user_id = auth.uid()
    )
  )
);

-- 4. LOG SECURITY IMPROVEMENTS
INSERT INTO public.security_audit_log (action, resource_type, details)
VALUES ('SECURITY_FIX_PHASE_2', 'SYSTEM', json_build_object(
  'description', 'Fixed remaining RLS policies and function security',
  'timestamp', now(),
  'fixed_tables', ARRAY[
    'menu_item_ingredients', 'off_reasons', 'shift_approval_requests', 
    'shift_swap_requests', 'shift_logs', 'supplier_order_items', 'inventory_logs'
  ],
  'fixed_functions', ARRAY[
    'is_super_admin', 'is_current_user_super_admin', 'generate_unique_pin',
    'hash_pin_md5', 'authenticate_by_pin_for_company'
  ]
));