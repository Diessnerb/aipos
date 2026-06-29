-- Migration 1: Add SMS tracking columns to reservations
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_reservations_reminder 
ON public.reservations(company_id, date, status, reminder_sent) 
WHERE reminder_sent = false;

-- Migration 2: Company-Twilio mapping table (admin managed)
CREATE TABLE IF NOT EXISTS public.company_twilio_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  twilio_phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- RLS: Only super admins can manage Twilio config
ALTER TABLE public.company_twilio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage Twilio config"
ON public.company_twilio_config
FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Migration 3: SMS activity logging table
CREATE TABLE IF NOT EXISTS public.sms_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id),
  reservation_id UUID REFERENCES public.reservations(id),
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL,
  twilio_message_sid TEXT,
  inbound_message TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at_utc TIMESTAMPTZ DEFAULT NOW(),
  company_local_time TEXT
);

-- RLS: Company users can view their own logs
ALTER TABLE public.sms_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company SMS logs"
ON public.sms_reminder_logs
FOR SELECT
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "System can manage SMS logs"
ON public.sms_reminder_logs
FOR ALL
USING (true)
WITH CHECK (true);