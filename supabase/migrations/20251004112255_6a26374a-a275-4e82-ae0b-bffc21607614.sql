-- Fix owner PIN and delete dec account (corrected IDs)

-- 1. Set owner PIN for theloomhelmshore (user_id: 4e0ba28e-1a81-424f-9116-630f404084d6)
UPDATE public.users
SET 
  pin_code = '4693a73e3ec0d8c1595b0404ba52f545', -- MD5 hash of 6666
  pin_code_encrypted = encode(
    encrypt(
      '6666'::bytea,
      'restaurant_pin_key_2025'::bytea,
      'aes'
    ),
    'base64'
  )
WHERE id = '4e0ba28e-1a81-424f-9116-630f404084d6';

-- 2. Verify company owner_pin is correct
UPDATE public.companies
SET owner_pin = '4693a73e3ec0d8c1595b0404ba52f545' -- MD5 hash of 6666
WHERE id = 'e95d96dd-fbd6-4606-a7de-4ce9a6c3a731';

-- 3. Soft delete "dec" account (user_id: 32888cb9-ced0-4e0f-b4ff-6d05c1a38c69)
UPDATE public.users
SET 
  is_active = false,
  deleted_at = now()
WHERE id = '32888cb9-ced0-4e0f-b4ff-6d05c1a38c69';