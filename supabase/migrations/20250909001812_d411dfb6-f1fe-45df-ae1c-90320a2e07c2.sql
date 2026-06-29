-- Update the validate_company_isolation function to allow optimization operations
CREATE OR REPLACE FUNCTION validate_company_isolation() 
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_company_id uuid;
  is_optimization boolean;
BEGIN
  -- Check if this is an optimization operation
  is_optimization := current_setting('app.is_optimization', true) = 'true';
  
  -- Skip validation for optimization operations or system migrations/processes (where auth.uid() is null)
  IF is_optimization OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the user's company ID safely
  SELECT company_id INTO user_company_id 
  FROM users 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
  
  -- Allow if user has a company and it matches the record's company
  IF user_company_id IS NOT NULL AND user_company_id = NEW.company_id THEN
    RETURN NEW;
  END IF;
  
  -- Check if user is a super admin
  IF EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  
  -- Check company admin by email match
  IF EXISTS (
    SELECT 1 FROM companies c
    JOIN auth.users au ON c.default_admin_email = au.email
    WHERE c.id = NEW.company_id AND au.id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Deny access
  RAISE EXCEPTION 'Access denied: No company association found';
END;
$$;