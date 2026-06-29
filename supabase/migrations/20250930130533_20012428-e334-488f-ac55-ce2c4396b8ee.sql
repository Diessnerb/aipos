-- Fix alisha_conversations RLS to allow PIN users to save chat history
-- The issue: PIN users don't have auth_user_id, so the current policy blocks them

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.alisha_conversations;

-- Create a new policy that handles both authenticated users AND PIN users
CREATE POLICY "Users can create conversations for their company"
ON public.alisha_conversations
FOR INSERT
WITH CHECK (
  -- Allow if user_id belongs to the same company as the authenticated user
  user_id IN (
    SELECT u.id 
    FROM public.users u
    WHERE u.company_id IN (
      -- Get companies accessible by the authenticated user
      SELECT u2.company_id
      FROM public.users u2
      WHERE u2.auth_user_id = auth.uid()
      
      UNION
      
      -- Also check for company admin email match
      SELECT c.id
      FROM public.companies c
      WHERE c.default_admin_email IN (
        SELECT au.email 
        FROM auth.users au 
        WHERE au.id = auth.uid()
      )
    )
  )
  AND
  -- Ensure company_id is one the authenticated user has access to
  company_id IN (
    SELECT u3.company_id
    FROM public.users u3
    WHERE u3.auth_user_id = auth.uid()
    
    UNION
    
    SELECT c2.id
    FROM public.companies c2
    WHERE c2.default_admin_email IN (
      SELECT au2.email 
      FROM auth.users au2 
      WHERE au2.id = auth.uid()
    )
  )
);