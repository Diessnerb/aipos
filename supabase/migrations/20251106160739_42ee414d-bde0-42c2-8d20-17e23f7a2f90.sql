-- Create kitchen service requests table for kitchen-to-floor communication
CREATE TABLE IF NOT EXISTS public.kitchen_service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('service', 'message')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.kitchen_service_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view requests for their company
CREATE POLICY "Users can view kitchen requests for their company"
  ON public.kitchen_service_requests FOR SELECT
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Policy: Users can create requests for their company
CREATE POLICY "Users can create kitchen requests for their company"
  ON public.kitchen_service_requests FOR INSERT
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Policy: Users can update requests for their company
CREATE POLICY "Users can update kitchen requests for their company"
  ON public.kitchen_service_requests FOR UPDATE
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Create index for faster queries
CREATE INDEX idx_kitchen_service_requests_company_status 
  ON public.kitchen_service_requests(company_id, status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_service_requests;