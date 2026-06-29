-- Fix PIN encryption/decryption with correct 10-digit translation mapping

-- First, clear all existing encrypted PINs (they're broken and can't be recovered)
UPDATE public.users
SET pin_code_encrypted = NULL
WHERE pin_code_encrypted IS NOT NULL;

-- Replace encrypt_pin with correct reversible mapping
CREATE OR REPLACE FUNCTION public.encrypt_pin(pin_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pin_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use static 10-digit translation map (0->5, 1->7, 2->3, 3->8, 4->0, 5->1, 6->9, 7->2, 8->4, 9->6)
  RETURN encode(
    convert_to(
      translate(pin_text, '0123456789', '5738019246'),
      'UTF8'
    ),
    'base64'
  );
END;
$$;

-- Replace decrypt_pin with reverse translation
CREATE OR REPLACE FUNCTION public.decrypt_pin(encrypted_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_pin IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Reverse the translation map (5->0, 7->1, 3->2, 8->3, 0->4, 1->5, 9->6, 2->7, 4->8, 6->9)
  RETURN translate(
    convert_from(decode(encrypted_pin, 'base64'), 'UTF8'),
    '5738019246',
    '0123456789'
  );
END;
$$;

-- Harden get_decrypted_pin to validate output
CREATE OR REPLACE FUNCTION public.get_decrypted_pin(user_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_value TEXT;
  decrypted_value TEXT;
BEGIN
  -- Get the encrypted PIN
  SELECT pin_code_encrypted INTO encrypted_value
  FROM public.users
  WHERE id = user_id_param;
  
  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt it
  decrypted_value := public.decrypt_pin(encrypted_value);
  
  -- Validate it's a 4-digit PIN
  IF decrypted_value IS NULL OR decrypted_value !~ '^[0-9]{4}$' THEN
    RETURN NULL;
  END IF;
  
  RETURN decrypted_value;
END;
$$;