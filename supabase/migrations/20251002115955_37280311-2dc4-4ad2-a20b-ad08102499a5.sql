-- Create table for service schedules
CREATE TABLE IF NOT EXISTS public.table_service_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_status TEXT NOT NULL CHECK (service_status IN ('out_of_service', 'temporarily_removed')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_end TIMESTAMPTZ,
  duration_days INTEGER,
  requires_attention BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_service_schedules_company ON public.table_service_schedules(company_id, requires_attention);
CREATE INDEX idx_service_schedules_end ON public.table_service_schedules(scheduled_end) WHERE requires_attention = false;
CREATE INDEX idx_service_schedules_table ON public.table_service_schedules(table_id);

-- Enable RLS
ALTER TABLE public.table_service_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Company isolation for SELECT
CREATE POLICY "table_service_schedules_select"
ON public.table_service_schedules
FOR SELECT
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policy: Company isolation for INSERT
CREATE POLICY "table_service_schedules_insert"
ON public.table_service_schedules
FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policy: Company isolation for UPDATE
CREATE POLICY "table_service_schedules_update"
ON public.table_service_schedules
FOR UPDATE
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policy: Company isolation for DELETE
CREATE POLICY "table_service_schedules_delete"
ON public.table_service_schedules
FOR DELETE
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Function to get tables requiring attention
CREATE OR REPLACE FUNCTION public.get_tables_requiring_attention(p_company_id UUID)
RETURNS TABLE (
  schedule_id UUID,
  table_id UUID,
  table_number INTEGER,
  table_name TEXT,
  service_status TEXT,
  scheduled_at TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  duration_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tss.id as schedule_id,
    t.id as table_id,
    t.table_number,
    t.table_name,
    tss.service_status,
    tss.scheduled_at,
    tss.scheduled_end,
    tss.duration_days
  FROM public.table_service_schedules tss
  JOIN public.tables t ON tss.table_id = t.id
  WHERE tss.company_id = p_company_id
    AND tss.requires_attention = true
    AND tss.resolved_at IS NULL
  ORDER BY tss.scheduled_end ASC NULLS LAST;
END;
$$;

-- Function to resolve service schedule
CREATE OR REPLACE FUNCTION public.resolve_service_schedule(
  p_schedule_id UUID,
  p_action TEXT,
  p_extend_days INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_new_schedule_id UUID;
BEGIN
  -- Get the schedule
  SELECT * INTO v_schedule
  FROM public.table_service_schedules
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Schedule not found');
  END IF;

  -- Mark schedule as resolved
  UPDATE public.table_service_schedules
  SET 
    resolved_at = NOW(),
    resolved_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_schedule_id;

  -- Handle different actions
  IF p_action = 'turn_on' THEN
    -- Update table status to available
    UPDATE public.tables
    SET 
      service_status = 'available',
      updated_at = NOW()
    WHERE id = v_schedule.table_id;
    
    RETURN json_build_object('success', true, 'action', 'turned_on');
    
  ELSIF p_action = 'extend' AND p_extend_days IS NOT NULL THEN
    -- Create new schedule with extended time
    INSERT INTO public.table_service_schedules (
      table_id,
      company_id,
      service_status,
      scheduled_end,
      duration_days,
      requires_attention
    ) VALUES (
      v_schedule.table_id,
      v_schedule.company_id,
      v_schedule.service_status,
      NOW() + (p_extend_days || ' days')::INTERVAL,
      p_extend_days,
      false
    )
    RETURNING id INTO v_new_schedule_id;
    
    RETURN json_build_object('success', true, 'action', 'extended', 'new_schedule_id', v_new_schedule_id);
    
  ELSIF p_action = 'dismiss' THEN
    -- Just dismiss without changing table status
    RETURN json_build_object('success', true, 'action', 'dismissed');
    
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

-- Function to create service schedule
CREATE OR REPLACE FUNCTION public.create_service_schedule(
  p_table_id UUID,
  p_duration_days INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_schedule_id UUID;
  v_scheduled_end TIMESTAMPTZ;
BEGIN
  -- Get company_id from table
  SELECT company_id INTO v_company_id
  FROM public.tables
  WHERE id = p_table_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Table not found');
  END IF;

  -- Calculate end time if duration provided
  IF p_duration_days IS NOT NULL THEN
    v_scheduled_end := NOW() + (p_duration_days || ' days')::INTERVAL;
  END IF;

  -- Create schedule
  INSERT INTO public.table_service_schedules (
    table_id,
    company_id,
    service_status,
    scheduled_end,
    duration_days,
    requires_attention
  ) VALUES (
    p_table_id,
    v_company_id,
    'out_of_service',
    v_scheduled_end,
    p_duration_days,
    false
  )
  RETURNING id INTO v_schedule_id;

  RETURN json_build_object(
    'success', true, 
    'schedule_id', v_schedule_id,
    'scheduled_end', v_scheduled_end
  );
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_table_service_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_table_service_schedules_updated_at
  BEFORE UPDATE ON public.table_service_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_table_service_schedules_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_service_schedules;