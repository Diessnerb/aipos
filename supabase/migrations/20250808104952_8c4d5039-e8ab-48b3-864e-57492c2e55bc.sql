-- Fix the last remaining function missing SET search_path
CREATE OR REPLACE FUNCTION public.set_page_permission_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  return NEW;
END;
$$;