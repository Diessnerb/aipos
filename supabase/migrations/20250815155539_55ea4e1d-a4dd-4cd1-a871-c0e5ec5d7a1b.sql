-- Create security definer function to safely get user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_company_safe()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view same company users" ON public.users;

-- Create a new policy using the safe function
CREATE POLICY "Users can view same company users" 
ON public.users 
FOR SELECT 
USING (
  company_id = public.get_user_company_safe()
  OR auth_user_id = auth.uid()
);