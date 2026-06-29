-- Create customer reservation history table for tracking late arrivals and no-shows
CREATE TABLE IF NOT EXISTS public.customer_reservation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  
  -- Event tracking
  event_type TEXT NOT NULL CHECK (event_type IN ('marked_late', 'no_show', 'late_arrival')),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Late arrival specific data
  scheduled_time TIME,
  actual_arrival_time TIMESTAMPTZ,
  minutes_late INTEGER,
  
  -- Reservation context
  reservation_date DATE NOT NULL,
  party_size INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for quick customer lookups
CREATE INDEX IF NOT EXISTS idx_customer_history_company ON public.customer_reservation_history(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_history_name ON public.customer_reservation_history(company_id, customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_history_email ON public.customer_reservation_history(company_id, customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_history_phone ON public.customer_reservation_history(company_id, customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_history_reservation ON public.customer_reservation_history(reservation_id);

-- Enable RLS
ALTER TABLE public.customer_reservation_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see history from their company
CREATE POLICY "customer_reservation_history_company_isolation"
ON public.customer_reservation_history
FOR ALL
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Update customers table with tracking fields
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_minutes_late NUMERIC(5,2) DEFAULT 0;

-- Create function to update customer stats automatically
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_late_count INTEGER;
  v_no_show_count INTEGER;
  v_avg_late NUMERIC;
BEGIN
  -- Try to find existing customer by email, phone, or name
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE company_id = NEW.company_id
    AND (
      (NEW.customer_email IS NOT NULL AND email = NEW.customer_email)
      OR (NEW.customer_phone IS NOT NULL AND phone = NEW.customer_phone)
      OR name = NEW.customer_name
    )
  LIMIT 1;
  
  -- If customer doesn't exist, create them
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (company_id, name, email, phone)
    VALUES (NEW.company_id, NEW.customer_name, NEW.customer_email, NEW.customer_phone)
    RETURNING id INTO v_customer_id;
  END IF;
  
  -- Calculate stats from history
  SELECT 
    COUNT(*) FILTER (WHERE event_type IN ('marked_late', 'late_arrival')),
    COUNT(*) FILTER (WHERE event_type = 'no_show'),
    AVG(minutes_late) FILTER (WHERE event_type = 'late_arrival' AND minutes_late IS NOT NULL)
  INTO v_late_count, v_no_show_count, v_avg_late
  FROM public.customer_reservation_history
  WHERE company_id = NEW.company_id
    AND (
      (NEW.customer_email IS NOT NULL AND customer_email = NEW.customer_email)
      OR (NEW.customer_phone IS NOT NULL AND customer_phone = NEW.customer_phone)
      OR customer_name = NEW.customer_name
    );
  
  -- Update customer record with calculated stats
  UPDATE public.customers
  SET 
    late_count = v_late_count,
    no_show_count = v_no_show_count,
    average_minutes_late = COALESCE(v_avg_late, 0)
  WHERE id = v_customer_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update customer stats after new history entry
DROP TRIGGER IF EXISTS track_customer_behavior ON public.customer_reservation_history;
CREATE TRIGGER track_customer_behavior
AFTER INSERT ON public.customer_reservation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_stats();