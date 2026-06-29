-- Fix Owner Account: Set PIN 6666 for theloomhelmshore and delete dec account

-- 1. Set PIN 6666 for owner account (theloomhelmshore)
-- Hash for authentication, encrypt for viewing
UPDATE public.users
SET 
  pin_code = md5('6666' || 'salt_2025'),
  pin_code_encrypted = encode(
    encrypt(
      '6666'::bytea,
      'encryption_key_2025'::bytea,
      'aes'
    ),
    'base64'
  )
WHERE email = 'theloomhelmshore@gmail.com'
  AND company_id = '2d5ee0bb-7605-455a-b53a-d0ea1bad3479'
  AND is_owner = true;

-- 2. Update company owner_pin to match
UPDATE public.companies
SET owner_pin = md5('6666' || 'salt_2025')
WHERE id = '2d5ee0bb-7605-455a-b53a-d0ea1bad3479';

-- 3. Delete the dec account (duplicate admin with no auth_user_id)
DELETE FROM public.users
WHERE id = '520d7eb3-0e53-4b3e-b2d7-6a02e5f86e3f'
  AND company_id = '2d5ee0bb-7605-455a-b53a-d0ea1bad3479'
  AND full_name = 'dec'
  AND auth_user_id IS NULL;