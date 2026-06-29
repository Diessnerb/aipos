-- First, let me check the super_admins table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'super_admins';

-- Remove the foreign key constraint temporarily to allow super admin creation
ALTER TABLE public.super_admins 
DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey;

-- Create a placeholder super admin entry that we can update later

-- Injected unique constraint for ON CONFLICT by repair script
DELETE FROM public.super_admins a USING public.super_admins b WHERE a.ctid < b.ctid AND a.email = b.email;
ALTER TABLE public.super_admins DROP CONSTRAINT IF EXISTS uniq_super_admins_email;
ALTER TABLE public.super_admins ADD CONSTRAINT uniq_super_admins_email UNIQUE (email);

INSERT INTO public.super_admins (
  user_id,
  email,
  full_name
) VALUES (
  gen_random_uuid(),
  'declan@aipos.com',
  'Declan Admin'
) ON CONFLICT (email) DO NOTHING;

-- Create a simple function to update super admin user_id when auth user is created
CREATE OR REPLACE FUNCTION public.update_super_admin_user_id(
  admin_email text,
  auth_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.super_admins
  SET user_id = auth_user_id
  WHERE email = admin_email;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Super admin user_id updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;