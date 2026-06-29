-- Let me check how PINs are currently being stored and authenticated
-- First, let's see the current authenticate_by_pin_secure function
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'authenticate_by_pin_secure' 
AND routine_schema = 'public';

-- Also check authenticate_by_pin_secure_v2 if it exists
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'authenticate_by_pin_secure_v2' 
AND routine_schema = 'public';