
-- Add a new column to track if this is a shift being offered (posted by original owner)
-- vs a shift swap request (requested by someone else)
ALTER TABLE public.shift_swap_requests 
ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'swap_request';

-- Update the status to include more specific states
ALTER TABLE public.shift_swap_requests 
ADD COLUMN IF NOT EXISTS accepted_by_user_id UUID REFERENCES public.users(id);

-- Add check constraint for request types
ALTER TABLE public.shift_swap_requests 
ADD CONSTRAINT check_request_type 
CHECK (request_type IN ('swap_request', 'shift_posting'));

-- Update RLS policies to handle the new workflow
DROP POLICY IF EXISTS "Users can create shift swap requests for themselves" ON public.shift_swap_requests;

CREATE POLICY "Users can create shift requests" 
  ON public.shift_swap_requests 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users WHERE id = original_user_id
    ) OR 
    auth.uid() IN (
      SELECT id FROM public.users WHERE id = requested_by_user_id
    )
  );

-- Update the update policy to handle acceptance by any user
DROP POLICY IF EXISTS "Users can update shift swap requests they created or are involved in" ON public.shift_swap_requests;

CREATE POLICY "Users can update shift requests they are involved in" 
  ON public.shift_swap_requests 
  FOR UPDATE 
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.users 
      WHERE id = original_user_id 
         OR id = requested_by_user_id 
         OR id = accepted_by_user_id
    )
  );
