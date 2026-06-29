-- Fix duplicate is_super_admin functions by dropping all and recreating one
DROP FUNCTION IF EXISTS public.is_super_admin();

-- Create the correct is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
END;
$function$;