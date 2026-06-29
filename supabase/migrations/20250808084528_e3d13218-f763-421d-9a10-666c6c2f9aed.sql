-- Update the existing auth user password
UPDATE auth.users 
SET encrypted_password = crypt('declan21', gen_salt('bf')),
    updated_at = now(),
    email_confirmed_at = now()
WHERE email = 'dec@dec.com';

-- Update the existing public user record
UPDATE public.users 
SET full_name = 'Dec',
    role = 'admin',
    company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
    is_company_admin = true
WHERE email = 'dec@dec.com';

-- Update company defaults
UPDATE public.companies
SET 
  default_admin_email = 'dec@dec.com',
  default_admin_password = 'declan21',
  updated_at = now()
WHERE id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;