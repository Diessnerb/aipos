-- Create super admin account for declan@aipos.com
DO $$
DECLARE
  auth_user_id uuid;
  admin_email text := 'declan@aipos.com';
  admin_password text := 'AdminPass123!';
  admin_full_name text := 'Declan Admin';
BEGIN
  -- Create auth user
  INSERT INTO auth.users (id, 
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (gen_random_uuid(), 
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    json_build_object('full_name', admin_full_name)
  ) RETURNING id INTO auth_user_id;
  
  -- Add to super_admins table
  INSERT INTO public.super_admins (
    user_id,
    email,
    full_name
  ) VALUES (
    auth_user_id,
    admin_email,
    admin_full_name
  );
  
  RAISE NOTICE 'Super admin created successfully with email: % and password: %', admin_email, admin_password;
END $$;