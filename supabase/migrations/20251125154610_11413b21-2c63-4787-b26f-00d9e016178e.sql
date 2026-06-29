-- Update find_company_by_admin_email function to use case-insensitive email comparison
CREATE OR REPLACE FUNCTION find_company_by_admin_email(admin_email TEXT)
RETURNS TABLE(id UUID, name TEXT, subdomain TEXT, status TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.subdomain, c.status
  FROM companies c
  WHERE LOWER(c.default_admin_email) = LOWER(admin_email)
    AND c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;