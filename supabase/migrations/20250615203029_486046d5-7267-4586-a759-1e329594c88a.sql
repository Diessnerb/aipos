
-- 1. Create a "shift_approval_requests" table to track pending approvals for overlapping/overlength shifts
CREATE TABLE IF NOT EXISTS public.shift_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_swap_request_id UUID NOT NULL REFERENCES public.shift_swap_requests(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, -- "overlap" or "overtime"
  day_of_week TEXT NOT NULL,
  shift_date DATE NOT NULL,
  requested_hours NUMERIC NOT NULL,
  approved BOOLEAN DEFAULT NULL,
  reviewed_by_user_id UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookup
CREATE INDEX idx_shift_approval_requests_user ON public.shift_approval_requests(requester_user_id, shift_date);

-- 3. (Optional: If you want, add RLS - See below)
ALTER TABLE public.shift_approval_requests ENABLE ROW LEVEL SECURITY;

-- Allow managers/admins to see all approval requests, users to see their own
CREATE POLICY "Users and managers can view relevant approval requests"
  ON public.shift_approval_requests
  FOR SELECT
  USING (
    auth.uid() = requester_user_id
    -- OR user's role = manager/admin (implement if roles are mapped from auth)
    OR EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.role IN ('manager', 'admin'))
  );

-- Allow managers/admins to update approval requests
CREATE POLICY "Managers/admins can approve/reject approval requests"
  ON public.shift_approval_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = auth.uid() AND u.role IN ('manager', 'admin'))
  );

-- Allow insert by backend only (optional for extra safety; otherwise, the app controls this)
GRANT INSERT ON public.shift_approval_requests TO authenticated;

