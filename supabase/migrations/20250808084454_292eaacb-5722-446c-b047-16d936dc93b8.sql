-- First, delete any existing user with this email to avoid conflicts
DELETE FROM public.users WHERE email = 'dec@dec.com';
DELETE FROM auth.users WHERE email = 'dec@dec.com';

-- Create auth user for dec@dec.com
INSERT INTO auth.users (
  id,
  email, 
  encrypted_password, 
  email_confirmed_at, 
  created_at, 
  updated_at, 
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'dec@dec.com',
  crypt('declan21', gen_salt('bf')),
  now(),
  now(),
  now(),
  json_build_object('full_name', 'Dec', 'role', 'admin')
);

-- Create public user record using the auth user ID
INSERT INTO public.users (
  auth_user_id,
  email,
  full_name,
  role,
  company_id,
  is_company_admin
) 
SELECT 
  id,
  'dec@dec.com',
  'Dec',
  'admin',
  'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
  true
FROM auth.users 
WHERE email = 'dec@dec.com';

-- Update company defaults
UPDATE public.companies
SET 
  default_admin_email = 'dec@dec.com',
  default_admin_password = 'declan21',
  updated_at = now()
WHERE id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;