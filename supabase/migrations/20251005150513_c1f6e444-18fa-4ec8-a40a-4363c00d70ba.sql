-- Create optimization_decisions table for logging all optimization decisions
CREATE TABLE IF NOT EXISTS public.optimization_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  decision_time timestamp with time zone DEFAULT now(),
  days_ahead integer,
  current_tables integer[],
  proposed_tables integer[],
  action_taken text CHECK (action_taken IN ('moved', 'stayed', 'locked')),
  reason text,
  strategic_score numeric,
  waste_before integer,
  waste_after integer,
  large_tables_freed integer DEFAULT 0,
  was_ai_suggested boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.optimization_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optimization_decisions_company_isolation"
  ON public.optimization_decisions
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add index for performance
CREATE INDEX idx_optimization_decisions_company_date 
  ON public.optimization_decisions(company_id, decision_time DESC);

CREATE INDEX idx_optimization_decisions_reservation 
  ON public.optimization_decisions(reservation_id);

-- Add comment
COMMENT ON TABLE public.optimization_decisions IS 'Logs all optimization decisions for debugging and AI training';
