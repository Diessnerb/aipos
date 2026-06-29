-- Create function to create super admin
CREATE OR REPLACE FUNCTION public.create_super_admin(
  admin_email text,
  admin_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Insert into super_admins table with a placeholder user_id
  -- The actual user will be created through the Supabase dashboard/API
  INSERT INTO public.super_admins (
    user_id,
    email,
    full_name
  ) VALUES (
    gen_random_uuid(), -- Temporary UUID, will be updated when real user is created
    admin_email,
    admin_full_name
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Super admin placeholder created. Please create auth user through Supabase dashboard.',
    'email', admin_email
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create the super admin placeholder
SELECT public.create_super_admin('declan@aipos.com', 'Declan Admin');