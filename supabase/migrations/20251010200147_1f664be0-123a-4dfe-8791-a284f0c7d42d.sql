-- Create customer audit log table to track all customer modifications
CREATE TABLE IF NOT EXISTS public.customer_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES public.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reservation_id uuid REFERENCES public.reservations(id),
  source text CHECK (source IN ('client', 'edge_function', 'manual', 'system')),
  company_id uuid NOT NULL REFERENCES public.companies(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customer_audit_log_customer_id ON public.customer_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_audit_log_company_id ON public.customer_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_audit_log_changed_at ON public.customer_audit_log(changed_at DESC);

-- Enable RLS
ALTER TABLE public.customer_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: Company users can view their company's audit logs
CREATE POLICY "customer_audit_log_company_isolation"
ON public.customer_audit_log
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

COMMENT ON TABLE public.customer_audit_log IS 'Audit trail for all customer record modifications to prevent data corruption and track changes';