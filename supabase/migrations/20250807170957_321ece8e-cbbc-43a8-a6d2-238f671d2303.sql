-- First, let's see what's currently in the super_admins table
SELECT * FROM public.super_admins;

-- Clean up - remove any existing super admin records
DELETE FROM public.super_admins;

-- Get the auth user ID for declan@aipos.com
DO $$
DECLARE
  declan_auth_id uuid;
BEGIN
  -- Get the auth user ID for declan@aipos.com
  SELECT id INTO declan_auth_id 
  FROM auth.users 
  WHERE email = 'declan@aipos.com';
  
  IF declan_auth_id IS NOT NULL THEN
    -- Insert the correct super admin record
    INSERT INTO public.super_admins (
      user_id,
      email,
      full_name
    ) VALUES (
      declan_auth_id,
      'declan@aipos.com',
      'Declan Admin'
    );
    
    RAISE NOTICE 'Super admin created for declan@aipos.com with user_id: %', declan_auth_id;
  ELSE
    RAISE NOTICE 'No auth user found for declan@aipos.com';
  END IF;
END $$;

-- Verify the result
SELECT sa.*, au.email as auth_email 
FROM public.super_admins sa
LEFT JOIN auth.users au ON sa.user_id = au.id;