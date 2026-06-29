-- Add seat positioning and group mapping tables for Phase 2 visual seat mapping

-- Table for individual table seat positions
CREATE TABLE IF NOT EXISTS public.table_seat_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  seat_number INTEGER NOT NULL,
  x_position NUMERIC(10,2) NOT NULL DEFAULT 0,
  y_position NUMERIC(10,2) NOT NULL DEFAULT 0,
  seat_type TEXT DEFAULT 'standard',
  is_accessible BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for group seat mappings and connection points
CREATE TABLE IF NOT EXISTS public.group_seat_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.table_groups(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  table_combination JSONB NOT NULL, -- Array of table IDs in combination
  total_seats INTEGER NOT NULL,
  lost_seats INTEGER DEFAULT 0,
  connection_points JSONB, -- Connection point coordinates
  efficiency_score NUMERIC(5,2),
  scenario_name TEXT,
  is_optimal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.table_seat_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_seat_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for table_seat_positions
CREATE POLICY "table_seat_positions_company_isolation" 
ON public.table_seat_positions 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS policies for group_seat_mappings
CREATE POLICY "group_seat_mappings_company_isolation" 
ON public.group_seat_mappings 
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add indexes for performance
CREATE INDEX idx_table_seat_positions_table_id ON public.table_seat_positions(table_id);
CREATE INDEX idx_table_seat_positions_company_id ON public.table_seat_positions(company_id);
CREATE INDEX idx_group_seat_mappings_group_id ON public.group_seat_mappings(group_id);
CREATE INDEX idx_group_seat_mappings_company_id ON public.group_seat_mappings(company_id);

-- Add triggers for updated_at
CREATE TRIGGER update_table_seat_positions_updated_at
BEFORE UPDATE ON public.table_seat_positions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER update_group_seat_mappings_updated_at
BEFORE UPDATE ON public.group_seat_mappings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Set company_id triggers
CREATE TRIGGER set_table_seat_positions_company_id
BEFORE INSERT ON public.table_seat_positions
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();

CREATE TRIGGER set_group_seat_mappings_company_id
BEFORE INSERT ON public.group_seat_mappings
FOR EACH ROW
EXECUTE FUNCTION public.set_company_id_from_user();