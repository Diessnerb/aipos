-- Drop PIN-related RPC functions that are no longer needed
DROP FUNCTION IF EXISTS public.get_company_assignment_settings_by_owner(text);
DROP FUNCTION IF EXISTS public.update_company_assignment_settings_by_owner(text, boolean, boolean);