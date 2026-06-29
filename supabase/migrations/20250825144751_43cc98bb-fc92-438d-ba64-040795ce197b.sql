-- Enable RLS on users and companies tables if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- RLS policy for users: users can only see their own user record
CREATE POLICY "Users can view their own record"
ON public.users
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- RLS policy for companies: users can see their company
CREATE POLICY "Users can view their company"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
    UNION
    SELECT id FROM public.companies WHERE default_admin_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

-- Grant EXECUTE on the get_user_company_safe function to authenticated role
GRANT EXECUTE ON FUNCTION public.get_user_company_safe() TO authenticated;