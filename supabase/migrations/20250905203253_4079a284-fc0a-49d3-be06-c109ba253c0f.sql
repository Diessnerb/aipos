-- Add table grouping and compatibility fields to tables
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS can_combine boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_combine_size integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS group_priority integer DEFAULT 0;

-- Create table groups for managing combinable tables
CREATE TABLE IF NOT EXISTS public.table_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  group_name text NOT NULL,
  description text,
  max_combined_capacity integer DEFAULT 8,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table group memberships
CREATE TABLE IF NOT EXISTS public.table_group_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.table_groups(id) ON DELETE CASCADE,
  priority_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(table_id, group_id)
);

-- Create assignment rules configuration
CREATE TABLE IF NOT EXISTS public.assignment_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  rule_name text NOT NULL,
  rule_type text NOT NULL, -- 'time_based', 'party_size', 'customer_type', 'table_preference'
  conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '{}',
  priority integer DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create assignment history for analytics
CREATE TABLE IF NOT EXISTS public.assignment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  assigned_tables integer[],
  assignment_strategy text,
  success boolean DEFAULT true,
  conflict_detected boolean DEFAULT false,
  rule_applied text,
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.table_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company isolation
CREATE POLICY "table_groups_company_isolation" ON public.table_groups
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "table_group_memberships_company_isolation" ON public.table_group_memberships
  FOR ALL USING (
    group_id IN (SELECT tg.id FROM public.table_groups tg WHERE tg.company_id IN (SELECT allowed_company_ids_for_current_user()))
  )
  WITH CHECK (
    group_id IN (SELECT tg.id FROM public.table_groups tg WHERE tg.company_id IN (SELECT allowed_company_ids_for_current_user()))
  );

CREATE POLICY "assignment_rules_company_isolation" ON public.assignment_rules
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "assignment_history_company_isolation" ON public.assignment_history
  FOR ALL USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Add triggers for updated_at
CREATE TRIGGER update_table_groups_updated_at
  BEFORE UPDATE ON public.table_groups
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER update_assignment_rules_updated_at
  BEFORE UPDATE ON public.assignment_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Create function to get table groups with member tables
CREATE OR REPLACE FUNCTION public.get_table_groups_with_tables(p_company_id uuid)
RETURNS TABLE(
  group_id uuid,
  group_name text,
  description text,
  max_combined_capacity integer,
  is_active boolean,
  display_order integer,
  table_numbers integer[],
  total_seats integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    tg.id,
    tg.group_name,
    tg.description,
    tg.max_combined_capacity,
    tg.is_active,
    tg.display_order,
    ARRAY_AGG(t.table_number ORDER BY tgm.priority_order) as table_numbers,
    SUM(t.seats)::integer as total_seats
  FROM public.table_groups tg
  LEFT JOIN public.table_group_memberships tgm ON tg.id = tgm.group_id
  LEFT JOIN public.tables t ON tgm.table_id = t.id AND t.is_active = true
  WHERE tg.company_id = p_company_id
    AND tg.is_active = true
  GROUP BY tg.id, tg.group_name, tg.description, tg.max_combined_capacity, tg.is_active, tg.display_order
  ORDER BY tg.display_order, tg.group_name;
END;
$function$;