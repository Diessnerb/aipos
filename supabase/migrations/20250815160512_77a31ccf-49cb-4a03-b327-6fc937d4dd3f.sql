-- Drop existing tables RLS policy that doesn't work with PIN auth
DROP POLICY IF EXISTS "auth_access_tables" ON public.tables;
DROP POLICY IF EXISTS "tables_company_isolation" ON public.tables;

-- Create new RLS policy that works with both PIN and regular authentication
CREATE POLICY "tables_company_isolation" 
ON public.tables 
FOR ALL 
USING (
  company_id IN (
    SELECT u.company_id
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id
    FROM companies c
    WHERE c.default_admin_email IN (
      SELECT au.email
      FROM auth.users au
      WHERE au.id = auth.uid()
    )
    UNION
    -- Support PIN authentication by using the safe company getter
    SELECT public.get_user_company_safe()
    WHERE public.get_user_company_safe() IS NOT NULL
  )
)
WITH CHECK (
  company_id IN (
    SELECT u.company_id
    FROM users u
    WHERE u.auth_user_id = auth.uid()
    UNION
    SELECT c.id
    FROM companies c
    WHERE c.default_admin_email IN (
      SELECT au.email
      FROM auth.users au
      WHERE au.id = auth.uid()
    )
    UNION
    -- Support PIN authentication by using the safe company getter
    SELECT public.get_user_company_safe()
    WHERE public.get_user_company_safe() IS NOT NULL
  )
);