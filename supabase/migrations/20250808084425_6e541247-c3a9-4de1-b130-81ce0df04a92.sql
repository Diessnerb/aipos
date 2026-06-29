-- Create auth user for dec@dec.com



INSERT INTO auth.users (id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  created_at, 
  updated_at, 
  raw_user_meta_data
) VALUES (gen_random_uuid(), 
  'dec@dec.com',
  crypt('declan21', gen_salt('bf')),
  now(),
  now(),
  now(),
  json_build_object('full_name', 'Dec', 'role', 'admin')
) 
ON CONFLICT (email) WHERE (is_sso_user = false) DO UPDATE SET
  encrypted_password = crypt('declan21', gen_salt('bf')),
  updated_at = now();

-- Injected unique constraint for ON CONFLICT by repair script
-- Delete duplicate rows before adding constraint to avoid unique violation
DELETE FROM public.users a USING public.users b WHERE a.ctid < b.ctid AND a.auth_user_id = b.auth_user_id;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uniq_users_auth_user_id;
ALTER TABLE public.users ADD CONSTRAINT uniq_users_auth_user_id UNIQUE (auth_user_id);

WITH auth_user AS (
  SELECT id FROM auth.users WHERE email = 'dec@dec.com'
)

INSERT INTO public.users (
  auth_user_id,
  email,
  full_name,
  role,
  company_id,
  is_company_admin
) 
SELECT 
  au.id,
  'dec@dec.com',
  'Dec',
  'admin',
  'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
  true
FROM auth_user au
ON CONFLICT (auth_user_id) DO UPDATE SET
  email = 'dec@dec.com',
  full_name = 'Dec',
  role = 'admin',
  company_id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid,
  is_company_admin = true;

-- Update company defaults
UPDATE public.companies
SET 
  default_admin_email = 'dec@dec.com',
  default_admin_password = 'declan21',
  updated_at = now()
WHERE id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731'::uuid;