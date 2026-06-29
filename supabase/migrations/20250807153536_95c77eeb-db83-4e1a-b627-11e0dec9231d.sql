-- Add index on page_permissions for better query performance
CREATE INDEX IF NOT EXISTS idx_page_permissions_company_id ON public.page_permissions(company_id);

-- Add index for compound queries
CREATE INDEX IF NOT EXISTS idx_page_permissions_company_access ON public.page_permissions(company_id, access_level);

-- Add index on users table for better role lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Add company_id trigger for page_permissions if not exists
CREATE OR REPLACE FUNCTION public.set_page_permission_company_id()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  IF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT company_id FROM users WHERE auth_user_id = auth.uid());
  END IF;
  return NEW;
end;
$function$;

-- Create trigger for auto-setting company_id
DROP TRIGGER IF EXISTS set_page_permission_company_id_trigger ON public.page_permissions;
CREATE TRIGGER set_page_permission_company_id_trigger
  BEFORE INSERT ON public.page_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_page_permission_company_id();