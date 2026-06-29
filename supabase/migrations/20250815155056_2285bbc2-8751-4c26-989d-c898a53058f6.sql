-- Add RLS policy to allow users to access their own user record
CREATE POLICY "Users can access their own record" 
ON public.users 
FOR SELECT 
USING (auth_user_id = auth.uid());

-- Add RLS policy to allow company admin email lookup for fallback
CREATE POLICY "Allow company lookup by admin email" 
ON public.companies 
FOR SELECT 
USING (
  default_admin_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- Add policy for users to see other users in their company (for team management)
CREATE POLICY "Users can view same company users" 
ON public.users 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
  )
);