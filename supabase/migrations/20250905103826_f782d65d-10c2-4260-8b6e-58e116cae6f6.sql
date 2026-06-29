-- Add super admin policy to company_subscription_features table
CREATE POLICY "company_subscription_features_super_admin" 
ON public.company_subscription_features
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.super_admins sa 
    WHERE sa.user_id = auth.uid()
  )
);