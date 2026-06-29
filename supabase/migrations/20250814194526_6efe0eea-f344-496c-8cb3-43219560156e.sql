-- Drop the old 6-parameter version of create_company_with_admin to resolve overloading conflict
DROP FUNCTION IF EXISTS public.create_company_with_admin(text, text, text, text, text, text);