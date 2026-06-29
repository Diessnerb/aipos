
-- Add approval workflow columns to shift_swap_requests table
ALTER TABLE public.shift_swap_requests 
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Update the status check constraint to include new statuses
ALTER TABLE public.shift_swap_requests 
DROP CONSTRAINT IF EXISTS check_status;

ALTER TABLE public.shift_swap_requests 
ADD CONSTRAINT check_status 
CHECK (status IN ('pending', 'accepted', 'declined', 'pending_approval', 'approved', 'rejected'));

-- Update existing 'accepted' records to 'pending_approval' for demo purposes
UPDATE public.shift_swap_requests 
SET status = 'pending_approval' 
WHERE status = 'accepted';

-- Add RLS policy for managers/admins to approve requests
CREATE POLICY "Managers can approve shift requests" 
  ON public.shift_swap_requests 
  FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );
