-- Create optimization log table to track optimization decisions
CREATE TABLE IF NOT EXISTS public.optimization_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  reservation_id UUID NOT NULL,
  old_table_number INTEGER,
  new_table_number INTEGER,
  optimization_type TEXT NOT NULL, -- 'gap_reduction', 'accessibility', 'special_requirement', 'efficiency'
  reason TEXT NOT NULL,
  gap_reduction_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  optimization_session_id UUID NOT NULL DEFAULT gen_random_uuid()
);

-- Add company isolation RLS
ALTER TABLE public.optimization_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optimization_log_company_isolation" 
ON public.optimization_log 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add last_optimized_at to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS last_optimized_at TIMESTAMP WITH TIME ZONE;

-- Add optimization_enabled flag (defaults to auto_assign_tables value)  
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS optimization_enabled BOOLEAN DEFAULT NULL;

-- Create function to check if optimization should run for a company
CREATE OR REPLACE FUNCTION public.should_run_optimization(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auto_assign BOOLEAN;
  v_optimization_enabled BOOLEAN;
  v_last_optimized TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT 
    auto_assign_tables,
    COALESCE(optimization_enabled, auto_assign_tables) as opt_enabled,
    last_optimized_at
  INTO v_auto_assign, v_optimization_enabled, v_last_optimized
  FROM company_settings
  WHERE company_id = p_company_id;
  
  -- Return true if optimization is enabled and hasn't run in last 5 minutes
  RETURN v_optimization_enabled = true 
    AND (v_last_optimized IS NULL OR v_last_optimized < now() - interval '5 minutes');
END;
$$;

-- Create function to update last optimized timestamp
CREATE OR REPLACE FUNCTION public.update_optimization_timestamp(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE company_settings
  SET last_optimized_at = now()
  WHERE company_id = p_company_id;
END;
$$;