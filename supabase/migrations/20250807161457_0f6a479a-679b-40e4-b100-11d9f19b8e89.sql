-- Create a function to get page permissions for any company
CREATE OR REPLACE FUNCTION public.get_page_permissions_by_company(company_uuid uuid)
RETURNS TABLE(
  id uuid,
  page_name text,
  access_level text,
  permission_type text,
  company_id uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id,
    pp.page_name,
    pp.access_level::text,
    pp.permission_type::text,
    pp.company_id,
    pp.created_at,
    pp.updated_at
  FROM page_permissions pp
  WHERE pp.company_id = company_uuid
  ORDER BY pp.page_name ASC;
END;
$$;