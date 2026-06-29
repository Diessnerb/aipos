-- Create a function to clean up phone numbers with elevated privileges
CREATE OR REPLACE FUNCTION public.cleanup_phone_numbers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservations_updated integer := 0;
  customers_updated integer := 0;
BEGIN
  -- Clean up reservations table
  UPDATE public.reservations
  SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
  WHERE phone IS NOT NULL
    AND phone ~ '[^0-9]';
  
  GET DIAGNOSTICS reservations_updated = ROW_COUNT;
  
  -- Clean up customers table
  UPDATE public.customers
  SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
  WHERE phone IS NOT NULL
    AND phone ~ '[^0-9]';
  
  GET DIAGNOSTICS customers_updated = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'reservations_updated', reservations_updated,
    'customers_updated', customers_updated,
    'message', 'Phone numbers cleaned up successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Execute the cleanup function
SELECT public.cleanup_phone_numbers();