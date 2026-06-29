-- Add database indexes for performance optimization
-- Index for reservations company filtering and date ordering
CREATE INDEX IF NOT EXISTS idx_reservations_company_date ON public.reservations(company_id, date);

-- Index for reservations realtime filtering
CREATE INDEX IF NOT EXISTS idx_reservations_company_status ON public.reservations(company_id, status) WHERE status NOT IN ('cancelled', 'no-show', 'completed');

-- Index for tables company filtering and active status
CREATE INDEX IF NOT EXISTS idx_tables_company_active ON public.tables(company_id, is_active) WHERE is_active = true;